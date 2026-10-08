import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
const parameters = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, parameters, (error, key) => error ? reject(error) : resolve(key));
});
export function strongPassword(value: string) {
  if (value.length < 12 || value.length > 256) return false;
  const groups = [/[a-z]/.test(value), /[A-Z]/.test(value), /[0-9]/.test(value), /[^A-Za-z0-9]/.test(value)];
  return groups.filter(Boolean).length >= 3;
}
export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 256) throw new Error("PASSWORD_LENGTH");
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt);
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, expected] = stored.split(":");
  if (algorithm !== "scrypt" || !/^[a-f0-9]{32}$/.test(salt ?? "") || !/^[a-f0-9]{128}$/.test(expected ?? "") || password.length > 256) return false;
  const key = await derive(password, salt);
  return timingSafeEqual(key, Buffer.from(expected, "hex"));
}
export function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
function signature(token: string, secret: string) {
  if (secret.length < 43) throw new Error("SESSION_SECRET_UNCONFIGURED");
  return createHmac("sha256", secret).update(token).digest("hex");
}
export function createSessionToken(secret: string) {
  const token = randomBytes(32).toString("hex");
  return { cookie: `${token}.${signature(token, secret)}`, hash: tokenHash(token) };
}
export function readSessionToken(cookie: string, secret: string) {
  if (!/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(cookie)) return null;
  const [token, supplied] = cookie.split(".");
  return timingSafeEqual(Buffer.from(signature(token, secret), "hex"), Buffer.from(supplied, "hex")) ? tokenHash(token) : null;
}
export function isSameOrigin(origin: string | null, configured: string | undefined) {
  if (!origin || !configured) return false;
  try { return origin === new URL(configured).origin; } catch { return false; }
}
