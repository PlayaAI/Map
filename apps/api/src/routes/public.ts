import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../db.js";
import { parseBoundingBox, parseMapFilters } from "../lib/filters.js";

export const publicRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/events", async (_, reply) => {
    const result = await pool.query<{
      id: string;
      slug: string;
      year: number;
      name: string;
      status: string;
    }>(
      `
      SELECT id, slug, year, name, status
      FROM events
      ORDER BY year DESC
      `,
    );

    return reply.send({ events: result.rows });
  });

  app.get("/api/map/features", async (request, reply) => {
    const queryParams = request.query as Record<string, string | undefined>;
    const eventYear = queryParams.eventYear ? Number.parseInt(queryParams.eventYear, 10) : undefined;
    const limitCandidate = queryParams.limit ? Number.parseInt(queryParams.limit, 10) : 2000;

    if (eventYear !== undefined && Number.isNaN(eventYear)) {
      return reply.code(400).send({ error: "eventYear must be an integer" });
    }
    if (eventYear !== undefined && (eventYear < 2000 || eventYear > 2100)) {
      return reply.code(400).send({ error: "eventYear must be between 2000 and 2100" });
    }
    if (Number.isNaN(limitCandidate)) {
      return reply.code(400).send({ error: "limit must be an integer" });
    }

    const filters = parseMapFilters(queryParams.filters);
    const bbox = parseBoundingBox(queryParams.bbox);
    const limit = Math.min(Math.max(limitCandidate, 1), 10_000);

    const eventResult = eventYear !== undefined
      ? await pool.query<{ id: string; year: number; name: string }>(
          `SELECT id, year, name FROM events WHERE year = $1 LIMIT 1`,
          [eventYear],
        )
      : await pool.query<{ id: string; year: number; name: string }>(
          `SELECT id, year, name FROM events ORDER BY year DESC LIMIT 1`,
        );

    const eventRow = eventResult.rows[0];
    if (!eventRow) {
      return reply.code(404).send({ error: "No event data available" });
    }

    const params: Array<string | number> = [eventRow.id];
    const whereClauses = ["e.event_id = $1"];

    if (bbox) {
      params.push(bbox.west, bbox.south, bbox.east, bbox.north);
      const start = params.length - 3;
      whereClauses.push(
        `ST_Intersects(gf.geometry, ST_MakeEnvelope($${start}, $${start + 1}, $${start + 2}, $${start + 3}, 4326))`,
      );
    }

    if (filters.length > 0) {
      const orConditions: string[] = [];
      if (filters.includes("ai_art")) {
        orConditions.push("(ad.uses_ai = true AND 'ai_art' = ANY(ad.ai_categories))");
      }
      if (filters.includes("workshop")) {
        orConditions.push("('workshop' = ANY(ad.ai_categories))");
      }
      if (filters.includes("tech_free")) {
        orConditions.push("(ad.tech_free_zone = true)");
      }
      if (orConditions.length > 0) {
        whereClauses.push(`(${orConditions.join(" OR ")})`);
      }
    }

    params.push(limit);

    const sql = `
      SELECT
        e.id,
        e.name,
        e.source_type,
        e.location_text,
        e.description,
        gf.geojson,
        COALESCE(ad.uses_ai, false) AS uses_ai,
        COALESCE(ad.ai_categories, '{}') AS ai_categories,
        COALESCE(ad.tools, '{}') AS tools,
        COALESCE(ad.tech_free_zone, false) AS tech_free_zone,
        ad.human_lead_description,
        ad.disclosure_text
      FROM entities e
      INNER JOIN geometry_features gf ON gf.entity_id = e.id
      LEFT JOIN ai_disclosures ad ON ad.entity_id = e.id AND ad.status = 'approved'
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY e.name ASC
      LIMIT $${params.length}
    `;

    const result = await pool.query<{
      id: string;
      name: string;
      source_type: string;
      location_text: string | null;
      description: string | null;
      geojson: unknown;
      uses_ai: boolean;
      ai_categories: string[];
      tools: string[];
      tech_free_zone: boolean;
      human_lead_description: string | null;
      disclosure_text: string | null;
    }>(sql, params);

    const features = result.rows.map((row) => ({
      type: "Feature",
      geometry: row.geojson,
      properties: {
        id: row.id,
        name: row.name,
        sourceType: row.source_type,
        locationText: row.location_text,
        description: row.description,
        usesAi: row.uses_ai,
        aiCategories: row.ai_categories,
        tools: row.tools,
        techFreeZone: row.tech_free_zone,
        humanLeadDescription: row.human_lead_description,
        disclosureText: row.disclosure_text,
        aiDisclosure: {
          usesAi: row.uses_ai,
          aiCategories: row.ai_categories,
          tools: row.tools,
          techFreeZone: row.tech_free_zone,
          humanLeadDescription: row.human_lead_description,
          disclosureText: row.disclosure_text,
        },
      },
    }));

    return reply.send({
      type: "FeatureCollection",
      event: { id: eventRow.id, year: eventRow.year, name: eventRow.name },
      features,
    });
  });

  app.get("/api/entities/:id", async (request, reply) => {
    const idSchema = z.object({ id: z.string().uuid() });
    const parsedParams = idSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({ error: parsedParams.error.flatten() });
    }

    const result = await pool.query<{
      id: string;
      name: string;
      description: string | null;
      location_text: string | null;
      source_type: string;
      source_id: string;
      source_payload: unknown;
      event_year: number;
      event_name: string;
      geojson: unknown | null;
      uses_ai: boolean | null;
      ai_categories: string[] | null;
      tools: string[] | null;
      human_lead_description: string | null;
      tech_free_zone: boolean | null;
      disclosure_text: string | null;
    }>(
      `
      SELECT
        e.id,
        e.name,
        e.description,
        e.location_text,
        e.source_type,
        e.source_id,
        e.source_payload,
        ev.year AS event_year,
        ev.name AS event_name,
        gf.geojson,
        ad.uses_ai,
        ad.ai_categories,
        ad.tools,
        ad.human_lead_description,
        ad.tech_free_zone,
        ad.disclosure_text
      FROM entities e
      INNER JOIN events ev ON ev.id = e.event_id
      LEFT JOIN geometry_features gf ON gf.entity_id = e.id
      LEFT JOIN ai_disclosures ad ON ad.entity_id = e.id AND ad.status = 'approved'
      WHERE e.id = $1
      LIMIT 1
      `,
      [parsedParams.data.id],
    );

    const entity = result.rows[0];
    if (!entity) {
      return reply.code(404).send({ error: "Entity not found" });
    }

    return reply.send({
      entity: {
        id: entity.id,
        name: entity.name,
        description: entity.description,
        locationText: entity.location_text,
        sourceType: entity.source_type,
        sourceId: entity.source_id,
        sourcePayload: entity.source_payload,
        event: {
          year: entity.event_year,
          name: entity.event_name,
        },
        geometry: entity.geojson,
        aiDisclosure: entity.uses_ai === null
          ? null
          : {
              usesAi: entity.uses_ai,
              aiCategories: entity.ai_categories ?? [],
              tools: entity.tools ?? [],
              humanLeadDescription: entity.human_lead_description,
              techFreeZone: entity.tech_free_zone ?? false,
              disclosureText: entity.disclosure_text,
            },
      },
    });
  });
};
