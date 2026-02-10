import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../lib/auth.js";

const aiDisclosureSchema = z.object({
  usesAi: z.boolean(),
  aiCategories: z.array(z.string().min(1)).max(20),
  tools: z.array(z.string().min(1)).max(40),
  humanLeadDescription: z.string().max(1_000).optional().default(""),
  techFreeZone: z.boolean(),
  disclosureText: z.string().max(2_000).optional().default(""),
});

const submissionSchema = z.object({
  entityId: z.string().uuid(),
  reason: z.string().max(2_000).optional().default(""),
  aiDisclosure: aiDisclosureSchema,
});

const claimSchema = z.object({
  entityId: z.string().uuid(),
  proof: z.string().max(2_000).optional().default(""),
  notes: z.string().max(2_000).optional().default(""),
});

export const participationRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/submissions", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    const parsed = submissionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const entityCheck = await pool.query("SELECT id FROM entities WHERE id = $1", [
      parsed.data.entityId,
    ]);

    if (!entityCheck.rowCount) {
      return reply.code(404).send({ error: "Entity not found" });
    }

    const result = await pool.query<{
      id: string;
      status: string;
      created_at: string;
    }>(
      `
      INSERT INTO submissions (entity_id, user_id, payload, reason)
      VALUES ($1, $2, $3::jsonb, $4)
      RETURNING id, status, created_at
      `,
      [
        parsed.data.entityId,
        user.id,
        JSON.stringify({ aiDisclosure: parsed.data.aiDisclosure }),
        parsed.data.reason,
      ],
    );

    return reply.code(201).send({ submission: result.rows[0] });
  });

  app.post("/api/claims", async (request, reply) => {
    const user = await requireAuth(request, reply);
    if (!user) {
      return;
    }

    const parsed = claimSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const entityCheck = await pool.query("SELECT id FROM entities WHERE id = $1", [
      parsed.data.entityId,
    ]);

    if (!entityCheck.rowCount) {
      return reply.code(404).send({ error: "Entity not found" });
    }

    const result = await pool.query<{
      id: string;
      status: string;
      created_at: string;
    }>(
      `
      INSERT INTO claims (entity_id, user_id, proof, notes)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (entity_id, user_id)
      DO UPDATE
        SET proof = EXCLUDED.proof,
            notes = EXCLUDED.notes,
            status = 'pending',
            reviewed_by = NULL,
            reviewed_at = NULL,
            review_note = NULL,
            created_at = now()
      RETURNING id, status, created_at
      `,
      [parsed.data.entityId, user.id, parsed.data.proof, parsed.data.notes],
    );

    return reply.code(201).send({ claim: result.rows[0] });
  });
};
