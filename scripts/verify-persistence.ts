import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { clientFor, safeFailure } from "./database";
const id = randomUUID();
const first = clientFor();
try {
  await first.connect();
  await first.query("insert into audit_events (id, action, outcome, details) values ($1, $2, $3, $4::jsonb)", [id, "stage2.persistence_probe", "success", JSON.stringify({ testRecord: true, purpose: "New-connection persistence verification; no cloud metrics" })]);
} catch (error) { safeFailure("Persistence write", error); }
finally { await first.end(); }
if (!process.exitCode) {
  const second = clientFor();
  try {
    await second.connect();
    const { rows } = await second.query("select action, details from audit_events where id = $1", [id]);
    assert.equal(rows.length, 1); assert.equal(rows[0].details.testRecord, true);
    await assert.rejects(second.query("update audit_events set outcome = 'changed' where id = $1", [id]));
    await assert.rejects(second.query("delete from audit_events where id = $1", [id]));
    console.log("PASS: committed test audit record survived a new connection; audit update/delete rejected.");
  } catch (error) { safeFailure("Persistence verification", error); }
  finally { await second.end(); }
}
