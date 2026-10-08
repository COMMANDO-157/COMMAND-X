export async function GET() {
  return Response.json({ application: "CloudSentry", stage: "foundation", status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
