import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditEvents, findings, imports, observations, resources } from "@/db/schema";
import { knowledgeAnswer, resourceIdIn } from "./assistant-knowledge";
import { decimalString, decimalUnits } from "./ingestion";

const money = (amount: string | null, currency: string) => amount === null ? "unpriced" : `${currency} ${amount}`;
const clean = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : null;

export async function answerAssistant(question: string, operatorId: string) {
  const q = question.trim();
  const resourceId = resourceIdIn(q);
  const db = getDb();
  if (resourceId) {
    const matches = await db.selectDistinct({ id: resources.id, externalId: resources.externalId, provider: resources.provider, accountScope: resources.accountScope, region: resources.region, type: resources.type })
      .from(resources).innerJoin(observations, eq(observations.resourceId, resources.id)).innerJoin(imports, eq(observations.importId, imports.id))
      .where(and(eq(resources.externalId, resourceId), eq(imports.operatorId, operatorId))).limit(4);
    if (!matches.length) return `I could not find resource ID ${resourceId} in your authorized uploaded records. Check the exact ID, then upload or inspect its observations.`;
    const lines = await Promise.all(matches.map(async (resource) => {
      const rows = await db.select({ rule: findings.rule, explanation: findings.explanation, estimate: findings.projectedLeakage, currency: findings.currency, category: findings.estimateCategory, status: findings.status, evidence: findings.evidence, costInputs: findings.costInputs, demo: imports.demo })
        .from(findings).innerJoin(imports, eq(findings.importId, imports.id))
        .where(and(eq(findings.resourceId, resource.id), eq(imports.operatorId, operatorId)))
        .orderBy(desc(findings.createdAt)).limit(5);
      const header = `${resource.externalId}: ${resource.provider.toUpperCase()} ${resource.type.replaceAll("_", " ")} in account ${resource.accountScope}, region ${resource.region}.`;
      if (!rows.length) return `${header} No finding is stored for this resource.`;
      const details = rows.map(f => {
        const inputs = f.costInputs && typeof f.costInputs === "object" ? f.costInputs as Record<string, unknown> : {};
        const basis = ["baselineHourlyCost", "latestHourlyCost", "excessHourlyCost", "currentHourlyRate", "replacementHourlyRate"]
          .map(key => clean(inputs[key]) ? `${key}: ${clean(inputs[key])}` : null).filter(Boolean).join(", ");
        return `${f.demo ? "DEMO — " : ""}${f.rule.replaceAll("_", " ")} (${f.status}): ${f.explanation} 30-day ${f.category === "potential_excess_spend" ? "potential excess" : "avoidable-waste estimate"}: ${money(f.estimate, f.currency)}.${basis ? ` Stored cost inputs: ${basis}.` : ""}`;
      });
      return [header, ...details].join("\n");
    }));
    return lines.join("\n\n");
  }
  if (/recent|audit|activity|decision|approval|simulation/.test(q.toLowerCase()) && /my|saved|recent|audit|activity/.test(q.toLowerCase())) {
    const events = await db.select({ action: auditEvents.action, outcome: auditEvents.outcome, createdAt: auditEvents.createdAt, simulation: auditEvents.simulation })
      .from(auditEvents).where(eq(auditEvents.operatorId, operatorId)).orderBy(desc(auditEvents.createdAt)).limit(8);
    return events.length ? `Your latest saved audit activity:\n${events.map(e => `${e.createdAt.toISOString()}: ${e.action.replaceAll("_", " ")} (${e.outcome}${e.simulation ? ", simulation" : ""})`).join("\n")}` : "You have no saved audit activity yet.";
  }
  if (/my|saved|current|total|count|import|finding|resource/.test(q.toLowerCase())) {
    const [importRows, resourceRows, findingRows] = await Promise.all([
      db.select({ id: imports.id, filename: imports.filename, demo: imports.demo, rowCount: imports.rowCount, createdAt: imports.createdAt }).from(imports).where(eq(imports.operatorId, operatorId)).orderBy(desc(imports.createdAt)).limit(10),
      db.selectDistinct({ id: resources.id }).from(resources).innerJoin(observations, eq(observations.resourceId, resources.id)).innerJoin(imports, eq(observations.importId, imports.id)).where(eq(imports.operatorId, operatorId)).limit(1001),
      db.select({ id: findings.id, resourceId: findings.resourceId, rule: findings.rule, estimate: findings.projectedLeakage, currency: findings.currency, category: findings.estimateCategory, selectedForTotal: findings.selectedForTotal, status: findings.status }).from(findings).innerJoin(imports, eq(findings.importId, imports.id)).where(eq(imports.operatorId, operatorId)).orderBy(desc(findings.createdAt)).limit(1001),
    ]);
    if (!importRows.length) return "You have no saved imports yet. Upload a CSV or JSON log to create resource and finding records.";
    const byCurrency = new Map<string, { waste: bigint; spike: bigint }>();
    const countedSpikes = new Set<string>();
    for (const f of findingRows) {
      if (f.status === "dismissed" || f.estimate === null) continue;
      const spike = f.category === "potential_excess_spend";
      const identity = `${f.resourceId}:${f.currency}`;
      if (spike && countedSpikes.has(identity)) continue;
      if (!spike && !f.selectedForTotal) continue;
      const sums = byCurrency.get(f.currency) ?? { waste: BigInt(0), spike: BigInt(0) };
      if (spike) { sums.spike += decimalUnits(f.estimate); countedSpikes.add(identity); }
      else sums.waste += decimalUnits(f.estimate);
      byCurrency.set(f.currency, sums);
    }
    const totals = [...byCurrency].map(([currency, x]) => `${currency}: avoidable-waste estimates ${decimalString(x.waste)}, potential spike excess ${decimalString(x.spike)}`).join("; ");
    return `Your saved records include ${importRows.length}${importRows.length === 10 ? "+" : ""} recent imports, ${resourceRows.length}${resourceRows.length === 1001 ? "+" : ""} resources, and ${findingRows.length}${findingRows.length === 1001 ? "+" : ""} findings. ${totals || "No priced findings."} These are projections, not realized savings. Latest import: ${importRows[0].filename} (${importRows[0].rowCount} rows${importRows[0].demo ? ", DEMO" : ""}).${findingRows.length === 1001 ? " Finding totals are limited to the most recent 1,001 records." : ""}`;
  }
  return knowledgeAnswer(q) ?? "I can explain CloudSentry, the four rules, costs, remediation, your saved data, recent audit activity, or an exact resource ID. I cannot take actions or answer beyond the stored evidence.";
}
