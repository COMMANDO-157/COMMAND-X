import { sql } from "drizzle-orm";
import { pgTable, pgEnum, uuid, text, timestamp, integer, boolean, numeric, jsonb, uniqueIndex, index, check } from "drizzle-orm/pg-core";

const id = () => uuid("id").defaultRandom().primaryKey();
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
export const provider = pgEnum("provider", ["aws", "azure", "gcp"]);
export const resourceType = pgEnum("resource_type", ["compute", "block_storage"]);
export const findingStatus = pgEnum("finding_status", ["open", "dismissed", "remediated_simulation"]);
export const remediationStatus = pgEnum("remediation_status", ["pending_approval", "approved", "rejected", "simulated_succeeded", "simulated_failed"]);

export const operators = pgTable("operators", {
  id: id(), login: text("login").notNull().unique(), passwordHash: text("password_hash").notNull(),
  disabled: boolean("disabled").default(false).notNull(), createdAt: createdAt(),
});
export const sessions = pgTable("sessions", {
  id: id(), operatorId: uuid("operator_id").references(() => operators.id).notNull(),
  tokenHash: text("token_hash").notNull().unique(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), createdAt: createdAt(),
}, (t) => [index("sessions_expiry_idx").on(t.expiresAt)]);
export const authAttempts = pgTable("auth_attempts", {
  id: id(), key: text("key").notNull(), createdAt: createdAt(),
}, (t) => [index("auth_attempts_key_time_idx").on(t.key, t.createdAt)]);

