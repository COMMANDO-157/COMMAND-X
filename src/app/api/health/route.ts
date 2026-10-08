export async function GET() {
  return Response.json({ application: "CloudSentry", stage: "ingestion-intelligence", status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
