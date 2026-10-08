import { cookies } from "next/headers";
import { z } from "zod";
import { COOKIE_NAME, cookieOptions, loginOperator } from "@/lib/auth";
import { boundedJson, checkOrigin, jsonError } from "@/lib/http";
export const runtime = "nodejs";
const input = z.object({ login: z.string().trim().toLowerCase().min(1).max(80), password: z.string().min(1).max(256) }).strict();
export async function POST(request: Request) {
  if (!checkOrigin(request)) return jsonError("Request origin denied.", 403);
  let credentials;
  try { credentials = input.parse(await boundedJson(request)); }
  catch { return jsonError("Enter a valid operator login and password.", 400); }
  try {
    const cookie = await loginOperator(credentials.login, credentials.password);
    if (!cookie) return jsonError("Invalid operator credentials.", 401);
    (await cookies()).set(COOKIE_NAME, cookie, cookieOptions);
    return Response.json({ authenticated: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "LOGIN_RATE_LIMIT") {
      return Response.json({ error: "Login attempt limit reached. Try again in 15 minutes." }, { status: 429, headers: { "Retry-After": "900", "Cache-Control": "no-store" } });
    }
    console.error("Operator login unavailable", { code: error && typeof error === "object" && "code" in error ? String(error.code) : "CONFIG_OR_CONNECTION" });
    return jsonError("Operator access is unavailable. Check the server configuration.", 503);
  }
}
