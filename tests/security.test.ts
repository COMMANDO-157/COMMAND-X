import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword, createSessionToken, readSessionToken, isSameOrigin, strongPassword } from "../src/lib/security";

test("password change rejects weak and unchanged choices", async () => {
  assert.equal(strongPassword("short"), false);
  assert.equal(strongPassword("onlylowercaseletters"), false);
  assert.equal(strongPassword("StrongEnough9!"), true);
  assert.equal(strongPassword("a".repeat(257) + "9!"), false);
  const existing = await hashPassword("StrongEnough9!");
  assert.equal(await verifyPassword("WrongCurrent9!", existing), false);
  assert.equal(await verifyPassword("StrongEnough9!", existing), true);
});
test("password hashes are salted and reject wrong or malformed credentials", async () => {
  const password = randomBytes(24).toString("base64url");
  const first = await hashPassword(password); const second = await hashPassword(password);
  assert.notEqual(first, second); assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("wrong-password", first), false);
  assert.equal(await verifyPassword(password, "malformed"), false);
  await assert.rejects(hashPassword("short"));
});
test("session signature prevents tampering and secret rotation invalidates cookies", () => {
  const secret = randomBytes(32).toString("base64url");
  const session = createSessionToken(secret);
  assert.equal(readSessionToken(session.cookie, secret), session.hash);
  const changed = (session.cookie[0] === "a" ? "b" : "a") + session.cookie.slice(1);
  assert.equal(readSessionToken(changed, secret), null);
  assert.equal(readSessionToken(session.cookie, randomBytes(32).toString("base64url")), null);
  assert.equal(readSessionToken("malformed", secret), null);
  assert.throws(() => createSessionToken("short"));
});
test("mutations require the exact configured origin", () => {
  assert.equal(isSameOrigin("https://cloudsentry.example", "https://cloudsentry.example"), true);
  assert.equal(isSameOrigin("https://cloudsentry.example.evil.test", "https://cloudsentry.example"), false);
  assert.equal(isSameOrigin(null, "https://cloudsentry.example"), false);
  assert.equal(isSameOrigin("https://cloudsentry.example", undefined), false);
});
