import "server-only";
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditEvents, decisions, findings, observations, remediations, resources } from "@/db/schema";
import { assertDecisionTransition, assertSimulationTransition, generateRemediation, RemediationError } from "./remediation-scripts";

function object(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};}
export async function createRemediation(findingId:string,format:"bash"|"terraform",operatorId:string){return getDb().transaction(async tx=>{
  const [finding]=await tx.select().from(findings).where(eq(findings.id,findingId)).for("update");
  if(!finding)throw new RemediationError(404,"Finding not found.");if(finding.status==="dismissed")throw new RemediationError(409,"A dismissed finding cannot receive a new remediation proposal.");
  const [resource]=await tx.select().from(resources).where(eq(resources.id,finding.resourceId));
  const [observation]=await tx.select().from(observations).where(and(eq(observations.resourceId,resource.id),eq(observations.importId,finding.importId),gte(observations.observedAt,finding.windowStart),lt(observations.observedAt,finding.windowEnd))).orderBy(desc(observations.observedAt)).limit(1);
  if(!observation)throw new RemediationError(409,"Qualifying resource evidence is unavailable.");
  const evidence=object(observation.rawEvidence),original=object(evidence.original),metadata=object(evidence.metadata);
  const exactId=typeof original.resource_id==="string"?original.resource_id:resource.externalId;
  // Match safely normalized identity before using any exact original target. Surrounding whitespace is not inserted into executable arguments.
  if(exactId.trim()!==resource.externalId)throw new RemediationError(409,"Original resource identity conflicts with the persisted target.");
  const generated=generateRemediation({provider:resource.provider,accountScope:resource.accountScope,region:resource.region,type:resource.type,externalId:resource.externalId,rule:finding.rule,metadata},format);
  const [existing]=await tx.select().from(remediations).where(and(eq(remediations.findingId,findingId),eq(remediations.scriptHash,generated.scriptHash),eq(remediations.status,"pending_approval"))).orderBy(desc(remediations.createdAt)).limit(1);
  if(existing)return existing;
  const [saved]=await tx.insert(remediations).values({findingId,...generated,simulationOnly:true,status:"pending_approval"}).returning();
  await tx.insert(auditEvents).values({operatorId,importId:finding.importId,resourceId:resource.id,remediationId:saved.id,action:"remediation.generated",nextState:"pending_approval",simulation:true,outcome:"success",details:{scriptHash:saved.scriptHash,format,action:saved.action,provider:resource.provider,account:resource.accountScope,region:resource.region,exactOriginalResourceId:exactId,canonicalResourceId:resource.externalId,noCloudExecution:true}});
  return saved;
});}
export async function getRemediationDetail(id:string){const [remediation]=await getDb().select().from(remediations).where(eq(remediations.id,id));if(!remediation)return null;const [finding]=await getDb().select().from(findings).where(eq(findings.id,remediation.findingId));const [resource]=await getDb().select().from(resources).where(eq(resources.id,finding.resourceId));const [decisionRows,audits]=await Promise.all([getDb().select().from(decisions).where(eq(decisions.remediationId,id)).orderBy(asc(decisions.createdAt)),getDb().select().from(auditEvents).where(eq(auditEvents.remediationId,id)).orderBy(asc(auditEvents.createdAt))]);return {remediation,decisions:decisionRows,auditEvents:audits,resource,finding};}
export async function listRemediations(findingId:string){return getDb().select().from(remediations).where(eq(remediations.findingId,findingId)).orderBy(desc(remediations.createdAt)).limit(100);}
export async function decideRemediation(id:string,decision:"approve"|"reject",comment:string|undefined,scriptHash:string,operatorId:string){return getDb().transaction(async tx=>{
  const [remediation]=await tx.select().from(remediations).where(eq(remediations.id,id)).for("update");if(!remediation)throw new RemediationError(404,"Remediation not found.");
  const next=assertDecisionTransition(remediation.status,remediation.scriptHash,scriptHash,decision);
  const [finding]=await tx.select().from(findings).where(eq(findings.id,remediation.findingId)).for("update");
  if(finding.status==="dismissed")throw new RemediationError(409,"A dismissed finding no longer accepts a remediation decision.");
  await tx.insert(decisions).values({remediationId:id,operatorId,decision,comment:comment??null,scriptHash});
  const [saved]=await tx.update(remediations).set({status:next}).where(and(eq(remediations.id,id),eq(remediations.status,"pending_approval"),eq(remediations.scriptHash,scriptHash))).returning();
  if(!saved)throw new RemediationError(409,"Remediation changed during review; reload the persisted proposal.");
  await tx.insert(auditEvents).values({operatorId,importId:finding.importId,resourceId:finding.resourceId,remediationId:id,action:`remediation.${decision}`,previousState:remediation.status,nextState:next,simulation:true,outcome:"success",details:{scriptHash,comment:comment??null,noCloudExecution:true}});return saved;
});}
export async function simulateRemediation(id:string,scriptHash:string,operatorId:string){return getDb().transaction(async tx=>{
  const [remediation]=await tx.select().from(remediations).where(eq(remediations.id,id)).for("update");if(!remediation)throw new RemediationError(404,"Remediation not found.");
  const [approved]=await tx.select().from(decisions).where(and(eq(decisions.remediationId,id),eq(decisions.decision,"approve"),eq(decisions.scriptHash,scriptHash))).orderBy(desc(decisions.createdAt)).limit(1);
  if(remediation.status==="simulated_succeeded" && remediation.scriptHash===scriptHash && approved?.scriptHash===scriptHash)return remediation;
  const next=assertSimulationTransition(remediation.status,remediation.scriptHash,scriptHash,approved?.scriptHash??null);
  const [finding]=await tx.select().from(findings).where(eq(findings.id,remediation.findingId)).for("update");if(finding.status==="dismissed")throw new RemediationError(409,"The finding was dismissed. No simulation was recorded.");
  const [saved]=await tx.update(remediations).set({status:next}).where(and(eq(remediations.id,id),eq(remediations.status,"approved"),eq(remediations.scriptHash,scriptHash))).returning();
  if(!saved)throw new RemediationError(409,"Simulation state changed; reload the remediation.");
  await tx.update(findings).set({status:"remediated_simulation"}).where(and(eq(findings.id,finding.id),eq(findings.status,"open")));
  await tx.insert(auditEvents).values({operatorId,importId:finding.importId,resourceId:finding.resourceId,remediationId:id,action:"remediation.simulated",previousState:"approved",nextState:next,simulation:true,outcome:"success",details:{scriptHash,decisionId:approved.id,noCloudExecution:true,resourceStateChanged:false,findingPreviousState:finding.status,findingNextState:"remediated_simulation",projectedEstimatePreserved:true,realizedSavings:"not measured"}});return saved;
});}
