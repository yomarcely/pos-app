CREATE TABLE "establishments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"postal_code" varchar(10),
	"city" varchar(100),
	"country" varchar(100) DEFAULT 'France',
	"phone" varchar(20),
	"email" varchar(255),
	"siret" varchar(14),
	"naf" varchar(5),
	"tva_number" varchar(20),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "establishments_tenant_id_idx" ON "establishments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sale_items_sale_id_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_seller_id_idx" ON "sales" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_customer_id_idx" ON "sales" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_status_idx" ON "sales" USING btree ("status");