export const imports = pgTable("imports", {
  id: id(), operatorId: uuid("operator_id").references(() => operators.id).notNull(), filename: text("filename").notNull(),
  fileHash: text("file_hash").notNull().unique(), demo: boolean("demo").default(false).notNull(), status: text("status").notNull(),
  contentHash: text("content_hash").unique(), warnings: jsonb("warnings").default([]).notNull(), summaries: jsonb("summaries").default([]).notNull(),
  rowCount: integer("row_count").notNull(), validationErrors: jsonb("validation_errors").default([]).notNull(), createdAt: createdAt(),
}, (t) => [index("imports_created_idx").on(t.createdAt), check("imports_row_count_check", sql`${t.rowCount} >= 0 AND ${t.rowCount} <= 5000`)]);
export const resources = pgTable("resources", {
  id: id(), provider: provider("provider").notNull(), accountScope: text("account_scope").notNull(), region: text("region").notNull(),
  type: resourceType("type").notNull(), externalId: text("external_id").notNull(), metadata: jsonb("metadata").default({}).notNull(), createdAt: createdAt(),
}, (t) => [uniqueIndex("resources_identity_idx").on(t.provider, t.accountScope, t.region, t.externalId)]);
export const observations = pgTable("observations", {
  id: id(), importId: uuid("import_id").references(() => imports.id).notNull(), resourceId: uuid("resource_id").references(() => resources.id).notNull(),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(), durationSeconds: integer("duration_seconds").notNull(),
  cpuPercent: numeric("cpu_percent", { precision: 7, scale: 4 }), memoryPercent: numeric("memory_percent", { precision: 7, scale: 4 }),
  attachmentCount: integer("attachment_count"), state: text("state"), intervalCost: numeric("interval_cost", { precision: 20, scale: 8 }),
  hourlyRate: numeric("hourly_rate", { precision: 20, scale: 8 }), currency: text("currency").notNull(), rateSource: text("rate_source").notNull(),
  sourceRow: integer("source_row").notNull(), createdAt: createdAt(),
  rawEvidence: jsonb("raw_evidence").default({}).notNull(),
}, (t) => [
  uniqueIndex("observations_resource_time_idx").on(t.resourceId, t.observedAt, t.durationSeconds),
  index("observations_import_idx").on(t.importId),
  check("observations_duration_check", sql`${t.durationSeconds} > 0`),
  check("observations_cpu_check", sql`${t.cpuPercent} BETWEEN 0 AND 100`),
  check("observations_memory_check", sql`${t.memoryPercent} BETWEEN 0 AND 100`),
  check("observations_attachments_check", sql`${t.attachmentCount} >= 0`),
  check("observations_cost_check", sql`${t.intervalCost} >= 0 AND ${t.hourlyRate} >= 0`),
  check("observations_currency_check", sql`${t.currency} ~ '^[A-Z]{3}$'`),
]);
export const findings = pgTable("findings", {
  id: id(), resourceId: uuid("resource_id").references(() => resources.id).notNull(), importId: uuid("import_id").references(() => imports.id).notNull(),
  rule: text("rule").notNull(), ruleVersion: text("rule_version").notNull(), parameters: jsonb("parameters").notNull(), evidence: jsonb("evidence").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(), windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
  severity: text("severity").notNull(), explanation: text("explanation").notNull(), costInputs: jsonb("cost_inputs").notNull(),
  projectedLeakage: numeric("projected_leakage", { precision: 24, scale: 8 }), currency: text("currency").notNull(),
  estimateCategory: text("estimate_category").notNull(), selectedForTotal: boolean("selected_for_total").default(false).notNull(),
  status: findingStatus("status").default("open").notNull(), createdAt: createdAt(),
}, (t) => [
  uniqueIndex("findings_rule_import_resource_idx").on(t.resourceId, t.importId, t.rule, t.currency),
  index("findings_import_idx").on(t.importId),
  uniqueIndex("findings_one_total_per_resource_idx").on(t.resourceId).where(sql`${t.selectedForTotal} = true`),
  check("findings_category_check", sql`${t.estimateCategory} IN ('avoidable_waste', 'potential_excess_spend')`),
  check("findings_spike_total_check", sql`${t.estimateCategory} <> 'potential_excess_spend' OR ${t.selectedForTotal} = false`),
  check("findings_cost_check", sql`${t.projectedLeakage} >= 0`),
]);
export const remediations = pgTable("remediations", {
  id: id(), findingId: uuid("finding_id").references(() => findings.id).notNull(), action: text("action").notNull(),
  format: text("format").notNull(), scriptText: text("script_text").notNull(), scriptHash: text("script_hash").notNull(),
  originalConfiguration: jsonb("original_configuration"), status: remediationStatus("status").default("pending_approval").notNull(),
  simulationOnly: boolean("simulation_only").default(true).notNull(), createdAt: createdAt(),
}, (t) => [
  uniqueIndex("remediations_id_hash_idx").on(t.id, t.scriptHash),
  check("remediations_simulation_only_check", sql`${t.simulationOnly} = true`),
  check("remediations_format_check", sql`${t.format} IN ('bash', 'terraform')`),
]);
export const decisions = pgTable("decisions", {
  id: id(), remediationId: uuid("remediation_id").references(() => remediations.id).notNull(),
  operatorId: uuid("operator_id").references(() => operators.id).notNull(), decision: text("decision").notNull(),
  comment: text("comment"), scriptHash: text("script_hash").notNull(), createdAt: createdAt(),
}, (t) => [check("decisions_choice_check", sql`${t.decision} IN ('approve', 'reject')`)]);
export const auditEvents = pgTable("audit_events", {
  id: id(), operatorId: uuid("operator_id").references(() => operators.id), importId: uuid("import_id").references(() => imports.id),
  resourceId: uuid("resource_id").references(() => resources.id), remediationId: uuid("remediation_id").references(() => remediations.id),
  action: text("action").notNull(), previousState: text("previous_state"), nextState: text("next_state"),
  simulation: boolean("simulation").default(false).notNull(), outcome: text("outcome").notNull(),
  details: jsonb("details").default({}).notNull(), createdAt: createdAt(),
}, (t) => [index("audit_events_time_idx").on(t.createdAt)]);
