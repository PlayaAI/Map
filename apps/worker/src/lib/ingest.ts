import type { Pool, PoolClient } from "pg";
import type { YearSourceConfig } from "./config.js";
import { fetchJson, fetchText } from "./http.js";
import { parseCsv } from "./csv.js";
import {
  extractArrayPayload,
  getCampNameMap,
  normalizeArchiveEntity,
  normalizeCampOutlineFeature,
} from "./normalize.js";

interface EventRecord {
  id: string;
  year: number;
  name: string;
}

function toStringRecord(input: Record<string, unknown>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      output[key] = value;
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      output[key] = String(value);
    }
  }
  return output;
}

function parseCampNameGeoJsonRows(payload: unknown): Array<Record<string, string>> {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const features = (payload as { features?: unknown }).features;
  if (!Array.isArray(features)) {
    return [];
  }

  const rows: Array<Record<string, string>> = [];
  for (const feature of features) {
    if (!feature || typeof feature !== "object") {
      continue;
    }

    const properties = (feature as { properties?: unknown }).properties;
    if (!properties || typeof properties !== "object") {
      continue;
    }

    rows.push(toStringRecord(properties as Record<string, unknown>));
  }

  return rows;
}

function isJsonLikeUrl(url: string): boolean {
  return /\.geojson(\?|$)|\.json(\?|$)/i.test(url);
}

async function loadCampNameMap(source: YearSourceConfig): Promise<Map<string, Record<string, string>>> {
  if (!source.campNamesCsvUrl) {
    return new Map<string, Record<string, string>>();
  }

  try {
    if (isJsonLikeUrl(source.campNamesCsvUrl)) {
      const payload = await fetchJson<unknown>(source.campNamesCsvUrl);
      return getCampNameMap(parseCampNameGeoJsonRows(payload));
    }

    const csvContent = await fetchText(source.campNamesCsvUrl);
    return getCampNameMap(parseCsv(csvContent));
  } catch {
    return new Map<string, Record<string, string>>();
  }
}

async function upsertEvent(client: PoolClient, year: number): Promise<EventRecord> {
  const result = await client.query<EventRecord>(
    `
    INSERT INTO events (slug, year, name, source)
    VALUES ($1, $2, $3, 'official')
    ON CONFLICT (year)
    DO UPDATE SET slug = EXCLUDED.slug, name = EXCLUDED.name
    RETURNING id, year, name
    `,
    [`burning-man-${year}`, year, `Burning Man ${year}`],
  );

  const event = result.rows[0];
  if (!event) {
    throw new Error(`Unable to create event ${year}`);
  }
  return event;
}

interface UpsertEntityInput {
  eventId: string;
  sourceType: "camp" | "art" | "event";
  sourceId: string;
  name: string;
  description: string;
  locationText: string;
  payload: unknown;
}

async function upsertEntity(client: PoolClient, input: UpsertEntityInput): Promise<string> {
  const result = await client.query<{ id: string }>(
    `
    INSERT INTO entities (
      event_id,
      source_type,
      source_id,
      name,
      description,
      location_text,
      source_payload
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    ON CONFLICT (event_id, source_type, source_id)
    DO UPDATE
      SET name = EXCLUDED.name,
          description = EXCLUDED.description,
          location_text = EXCLUDED.location_text,
          source_payload = EXCLUDED.source_payload
    RETURNING id
    `,
    [
      input.eventId,
      input.sourceType,
      input.sourceId,
      input.name,
      input.description,
      input.locationText,
      JSON.stringify(input.payload),
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error(`Unable to upsert entity ${input.sourceType}:${input.sourceId}`);
  }
  return row.id;
}

async function upsertGeometry(client: PoolClient, entityId: string, geometry: unknown): Promise<void> {
  await client.query(
    `
    INSERT INTO geometry_features (entity_id, geometry, geojson)
    VALUES (
      $1,
      ST_SetSRID(ST_GeomFromGeoJSON($2), 4326),
      $3::jsonb
    )
    ON CONFLICT (entity_id)
    DO UPDATE
      SET geometry = EXCLUDED.geometry,
          geojson = EXCLUDED.geojson
    `,
    [entityId, JSON.stringify(geometry), JSON.stringify(geometry)],
  );
}

async function ingestCampOutlines(client: PoolClient, eventId: string, source: YearSourceConfig): Promise<number> {
  if (!source.campOutlinesUrl) {
    return 0;
  }

  const geojson = await fetchJson<{
    type?: string;
    features?: Array<Record<string, unknown>>;
  }>(source.campOutlinesUrl);

  const features = Array.isArray(geojson.features) ? geojson.features : [];
  const campNameMap = await loadCampNameMap(source);

  let count = 0;
  for (const [index, feature] of features.entries()) {
    const normalized = normalizeCampOutlineFeature(feature, campNameMap, index);
    if (!normalized) {
      continue;
    }

    const entityId = await upsertEntity(client, {
      eventId,
      sourceType: "camp",
      sourceId: normalized.sourceId,
      name: normalized.name,
      description: normalized.description,
      locationText: normalized.locationText,
      payload: normalized.payload,
    });

    await upsertGeometry(client, entityId, normalized.geometry);
    count += 1;
  }

  return count;
}

async function ingestArchiveType(
  client: PoolClient,
  eventId: string,
  sourceType: "camp" | "art" | "event",
  archiveUrl: string | undefined,
): Promise<number> {
  if (!archiveUrl) {
    return 0;
  }

  const payload = await fetchJson<unknown>(archiveUrl);
  const rows = extractArrayPayload(payload);

  let count = 0;
  for (const [index, item] of rows.entries()) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const normalized = normalizeArchiveEntity(item as Record<string, unknown>, index);
    if (!normalized) {
      continue;
    }

    const entityId = await upsertEntity(client, {
      eventId,
      sourceType,
      sourceId: normalized.sourceId,
      name: normalized.name,
      description: normalized.description,
      locationText: normalized.locationText,
      payload: normalized.payload,
    });

    if (normalized.geometry) {
      await upsertGeometry(client, entityId, normalized.geometry);
    }

    count += 1;
  }

  return count;
}

export interface IngestionStats {
  year: number;
  eventId: string;
  campOutlinesCount: number;
  campArchiveCount: number;
  artArchiveCount: number;
  eventArchiveCount: number;
}

export async function ingestYear(pool: Pool, source: YearSourceConfig): Promise<IngestionStats> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const event = await upsertEvent(client, source.year);
    const campOutlinesCount = await ingestCampOutlines(client, event.id, source);
    const campArchiveCount = await ingestArchiveType(
      client,
      event.id,
      "camp",
      source.campArchiveUrl,
    );
    const artArchiveCount = await ingestArchiveType(client, event.id, "art", source.artArchiveUrl);
    const eventArchiveCount = await ingestArchiveType(
      client,
      event.id,
      "event",
      source.eventArchiveUrl,
    );

    await client.query("COMMIT");

    return {
      year: source.year,
      eventId: event.id,
      campOutlinesCount,
      campArchiveCount,
      artArchiveCount,
      eventArchiveCount,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
