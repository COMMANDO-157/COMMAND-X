import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditEvents, findings, remediations, resources } from "@/db/schema";
import { decimalString, decimalUnits } from "./ingestion";

export async function getDashboard() {
  const db = getDb();
  const [countResult, resourceRows, findingRows, remediationRows, auditRows] = await Promise.all([
    db.execute(sql`select (select count(*)::int from resources) as resources,
      (select count(*)::int from imports) as imports,
      (select count(*)::int from observations) as observations,
      (select count(*)::int from findings) as findings,
      (select count(*)::int from remediations where status='pending_approval') as "pendingApprovals"`),
    db.select({ id: resources.id, provider: resources.provider, accountScope: resources.accountScope, region: resources.region, type: resources.type, externalId: resources.externalId,
      latestObservedAt: sql<string>`(select max(o.observed_at) from observations o where o.resource_id = ${resources.id})`,
      demo: sql<boolean>`not exists (select 1 from observations o join imports i on i.id=o.import_id where o.resource_id=${resources.id} and i.demo=false)`,
    }).from(resources).orderBy(desc(resources.createdAt)).limit(500),
    db.select({ id: findings.id, resourceId: findings.resourceId, externalId: resources.externalId, provider: resources.provider, rule: findings.rule, severity: findings.severity,
      explanation: findings.explanation, projectedLeakage: findings.projectedLeakage, currency: findings.currency, estimateCategory: findings.estimateCategory,
      status: findings.status, selectedForTotal: findings.selectedForTotal, windowStart: findings.windowStart, windowEnd: findings.windowEnd,
    }).from(findings).innerJoin(resources, eq(findings.resourceId, resources.id)).orderBy(desc(findings.windowEnd), desc(findings.createdAt)),
    db.select({ id: remediations.id, findingId: remediations.findingId, status: remediations.status, scriptHash: remediations.scriptHash,
      format: remediations.format, createdAt: remediations.createdAt, externalId: resources.externalId,
    }).from(remediations).innerJoin(findings, eq(remediations.findingId, findings.id)).innerJoin(resources, eq(findings.resourceId, resources.id)).orderBy(desc(remediations.createdAt)).limit(100),
    db.select({ id: auditEvents.id, action: auditEvents.action, previousState: auditEvents.previousState, nextState: auditEvents.nextState,
      simulation: auditEvents.simulation, outcome: auditEvents.outcome, createdAt: auditEvents.createdAt, details: auditEvents.details,
    }).from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(100),
  ]);
  const currencies = new Map<string, { currency: string; avoidableWaste: string; potentialExcessSpend: string; unpricedFindings: number }>();
  const currentSpikes = new Set<string>();
  for (const finding of findingRows) {
    if (finding.status === "dismissed") continue;
    // Simulation leaves the observed cloud state unchanged. Preserve observed
    // projections; do not report invented realized savings after a simulation.
    const potential = finding.estimateCategory === "potential_excess_spend";
    const identity = JSON.stringify([finding.resourceId, finding.currency]);
    if (potential && currentSpikes.has(identity)) continue;
    if (potential) currentSpikes.add(identity);
    if (!potential && !finding.selectedForTotal && finding.projectedLeakage !== null) continue;
    const total = currencies.get(finding.currency) ?? { currency: finding.currency, avoidableWaste: "0.00000000", potentialExcessSpend: "0.00000000", unpricedFindings: 0 };
    if (finding.projectedLeakage === null) total.unpricedFindings += 1;
    else {
      const key = potential ? "potentialExcessSpend" : "avoidableWaste";
      total[key] = decimalString(decimalUnits(total[key]) + decimalUnits(finding.projectedLeakage));
    }
    currencies.set(finding.currency, total);
  }
  return { counts: countResult.rows[0], currencies: [...currencies.values()], resources: resourceRows,
    findings: findingRows.slice(0, 500), remediations: remediationRows, auditEvents: auditRows };
}
