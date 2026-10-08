import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import * as schema from "./schema";

function createDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_UNCONFIGURED");
  const url = new URL(connectionString);
  if (process.env.NODE_ENV === "production" && url.searchParams.get("sslmode") !== "verify-full") {
    throw new Error("DATABASE_TLS_REQUIRED");
  }
  const pool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000, statement_timeout: 10000 });
  if (process.env.VERCEL) attachDatabasePool(pool);
  return drizzle(pool, { schema });
}
let db: ReturnType<typeof createDb> | undefined;
export function getDb() { return db ??= createDb(); }
