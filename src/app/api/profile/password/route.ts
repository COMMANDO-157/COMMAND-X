import { cookies } from "next/headers";
import { z } from "zod";
import { COOKIE_NAME, cookieOptions, currentOperator } from "@/lib/auth";
import { boundedJson, checkOrigin, jsonError } from "@/lib/http";
import { changePassword } from "@/lib/profile";

export const runtime = "nodejs";
const input = z.object({ currentPassword: z.string().min(1).max(256), newPassword: z.string().min(12).max(256) }).strict();

export async function POST(request: Request) {
  if (!checkOrigin(request)) return jsonError("Request origin denied.", 403);
  let body;
  try { body = input.parse(await boundedJson(request)); }
  catch { return jsonError("Enter your current password and a new password of 12–256 characters.", 400); }
  try {
    const operator = await currentOperator();
    if (!operator) return jsonError("Authentication required.", 401);
    const result = await changePassword(operator, body.currentPassword, body.newPassword);
    if (result === "weak") return jsonError("Use 12–256 characters and at least three of: lowercase, uppercase, numbers, symbols.", 400);
    if (result === "rate_limited") return Response.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429, headers: { "Retry-After": "900", "Cache-Control": "no-store" } });
    if (result === "session_expired") return jsonError("Session expired. Sign in again.", 401);
    if (result === "invalid") return jsonError("Current password is incorrect.", 401);
    if (result === "same") return jsonError("Choose a different new password.", 400);
    (await cookies()).set(COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
    return Response.json({ changed: true, signedOut: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return jsonError("Password could not be changed. Try again.", 503);
  }
}
