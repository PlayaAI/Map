import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin } from "../lib/auth.js";

const moderationQueueQuery = `
  SELECT
    'submission' AS type,
    s.id,
    s.created_at,
    s.payload,
    s.reason,
    e.id AS entity_id,
    e.name AS entity_name,
    u.id AS user_id,
    u.email AS user_email
  FROM submissions s
  INNER JOIN entities e ON e.id = s.entity_id
  INNER JOIN users u ON u.id = s.user_id
  WHERE s.status = 'pending'

  UNION ALL

  SELECT
    'claim' AS type,
    c.id,
    c.created_at,
    jsonb_build_object('proof', c.proof, 'notes', c.notes) AS payload,
    c.notes AS reason,
    e.id AS entity_id,
    e.name AS entity_name,
    u.id AS user_id,
    u.email AS user_email
  FROM claims c
  INNER JOIN entities e ON e.id = c.entity_id
  INNER JOIN users u ON u.id = c.user_id
  WHERE c.status = 'pending'

  ORDER BY created_at ASC
`;

const decisionBodySchema = z.object({
  type: z.enum(["submission", "claim"]),
  note: z.string().max(2_000).optional().default(""),
  trustUser: z.boolean().optional().default(false),
});

const moderationIdSchema = z.object({ id: z.string().uuid() });

export const moderationRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/moderation/queue", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) {
      return;
    }

    const result = await pool.query<{
      type: "submission" | "claim";
      id: string;
      created_at: string;
      payload: unknown;
      reason: string | null;
      entity_id: string;
      entity_name: string;
      user_id: string;
      user_email: string;
    }>(moderationQueueQuery);

    return reply.send({ queue: result.rows, moderator: admin.email });
  });

  app.post("/api/moderation/:id/approve", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) {
      return;
    }

    const parsedParams = moderationIdSchema.safeParse(request.params);
    const parsedBody = decisionBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.code(400).send({
        error: {
          params: parsedParams.success ? undefined : parsedParams.error.flatten(),
          body: parsedBody.success ? undefined : parsedBody.error.flatten(),
        },
      });
    }

    const targetId = parsedParams.data.id;
    const { type, note, trustUser } = parsedBody.data;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (type === "submission") {
        const submissionResult = await client.query<{
          id: string;
          entity_id: string;
          user_id: string;
          payload: { aiDisclosure?: unknown };
        }>(
          `
          UPDATE submissions
          SET status = 'approved', review_note = $2, reviewed_by = $3, reviewed_at = now()
          WHERE id = $1 AND status = 'pending'
          RETURNING id, entity_id, user_id, payload
          `,
          [targetId, note, admin.id],
        );

        const submission = submissionResult.rows[0];
        if (!submission) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ error: "Pending submission not found" });
        }

        const disclosure = (submission.payload as { aiDisclosure?: Record<string, unknown> }).aiDisclosure;
        if (!disclosure) {
          await client.query("ROLLBACK");
          return reply.code(400).send({ error: "Submission payload missing aiDisclosure" });
        }

        const usesAi = Boolean(disclosure.usesAi);
        const aiCategories = Array.isArray(disclosure.aiCategories)
          ? disclosure.aiCategories.map((item) => String(item))
          : [];
        const tools = Array.isArray(disclosure.tools)
          ? disclosure.tools.map((item) => String(item))
          : [];
        const humanLeadDescription = String(disclosure.humanLeadDescription ?? "");
        const techFreeZone = Boolean(disclosure.techFreeZone);
        const disclosureText = String(disclosure.disclosureText ?? "");

        await client.query(
          `
          INSERT INTO ai_disclosures (
            entity_id,
            uses_ai,
            ai_categories,
            tools,
            human_lead_description,
            tech_free_zone,
            disclosure_text,
            source,
            status,
            created_by,
            approved_by,
            approved_at
          )
          VALUES (
            $1,
            $2,
            $3::text[],
            $4::text[],
            $5,
            $6,
            $7,
            'submission',
            'approved',
            $8,
            $9,
            now()
          )
          ON CONFLICT (entity_id)
          DO UPDATE
            SET uses_ai = EXCLUDED.uses_ai,
                ai_categories = EXCLUDED.ai_categories,
                tools = EXCLUDED.tools,
                human_lead_description = EXCLUDED.human_lead_description,
                tech_free_zone = EXCLUDED.tech_free_zone,
                disclosure_text = EXCLUDED.disclosure_text,
                source = EXCLUDED.source,
                status = EXCLUDED.status,
                created_by = EXCLUDED.created_by,
                approved_by = EXCLUDED.approved_by,
                approved_at = EXCLUDED.approved_at
          `,
          [
            submission.entity_id,
            usesAi,
            aiCategories,
            tools,
            humanLeadDescription,
            techFreeZone,
            disclosureText,
            submission.user_id,
            admin.id,
          ],
        );
      }

      if (type === "claim") {
        const claimResult = await client.query<{
          id: string;
          entity_id: string;
          user_id: string;
        }>(
          `
          UPDATE claims
          SET status = 'approved', review_note = $2, reviewed_by = $3, reviewed_at = now()
          WHERE id = $1 AND status = 'pending'
          RETURNING id, entity_id, user_id
          `,
          [targetId, note, admin.id],
        );

        const claim = claimResult.rows[0];
        if (!claim) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ error: "Pending claim not found" });
        }

        await client.query(
          `UPDATE entities SET owner_user_id = $2 WHERE id = $1`,
          [claim.entity_id, claim.user_id],
        );

        if (trustUser) {
          await client.query(
            `UPDATE users SET trusted = true WHERE id = $1`,
            [claim.user_id],
          );
        }
      }

      await client.query(
        `
        INSERT INTO moderation_decisions (target_type, target_id, decision, note, moderator_id)
        VALUES ($1, $2, 'approved', $3, $4)
        `,
        [type, targetId, note, admin.id],
      );

      await client.query("COMMIT");
      return reply.send({ ok: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });

  app.post("/api/moderation/:id/reject", async (request, reply) => {
    const admin = await requireAdmin(request, reply);
    if (!admin) {
      return;
    }

    const parsedParams = moderationIdSchema.safeParse(request.params);
    const parsedBody = decisionBodySchema.safeParse(request.body);

    if (!parsedParams.success || !parsedBody.success) {
      return reply.code(400).send({
        error: {
          params: parsedParams.success ? undefined : parsedParams.error.flatten(),
          body: parsedBody.success ? undefined : parsedBody.error.flatten(),
        },
      });
    }

    const targetId = parsedParams.data.id;
    const { type, note } = parsedBody.data;

    const table = type === "submission" ? "submissions" : "claims";
    const result = await pool.query(
      `
      UPDATE ${table}
      SET status = 'rejected', review_note = $2, reviewed_by = $3, reviewed_at = now()
      WHERE id = $1 AND status = 'pending'
      RETURNING id
      `,
      [targetId, note, admin.id],
    );

    if (!result.rowCount) {
      return reply.code(404).send({ error: `Pending ${type} not found` });
    }

    await pool.query(
      `
      INSERT INTO moderation_decisions (target_type, target_id, decision, note, moderator_id)
      VALUES ($1, $2, 'rejected', $3, $4)
      `,
      [type, targetId, note, admin.id],
    );

    return reply.send({ ok: true });
  });
};
