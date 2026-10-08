import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { clientFor, safeFailure } from "./database";
import { hashPassword } from "../src/lib/security";
const client = clientFor(true);
try {
  await client.connect();
  const role = "cloudsentry_app";
  const existing = await client.query("select 1 from pg_roles where rolname = $1", [role]);
  if (existing.rowCount) throw new Error("Runtime role already exists; preserve its credentials and configure manually.");
  if (existsSync("credentials.local.txt")) throw new Error("Local credentials already exist; preserve them.");
  const runtimePassword = randomBytes(32).toString("base64url");
  const operatorPassword = randomBytes(24).toString("base64url");
  const passwordHash = await hashPassword(operatorPassword);
  const secret = randomBytes(32).toString("base64url");
  await client.query("BEGIN");
  const formatted = await client.query("select format('CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', $1::text, $2::text) as statement", [role, runtimePassword]);
  await client.query(formatted.rows[0].statement);
  await client.query("GRANT USAGE ON SCHEMA public TO cloudsentry_app");
  await client.query("GRANT SELECT ON ALL TABLES IN SCHEMA public TO cloudsentry_app");
  await client.query("GRANT INSERT ON audit_events, auth_attempts, sessions, imports, resources, observations, findings, remediations, decisions TO cloudsentry_app");
  await client.query("GRANT UPDATE ON imports, resources, findings, remediations TO cloudsentry_app");
  await client.query("GRANT UPDATE (password_hash) ON operators TO cloudsentry_app");
  await client.query("GRANT DELETE ON sessions, auth_attempts TO cloudsentry_app");
  const operator = await client.query("insert into operators (login, password_hash) values ('captain', $1) returning id", [passwordHash]);
  await client.query("insert into audit_events (operator_id, action, next_state, outcome) values ($1, 'operator.created', 'enabled', 'success')", [operator.rows[0].id]);
  await client.query("COMMIT");
  const appUrl = new URL(process.env.DATABASE_URL!);
  appUrl.username = role; appUrl.password = runtimePassword;
  writeFileSync(".env.local", `DATABASE_URL=${appUrl.toString()}\nDATABASE_ADMIN_URL=${process.env.DATABASE_ADMIN_URL}\nSESSION_SECRET=${secret}\nAPP_ORIGIN=http://localhost:3000\n`, { mode: 0o600 });
  writeFileSync("credentials.local.txt", `CloudSentry initial operator credentials — PRIVATE, LOCAL ONLY\nLogin: captain\nPassword: ${operatorPassword}\nDo not commit or upload this file.\n`, { mode: 0o600, flag: "wx" });
  console.log("Configured restricted runtime role, operator, and local session secret. Credentials saved only to ignored local files.");
} catch (error) { await client.query("ROLLBACK").catch(() => {}); safeFailure("Local configuration", error); }
finally { await client.end(); }
