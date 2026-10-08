import { currentOperator } from "@/lib/auth";
import { getDashboard } from "@/lib/dashboard-store";
import { jsonError } from "@/lib/http";
export async function GET() {
  try {
    if (!await currentOperator()) return jsonError("Authentication required.", 401);
    return Response.json(await getDashboard(), { headers: { "Cache-Control": "no-store" } });
  } catch { return jsonError("Dashboard records are temporarily unavailable.", 503); }
}
