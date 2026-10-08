import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditEvents, findings, imports, observations, resources } from "@/db/schema";
import { parseUpload, resourceIdentity, type Observation } from "./ingestion";
import { detectFindings, summarizeFindings } from "./detection";

export class ImportConflict extends Error {}
function evidenceWarnings(rows: Observation[], findingCount: number) {
  const warnings = ["Projections assume 720 hours at the observed rate. They are estimates, not guaranteed savings; commitments and retained storage may reduce actual savings."];
  if (!findingCount) warnings.push("No qualifying anomaly in this upload. Missing metrics, insufficient observation coverage, or normal utilization can prevent classification.");
  if (rows.some(row => row.currency !== "USD")) warnings.push("Consumption-spike classification is limited to USD. No currency conversion or USD threshold is applied to other currencies.");
  if (rows.some(row => !row.metadata.pricing_source)) warnings.push("Prices without an explicit pricing source are labeled uploaded log (unverified).");
  if (rows.some(row => row.cpu_percent === null || row.memory_percent === null)) warnings.push("Missing utilization is unknown and disables dependent compute rules.");
  warnings.push("Each import is analyzed using its supplied observations. Include the complete qualifying history in one file; overlapping observations from earlier imports are rejected.");
  return warnings;
}
export async function saveImport(text: string, format: "csv" | "json", filename: string, operatorId: string, explicitDemo: boolean) {
  const parsed = parseUpload(text, format);
  const detected = detectFindings(parsed.observations);
  const warnings = evidenceWarnings(parsed.observations, detected.length);
  const summaries = Object.entries(summarizeFindings(detected)).map(([currency, totals]) => ({ currency, avoidableWaste: totals.confirmedAvoidableWaste, potentialExcessSpend: totals.potentialSpikeExcess }));
  const fileHash = createHash("sha256").update(text).digest("hex");
  const uniqueRows = [...new Map(parsed.observations.map(row => [resourceIdentity(row), row])).values()].sort((a, b) => resourceIdentity(a).localeCompare(resourceIdentity(b)));
  return getDb().transaction(async tx => {
    // Serialize import commits, duplicate checks and headline estimate selection.
    await tx.execute(sql`select pg_advisory_xact_lock(710033)`);
    const [duplicate] = await tx.select().from(imports).where(or(eq(imports.contentHash, parsed.contentHash), eq(imports.fileHash, fileHash))).limit(1);
    if (duplicate) {
      const counts = await tx.select({ count: sql<number>`count(*)::int` }).from(findings).where(eq(findings.importId, duplicate.id));
      const resourceCounts = await tx.select({ count: sql<number>`count(distinct resource_id)::int` }).from(observations).where(eq(observations.importId, duplicate.id));
      return { importId: duplicate.id, duplicate: true, rowCount: duplicate.rowCount, resourceCount: resourceCounts[0].count, findingCount: counts[0].count, warnings: ["This content already exists. Returned the original persisted import without adding observations."] };
    }
    const [saved] = await tx.insert(imports).values({ operatorId, filename, fileHash, contentHash: parsed.contentHash, demo: explicitDemo || parsed.isDemo, status: "completed", rowCount: parsed.observations.length, warnings, summaries }).returning();
    const savedResources = await tx.insert(resources).values(uniqueRows.map(row => ({ provider: row.provider, accountScope: row.account_id, region: row.region, type: row.resource_type, externalId: row.resource_id, metadata: {} })))
      .onConflictDoUpdate({ target: [resources.provider, resources.accountScope, resources.region, resources.externalId], set: { externalId: sql`excluded.external_id` } }).returning();
    const byIdentity = new Map(savedResources.map(row => [JSON.stringify([row.provider, row.accountScope, row.region, row.externalId]), row]));
    for (const row of uniqueRows) if (byIdentity.get(resourceIdentity(row))?.type !== row.resource_type) throw new ImportConflict("A saved resource has a conflicting type. No import records were committed.");
    const intervals = parsed.observations.map(row => ({ resource_id: byIdentity.get(resourceIdentity(row))!.id, start_at: row.timestamp, end_at: new Date(Date.parse(row.timestamp) + row.interval_hours * 3600000).toISOString() }));
    const overlap = await tx.execute(sql`select o.id from observations o join jsonb_to_recordset(${JSON.stringify(intervals)}::jsonb) as n(resource_id uuid, start_at timestamptz, end_at timestamptz)
      on o.resource_id = n.resource_id and o.observed_at < n.end_at and o.observed_at + o.duration_seconds * interval '1 second' > n.start_at limit 1`);
    if (overlap.rows.length) throw new ImportConflict("This file overlaps previously saved observations. The complete import was rolled back; submit only a non-overlapping complete evidence window.");
    const rowsToSave = parsed.observations.map((row, index) => ({ importId: saved.id, resourceId: byIdentity.get(resourceIdentity(row))!.id,
      observedAt: new Date(row.timestamp), durationSeconds: Math.round(row.interval_hours * 3600), cpuPercent: row.cpu_percent === null ? null : String(row.cpu_percent), memoryPercent: row.memory_percent === null ? null : String(row.memory_percent),
      state: row.state, attachmentCount: row.attachment_count, hourlyRate: row.hourly_rate, intervalCost: row.interval_cost, currency: row.currency,
      rateSource: row.metadata.pricing_source ?? "uploaded log (unverified)", sourceRow: index + 1, rawEvidence: { original: row.raw, metadata: row.metadata },
    }));
    for (let start = 0; start < rowsToSave.length; start += 250) await tx.insert(observations).values(rowsToSave.slice(start, start + 250));
    const resourceIds = savedResources.map(row => row.id);
    const previousSelections = await tx.select({ id: findings.id, resourceId: findings.resourceId, windowEnd: findings.windowEnd }).from(findings).where(and(inArray(findings.resourceId, resourceIds), eq(findings.selectedForTotal, true)));
    // A historical upload must not replace a newer selected estimate.
    const latestPrevious = new Map(previousSelections.map(row => [row.resourceId, row.windowEnd.getTime()]));
    const selectedIdentities = new Set<string>();
    const candidateSelections = new Map<string, typeof detected[number]>();
    for (const row of detected) {
      if (row.impactKind !== "confirmed_avoidable_waste" || row.projectedImpact === null) continue;
      const candidate = candidateSelections.get(row.identityKey);
      if (!candidate || Date.parse(row.windowEnd) > Date.parse(candidate.windowEnd)) candidateSelections.set(row.identityKey, row);
    }
    const refreshedResources = [...candidateSelections].filter(([identity, row]) => Date.parse(row.windowEnd) >= (latestPrevious.get(byIdentity.get(identity)!.id) ?? 0)).map(([identity]) => byIdentity.get(identity)!.id);
    if (refreshedResources.length) await tx.update(findings).set({ selectedForTotal: false }).where(and(inArray(findings.resourceId, refreshedResources), eq(findings.selectedForTotal, true)));
    if (detected.length) await tx.insert(findings).values(detected.map(finding => {
      const resource = byIdentity.get(finding.identityKey)!;
      const selected = candidateSelections.get(finding.identityKey) === finding && refreshedResources.includes(resource.id) && !selectedIdentities.has(finding.identityKey);
      if (selected) selectedIdentities.add(finding.identityKey);
      const sourceRows = parsed.observations.map((row, index) => ({ row, index })).filter(({ row }) => resourceIdentity(row) === finding.identityKey && row.currency === finding.currency).map(({ index }) => index + 1);
      return { resourceId: resource.id, importId: saved.id, rule: finding.type, ruleVersion: finding.ruleVersion, parameters: finding.thresholds,
        evidence: { ...finding.evidence, exactOriginalResourceId: finding.resourceId, canonicalResourceId: resource.externalId, sourceRows, analysisScope: "this import" },
        windowStart: new Date(finding.windowStart), windowEnd: new Date(finding.windowEnd), severity: finding.severity, explanation: finding.explanation,
        costInputs: finding.financialInputs, projectedLeakage: finding.projectedImpact, currency: finding.currency,
        estimateCategory: finding.impactKind === "potential_spike_excess" ? "potential_excess_spend" : "avoidable_waste", selectedForTotal: selected, status: "open" as const };
    }));
    await tx.insert(auditEvents).values({ operatorId, importId: saved.id, action: "import.completed", nextState: "completed", outcome: "success", details: {
      rowCount: parsed.observations.length, resourceCount: savedResources.length, findingCount: detected.length, demo: saved.demo, contentHash: parsed.contentHash,
      previousSelectedFindingIds: previousSelections.filter(row => refreshedResources.includes(row.resourceId)).map(row => row.id), selectedResourceIds: refreshedResources,
    } });
    return { importId: saved.id, duplicate: false, rowCount: parsed.observations.length, resourceCount: savedResources.length, findingCount: detected.length, warnings };
  });
}
export async function listImports() {
  return getDb().select({ id: imports.id, filename: imports.filename, demo: imports.demo, status: imports.status, rowCount: imports.rowCount, createdAt: imports.createdAt }).from(imports).orderBy(desc(imports.createdAt)).limit(100);
}
async function readFindings(resourceId?: string, importId?: string) {
  return getDb().select({ id: findings.id, resourceId: findings.resourceId, externalId: resources.externalId, provider: resources.provider, rule: findings.rule, severity: findings.severity,
    explanation: findings.explanation, parameters: findings.parameters, evidence: findings.evidence, costInputs: findings.costInputs, projectedLeakage: findings.projectedLeakage,
    currency: findings.currency, estimateCategory: findings.estimateCategory, selectedForTotal: findings.selectedForTotal, status: findings.status, windowStart: findings.windowStart, windowEnd: findings.windowEnd })
    .from(findings).innerJoin(resources, eq(findings.resourceId, resources.id)).where(resourceId ? eq(findings.resourceId, resourceId) : eq(findings.importId, importId!)).orderBy(desc(findings.createdAt));
}
export async function getImportDetail(id: string) {
  const [entry] = await getDb().select().from(imports).where(eq(imports.id, id)).limit(1);
  if (!entry) return null;
  const [resourceRows, findingRows] = await Promise.all([
    getDb().selectDistinct({ id: resources.id, provider: resources.provider, accountScope: resources.accountScope, region: resources.region, type: resources.type, externalId: resources.externalId }).from(resources).innerJoin(observations, eq(observations.resourceId, resources.id)).where(eq(observations.importId, id)),
    readFindings(undefined, id),
  ]);
  return { import: { id: entry.id, filename: entry.filename, demo: entry.demo, status: entry.status, rowCount: entry.rowCount, createdAt: entry.createdAt }, resources: resourceRows, findings: findingRows, summaries: entry.summaries, warnings: entry.warnings };
}
export async function getResourceDetail(id: string) {
  const [resource] = await getDb().select({ id: resources.id, provider: resources.provider, accountScope: resources.accountScope, region: resources.region, type: resources.type, externalId: resources.externalId }).from(resources).where(eq(resources.id, id)).limit(1);
  if (!resource) return null;
  const [observationRows, findingRows, counts] = await Promise.all([
    getDb().select().from(observations).where(eq(observations.resourceId, id)).orderBy(desc(observations.observedAt)).limit(100), readFindings(id),
    getDb().select({ count: sql<number>`count(*)::int` }).from(observations).where(eq(observations.resourceId, id)),
  ]);
  return { resource, observations: observationRows, observationCount: counts[0].count, findings: findingRows };
}
