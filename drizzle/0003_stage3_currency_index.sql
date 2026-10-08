DROP INDEX "findings_rule_import_resource_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "findings_rule_import_resource_idx" ON "findings" USING btree ("resource_id","import_id","rule","currency");