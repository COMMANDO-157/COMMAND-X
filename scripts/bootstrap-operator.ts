import { clientFor, safeFailure } from "./database";
import { hashPassword } from "../src/lib/security";
const login = process.env.OPERATOR_LOGIN?.trim().toLowerCase();
const password = process.env.OPERATOR_BOOTSTRAP_PASSWORD;
if (!login || !/^[a-z0-9._-]{1,80}$/.test(login) || !password) throw new Error("Provide OPERATOR_LOGIN and OPERATOR_BOOTSTRAP_PASSWORD securely in process environment.");
const hash = await hashPassword(password);
delete process.env.OPERATOR_BOOTSTRAP_PASSWORD;
const client = clientFor(true);
try {
  await client.connect(); await client.query("BEGIN");
  const { rows } = await client.query("insert into operators (login, password_hash) values ($1, $2) returning id", [login, hash]);
  await client.query("insert into audit_events (operator_id, action, next_state, outcome) values ($1, 'operator.created', 'enabled', 'success')", [rows[0].id]);
  await client.query("COMMIT"); console.log("Operator created. Credentials were not logged.");
} catch (error) { await client.query("ROLLBACK").catch(() => {}); safeFailure("Operator setup", error); }
finally { await client.end(); }
