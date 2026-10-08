CREATE INDEX "findings_import_idx" ON "findings" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "imports_created_idx" ON "imports" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "observations_import_idx" ON "observations" USING btree ("import_id");