import { MAX_UPLOAD_BYTES } from "./ingestion";
export class UploadRequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function readUpload(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data;")) throw new UploadRequestError("Upload a CSV or JSON file as multipart form data.");
  const limit = MAX_UPLOAD_BYTES + 65536;
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new UploadRequestError("Upload exceeds the 2 MiB file limit.", 413);
  if (!request.body) throw new UploadRequestError("Choose a nonempty CSV or JSON file.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const next = await reader.read(); if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new UploadRequestError("Upload exceeds the 2 MiB file limit.", 413); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  let form: FormData;
  try { form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": type } }).formData(); }
  catch { throw new UploadRequestError("Malformed multipart upload."); }
  if ([...form.keys()].some(key => !["file", "demo"].includes(key)) || form.getAll("file").length !== 1 || form.getAll("demo").length > 1) throw new UploadRequestError("Provide exactly one file and an optional DEMO flag.");
  const file = form.get("file"); const demo = form.get("demo");
  if (!(file instanceof File) || !file.size) throw new UploadRequestError("Choose a nonempty CSV or JSON file.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadRequestError("Upload exceeds the 2 MiB file limit.", 413);
  if (demo !== null && demo !== "true" && demo !== "false") throw new UploadRequestError("Invalid DEMO flag.");
  if (!/^[^/\\]{1,156}\.(csv|json)$/i.test(file.name) || [...file.name].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) throw new UploadRequestError("Use a safe filename ending in .csv or .json (160 characters maximum).");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()); }
  catch { throw new UploadRequestError("The file must contain valid UTF-8 text."); }
  return { filename: file.name, format: file.name.toLowerCase().endsWith(".csv") ? "csv" as const : "json" as const, text, explicitDemo: demo === "true" };
}
