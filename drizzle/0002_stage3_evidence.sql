ALTER TABLE "findings" ALTER COLUMN "projected_leakage" SET DATA TYPE numeric(24, 8);--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "warnings" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "summaries" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "observations" ADD COLUMN "raw_evidence" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_content_hash_unique" UNIQUE("content_hash");