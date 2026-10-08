import { currentOperator } from "@/lib/auth";
import { checkOrigin, jsonError } from "@/lib/http";
import { ImportConflict, listImports, saveImport } from "@/lib/import-store";
import { readUpload, UploadRequestError } from "@/lib/upload-request";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  try {
    if (!await currentOperator()) return jsonError("Authentication required.", 401);
    return Response.json({ imports: await listImports() }, { headers: { "Cache-Control": "no-store" } });
  } catch { return jsonError("Saved imports are temporarily unavailable.", 503); }
}
export async function POST(request: Request) {
  let operator;
  try { operator = await currentOperator(); } catch { return jsonError("Operator access is unavailable.", 503); }
  if (!operator) return jsonError("Authentication required.", 401);
  if (!checkOrigin(request)) return jsonError("Request origin denied.", 403);
  try {
    const upload = await readUpload(request);
    const result = await saveImport(upload.text, upload.format, upload.filename, operator.id, upload.explicitDemo);
    return Response.json(result, { status: result.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ImportConflict) return jsonError(error.message, 409);
    if (error instanceof UploadRequestError) return jsonError(error.message, error.status);
    // Parser errors occur before database work. Driver/ORM failures are never
    // returned verbatim because their context can contain uploaded evidence.
    const databaseError = error && typeof error === "object" && ("query" in error || "code" in error || "cause" in error);
    if (databaseError) return jsonError("Import could not be committed. No partial records were saved; please try again.", 503);
    const message = error instanceof SyntaxError ? "Malformed JSON or CSV metadata." : error instanceof Error ? error.message.slice(0, 1000) : "Invalid uploaded file.";
    const row = message.match(/^Observation (\d+): ([\s\S]*)/);
    return Response.json({ error: "Upload validation failed. No records were saved.", issues: [{ ...(row ? { row: Number(row[1]) } : {}), message: row ? row[2] : message }] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
