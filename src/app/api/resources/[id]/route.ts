import { z } from "zod";
import { currentOperator } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getResourceDetail } from "@/lib/import-store";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!await currentOperator()) return jsonError("Authentication required.", 401);
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return jsonError("Invalid resource identifier.", 400);
    const result = await getResourceDetail(id);
    return result ? Response.json(result, { headers: { "Cache-Control": "no-store" } }) : jsonError("Resource not found.", 404);
  } catch { return jsonError("Resource evidence is temporarily unavailable.", 503); }
}
