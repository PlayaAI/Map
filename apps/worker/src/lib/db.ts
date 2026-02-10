import { Pool } from "pg";

export function createDbPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl });
}
