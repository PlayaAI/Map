import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { pool } from "./db.js";
import { authRoutes } from "./routes/auth.js";
import { moderationRoutes } from "./routes/moderation.js";
import { participationRoutes } from "./routes/participation.js";
import { publicRoutes } from "./routes/public.js";

async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });

  await app.register(publicRoutes);
  await app.register(authRoutes);
  await app.register(participationRoutes);
  await app.register(moderationRoutes);

  app.addHook("onClose", async () => {
    await pool.end();
  });

  return app;
}

async function main() {
  const app = await buildServer();
  await app.listen({
    port: config.port,
    host: "0.0.0.0",
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
