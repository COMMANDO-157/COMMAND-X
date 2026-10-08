import { z } from "zod";
import { currentOperator } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getImportDetail } from "@/lib/import-store";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!await currentOperator()) return jsonError("Authentication required.", 401);
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return jsonError("Invalid import identifier.", 400);
    const result = await getImportDetail(id);
    return result ? Response.json(result, { headers: { "Cache-Control": "no-store" } }) : jsonError("Import not found.", 404);
  } catch { return jsonError("Import results are temporarily unavailable.", 503); }
}
