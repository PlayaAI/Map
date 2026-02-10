import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { pool } from "../db.js";
import { verifyAuthToken } from "./auth-token.js";

export interface AuthUser {
  id: string;
  role: "user" | "admin";
  email: string;
}

export async function readAuthUser(request: FastifyRequest): Promise<AuthUser | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length);
  const parsed = verifyAuthToken(token, config.authTokenSecret);
  if (!parsed) {
    return null;
  }

  const userResult = await pool.query<{
    id: string;
    role: "user" | "admin";
    email: string;
  }>(
    "SELECT id, role, email FROM users WHERE id = $1",
    [parsed.sub],
  );

  if (!userResult.rowCount) {
    return null;
  }

  return userResult.rows[0] ?? null;
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthUser | undefined> {
  const user = await readAuthUser(request);
  if (!user) {
    reply.code(401).send({ error: "Authentication required" });
    return undefined;
  }
  return user;
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthUser | undefined> {
  const user = await requireAuth(request, reply);
  if (!user) {
    return undefined;
  }

  if (user.role !== "admin") {
    reply.code(403).send({ error: "Admin access required" });
    return undefined;
  }

  return user;
}
