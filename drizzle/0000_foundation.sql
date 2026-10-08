CREATE TYPE "public"."finding_status" AS ENUM('open', 'dismissed', 'remediated_simulation');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('aws', 'azure', 'gcp');--> statement-breakpoint
CREATE TYPE "public"."remediation_status" AS ENUM('pending_approval', 'approved', 'rejected', 'simulated_succeeded', 'simulated_failed');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('compute', 'block_storage');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" uuid,
	"import_id" uuid,
	"resource_id" uuid,
	"remediation_id" uuid,
	"action" text NOT NULL,
	"previous_state" text,
	"next_state" text,
	"simulation" boolean DEFAULT false NOT NULL,
	"outcome" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"remediation_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"comment" text,
	"script_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decisions_choice_check" CHECK ("decisions"."decision" IN ('approve', 'reject'))
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"rule" text NOT NULL,
	"rule_version" text NOT NULL,
	"parameters" jsonb NOT NULL,
	"evidence" jsonb NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"severity" text NOT NULL,
	"explanation" text NOT NULL,
	"cost_inputs" jsonb NOT NULL,
	"projected_leakage" numeric(20, 8),
	"currency" text NOT NULL,
	"estimate_category" text NOT NULL,
	"selected_for_total" boolean DEFAULT false NOT NULL,
	"status" "finding_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "findings_category_check" CHECK ("findings"."estimate_category" IN ('avoidable_waste', 'potential_excess_spend')),
	CONSTRAINT "findings_spike_total_check" CHECK ("findings"."estimate_category" <> 'potential_excess_spend' OR "findings"."selected_for_total" = false),
	CONSTRAINT "findings_cost_check" CHECK ("findings"."projected_leakage" >= 0)
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"file_hash" text NOT NULL,
	"demo" boolean DEFAULT false NOT NULL,
	"status" text NOT NULL,
	"row_count" integer NOT NULL,
	"validation_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "imports_file_hash_unique" UNIQUE("file_hash"),
	CONSTRAINT "imports_row_count_check" CHECK ("imports"."row_count" >= 0 AND "imports"."row_count" <= 5000)
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"duration_seconds" integer NOT NULL,
	"cpu_percent" numeric(7, 4),
	"memory_percent" numeric(7, 4),
	"attachment_count" integer,
	"state" text,
	"interval_cost" numeric(20, 8),
	"hourly_rate" numeric(20, 8),
	"currency" text NOT NULL,
	"rate_source" text NOT NULL,
	"source_row" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "observations_duration_check" CHECK ("observations"."duration_seconds" > 0),
	CONSTRAINT "observations_cpu_check" CHECK ("observations"."cpu_percent" BETWEEN 0 AND 100),
	CONSTRAINT "observations_memory_check" CHECK ("observations"."memory_percent" BETWEEN 0 AND 100),
	CONSTRAINT "observations_attachments_check" CHECK ("observations"."attachment_count" >= 0),
	CONSTRAINT "observations_cost_check" CHECK ("observations"."interval_cost" >= 0 AND "observations"."hourly_rate" >= 0),
	CONSTRAINT "observations_currency_check" CHECK ("observations"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "operators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"login" text NOT NULL,
	"password_hash" text NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operators_login_unique" UNIQUE("login")
);
--> statement-breakpoint
CREATE TABLE "remediations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" uuid NOT NULL,
	"action" text NOT NULL,
	"format" text NOT NULL,
	"script_text" text NOT NULL,
	"script_hash" text NOT NULL,
	"original_configuration" jsonb,
	"status" "remediation_status" DEFAULT 'pending_approval' NOT NULL,
	"simulation_only" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "remediations_simulation_only_check" CHECK ("remediations"."simulation_only" = true),
	CONSTRAINT "remediations_format_check" CHECK ("remediations"."format" IN ('bash', 'terraform'))
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "provider" NOT NULL,
	"account_scope" text NOT NULL,
	"region" text NOT NULL,
	"type" "resource_type" NOT NULL,
	"external_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operator_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_remediation_id_remediations_id_fk" FOREIGN KEY ("remediation_id") REFERENCES "public"."remediations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_remediation_id_remediations_id_fk" FOREIGN KEY ("remediation_id") REFERENCES "public"."remediations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_resource_id_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remediations" ADD CONSTRAINT "remediations_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_operator_id_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_time_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "auth_attempts_key_time_idx" ON "auth_attempts" USING btree ("key","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "findings_rule_import_resource_idx" ON "findings" USING btree ("resource_id","import_id","rule");--> statement-breakpoint
CREATE UNIQUE INDEX "findings_one_total_per_resource_idx" ON "findings" USING btree ("resource_id") WHERE "findings"."selected_for_total" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "observations_resource_time_idx" ON "observations" USING btree ("resource_id","observed_at","duration_seconds");--> statement-breakpoint
CREATE UNIQUE INDEX "remediations_id_hash_idx" ON "remediations" USING btree ("id","script_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "resources_identity_idx" ON "resources" USING btree ("provider","account_scope","region","external_id");--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "sessions" USING btree ("expires_at");