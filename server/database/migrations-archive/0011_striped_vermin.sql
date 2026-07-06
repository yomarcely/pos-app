CREATE TABLE "pending_sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"establishment_id" integer NOT NULL,
	"register_id" integer NOT NULL,
	"customer_id" integer,
	"items" jsonb NOT NULL,
	"global_discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"global_discount_type" varchar(2) DEFAULT '%' NOT NULL,
	"created_by_email" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "establishments" ADD COLUMN "share_pending_sales" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pending_sales" ADD CONSTRAINT "pending_sales_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_sales" ADD CONSTRAINT "pending_sales_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_sales" ADD CONSTRAINT "pending_sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pending_sales_tenant_id_idx" ON "pending_sales" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "pending_sales_establishment_id_idx" ON "pending_sales" USING btree ("establishment_id");--> statement-breakpoint
CREATE INDEX "pending_sales_register_id_idx" ON "pending_sales" USING btree ("register_id");