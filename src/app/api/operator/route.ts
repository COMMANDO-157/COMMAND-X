import { currentOperator } from "@/lib/auth";
import { jsonError } from "@/lib/http";
export async function GET() {
  try {
    const operator = await currentOperator();
    if (!operator) return jsonError("Authentication required.", 401);
    return Response.json({ operator: { id: operator.id, login: operator.login } }, { headers: { "Cache-Control": "no-store" } });
  } catch { return jsonError("Operator access unavailable.", 503); }
}
