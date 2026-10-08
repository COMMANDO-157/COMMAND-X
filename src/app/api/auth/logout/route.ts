import { cookies } from "next/headers";
import { COOKIE_NAME, cookieOptions, currentOperator, logoutOperator } from "@/lib/auth";
import { checkOrigin, jsonError } from "@/lib/http";
export async function POST(request: Request) {
  if (!checkOrigin(request)) return jsonError("Request origin denied.", 403);
  try {
    const operator = await currentOperator();
    if (!operator) return jsonError("Authentication required.", 401);
    await logoutOperator(operator);
    (await cookies()).set(COOKIE_NAME, "", { ...cookieOptions, maxAge: 0 });
    return Response.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  } catch { return jsonError("Sign out could not be persisted. Try again.", 503); }
}
