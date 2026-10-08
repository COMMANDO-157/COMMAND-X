import { loadEnvFile } from "node:process";
import { Client } from "pg";
try { loadEnvFile(".env.local"); } catch { /* CI uses injected environment. */ }
export function clientFor(admin = false) {
  const connectionString = admin ? process.env.DATABASE_ADMIN_URL : process.env.DATABASE_URL;
  if (!connectionString) throw new Error(admin ? "DATABASE_ADMIN_URL is missing" : "DATABASE_URL is missing");
  const url = new URL(connectionString);
  if (url.searchParams.get("sslmode") !== "verify-full") throw new Error("Verified TLS is required");
  return new Client({ connectionString, connectionTimeoutMillis: 10000, statement_timeout: 15000 });
}
export function safeFailure(label: string, error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unavailable";
  console.error(`${label} failed (code: ${code}). No credential values were logged.`);
  process.exitCode = 1;
}
