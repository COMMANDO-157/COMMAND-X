import test from "node:test";
import assert from "node:assert/strict";
import { readUpload } from "../src/lib/upload-request";
function upload(file: File, other?: string) {
  const form = new FormData(); form.set("file", file); if (other) form.set("extra", other);
  return new Request("http://localhost/api/imports", { method: "POST", body: form });
}
test("multipart reads the exact file and explicit demo marker", async () => {
  const form = new FormData(); form.set("file", new File(["[]"], "demo.json")); form.set("demo", "true");
  const result = await readUpload(new Request("http://localhost/api/imports", { method: "POST", body: form }));
  assert.equal(result.format, "json"); assert.equal(result.text, "[]"); assert.equal(result.explicitDemo, true);
});
test("multipart rejects excess size, invalid UTF8, extra fields and unsafe filenames", async () => {
  await assert.rejects(readUpload(upload(new File(["x".repeat(2097153)], "large.csv"))));
  await assert.rejects(readUpload(upload(new File([new Uint8Array([255])], "bad.json"))));
  await assert.rejects(readUpload(upload(new File(["[]"], "file.json"), "unexpected")));
  await assert.rejects(readUpload(upload(new File(["[]"], "bad.txt"))));
  await assert.rejects(readUpload(new Request("http://localhost/api/imports", { method: "POST", body: "[]" })));
});
