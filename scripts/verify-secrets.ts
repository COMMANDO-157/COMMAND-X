import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import "./database";
const secrets = [process.env.SESSION_SECRET, process.env.DATABASE_URL, process.env.DATABASE_ADMIN_URL, process.env.VERCEL_OIDC_TOKEN];
for (const name of ["DATABASE_URL", "DATABASE_ADMIN_URL"]) {
  const value = process.env[name]; if (value) secrets.push(decodeURIComponent(new URL(value).password));
}
const credentials = readFileSync("credentials.local.txt", "utf8");
secrets.push(credentials.match(/^Password: (.+)$/m)?.[1]);
const needles = secrets.filter((v): v is string => !!v && v.length >= 16);
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => { const path = join(dir, name); return statSync(path).isDirectory() ? files(path) : [path]; });
}
const targets = [...files("src"), ...files("scripts"), ...files("tests"), ...files("drizzle"), ...files(".next/static")];
const found = targets.filter((path) => { const text = readFileSync(path, "utf8"); return needles.some((secret) => text.includes(secret)); });
if (found.length) { console.error("Secret exposure detected in files:", found); process.exitCode = 1; }
else console.log(`PASS: no configured secret values found in ${targets.length} source, migration, test, or browser-bundle files.`);
