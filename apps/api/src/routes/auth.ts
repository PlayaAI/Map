import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { config } from "../config.js";
import { pool } from "../db.js";
import { createAuthToken } from "../lib/auth-token.js";
import { generateOtpCode, hashOtpCode } from "../lib/otp.js";

const requestOtpSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
});

const verifyOtpSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  code: z.string().regex(/^\d{6}$/),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/auth/request-otp", async (request, reply) => {
    const parsed = requestOtpSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const email = parsed.data.email;
    const role = config.adminEmails.includes(email) ? "admin" : "user";

    const userResult = await pool.query<{ id: string; email: string; role: "user" | "admin" }>(
      `
      INSERT INTO users (email, role)
      VALUES ($1, $2)
      ON CONFLICT (email)
      DO UPDATE SET role = EXCLUDED.role
      RETURNING id, email, role
      `,
      [email, role],
    );

    const user = userResult.rows[0];
    if (!user) {
      return reply.code(500).send({ error: "Failed to create user" });
    }

    const code = generateOtpCode();
    const codeHash = hashOtpCode(code, config.otpSalt);
    const expiresAt = new Date(Date.now() + config.otpTtlMinutes * 60_000);

    await pool.query(
      `
      INSERT INTO otp_codes (user_id, code_hash, expires_at)
      VALUES ($1, $2, $3)
      `,
      [user.id, codeHash, expiresAt.toISOString()],
    );

    request.log.info({ email, code }, "Generated OTP code");

    return reply.send({
      ok: true,
      expiresAt: expiresAt.toISOString(),
      debugCode: config.allowDebugOtp ? code : undefined,
    });
  });

  app.post("/api/auth/verify-otp", async (request, reply) => {
    const parsed = verifyOtpSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const email = parsed.data.email;
    const codeHash = hashOtpCode(parsed.data.code, config.otpSalt);

    const userResult = await pool.query<{
      id: string;
      email: string;
      role: "user" | "admin";
    }>(
      "SELECT id, email, role FROM users WHERE email = $1",
      [email],
    );

    const user = userResult.rows[0];
    if (!user) {
      return reply.code(401).send({ error: "Invalid OTP" });
    }

    const otpResult = await pool.query<{ id: string }>(
      `
      SELECT id
      FROM otp_codes
      WHERE user_id = $1
        AND code_hash = $2
        AND consumed_at IS NULL
        AND expires_at > now()
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [user.id, codeHash],
    );

    const otp = otpResult.rows[0];
    if (!otp) {
      return reply.code(401).send({ error: "Invalid OTP" });
    }

    await pool.query("UPDATE otp_codes SET consumed_at = now() WHERE id = $1", [otp.id]);
    await pool.query("UPDATE users SET email_verified_at = now() WHERE id = $1", [user.id]);

    const token = createAuthToken(
      { id: user.id, role: user.role, email: user.email },
      config.authTokenSecret,
    );

    return reply.send({ token, user });
  });
};
