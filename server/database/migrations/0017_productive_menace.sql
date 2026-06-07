CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"establishment_id" integer,
	"content" text NOT NULL,
	"type" varchar(20) DEFAULT 'general' NOT NULL,
	"customer_id" integer,
	"due_date" timestamp with time zone,
	"done" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_tenant_id_idx" ON "notes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notes_tenant_done_idx" ON "notes" USING btree ("tenant_id","done");--> statement-breakpoint
CREATE INDEX "notes_due_date_idx" ON "notes" USING btree ("due_date");