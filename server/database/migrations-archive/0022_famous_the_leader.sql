ALTER TABLE "archives" ADD COLUMN "export_status" varchar(20) DEFAULT 'pending_export' NOT NULL;--> statement-breakpoint
ALTER TABLE "archives" ADD COLUMN "storage_key" text;--> statement-breakpoint
ALTER TABLE "archives" ADD COLUMN "exported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "archives" ADD COLUMN "content" text;