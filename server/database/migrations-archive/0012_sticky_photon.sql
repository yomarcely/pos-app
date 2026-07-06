CREATE TABLE "loyalty_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"point_mode" varchar(32) DEFAULT 'per_euro' NOT NULL,
	"threshold_points" integer DEFAULT 100 NOT NULL,
	"reward_type" varchar(32) DEFAULT 'percent_discount' NOT NULL,
	"reward_value" numeric(10, 2) DEFAULT '5' NOT NULL,
	"voucher_validity_days" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_config_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "loyalty_vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"customer_id" integer NOT NULL,
	"code" varchar(32) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"used_sale_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "points_earned" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "points_consumed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "voucher_used_id" integer;--> statement-breakpoint
ALTER TABLE "loyalty_vouchers" ADD CONSTRAINT "loyalty_vouchers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_vouchers" ADD CONSTRAINT "loyalty_vouchers_used_sale_id_sales_id_fk" FOREIGN KEY ("used_sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_config_tenant_id_idx" ON "loyalty_config" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "loyalty_vouchers_tenant_id_idx" ON "loyalty_vouchers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "loyalty_vouchers_customer_id_idx" ON "loyalty_vouchers" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_vouchers_code_idx" ON "loyalty_vouchers" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "loyalty_vouchers_status_idx" ON "loyalty_vouchers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sales_voucher_used_id_idx" ON "sales" USING btree ("voucher_used_id");