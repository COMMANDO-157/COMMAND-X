import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./database";
const base = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const credentials = readFileSync("credentials.local.txt", "utf8");
const login = credentials.match(/^Login: (.+)$/m)?.[1];
const password = credentials.match(/^Password: (.+)$/m)?.[1];
if (!login || !password) throw new Error("Local operator credentials unavailable");
const post = (path: string, payload?: unknown, cookie?: string, origin = base) => fetch(`${base}${path}`, {
  method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
  ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
});
assert.equal((await fetch(`${base}/api/health`)).status, 200);
assert.equal((await fetch(`${base}/api/operator`)).status, 401);
const deniedPage = await fetch(`${base}/console`, { redirect: "manual" });
assert.equal(deniedPage.status, 307); assert.equal(new URL(deniedPage.headers.get("location")!, base).pathname, "/login");
assert.equal((await post("/api/auth/login", { login, password }, undefined, "https://untrusted.example")).status, 403);
assert.equal((await post("/api/auth/login", { login })).status, 400);
assert.equal((await post("/api/auth/login", { login, password: "deliberately-wrong" })).status, 401);
const signedIn = await post("/api/auth/login", { login, password });
assert.equal(signedIn.status, 200);
const setCookie = signedIn.headers.get("set-cookie")!;
assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /SameSite=Strict/i);
if (base.startsWith("https:")) assert.match(setCookie, /Secure/i);
const cookie = setCookie.split(";")[0];
const authenticated = await fetch(`${base}/api/operator`, { headers: { Cookie: cookie } });
assert.equal(authenticated.status, 200); assert.equal((await authenticated.json()).operator.login, login);
assert.equal((await fetch(`${base}/console`, { headers: { Cookie: cookie }, redirect: "manual" })).status, 200);
assert.equal((await post("/api/auth/logout", undefined, cookie, "https://untrusted.example")).status, 403);
assert.equal((await post("/api/auth/logout", undefined, cookie)).status, 200);
assert.equal((await fetch(`${base}/api/operator`, { headers: { Cookie: cookie } })).status, 401);
console.log("PASS: health, protected page/API, origin protection, validation, wrong password, successful database-backed login, console, persisted logout and session revocation.");
