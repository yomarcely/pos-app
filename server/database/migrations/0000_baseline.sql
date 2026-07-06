CREATE TABLE "archives" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"period" varchar(20) NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"archive_type" varchar(50) NOT NULL,
	"register_id" integer,
	"file_path" text,
	"file_size" integer,
	"archive_hash" varchar(64) NOT NULL,
	"archive_signature" varchar(64),
	"export_status" varchar(20) DEFAULT 'pending_export' NOT NULL,
	"storage_key" text,
	"exported_at" timestamp with time zone,
	"content" text,
	"sales_count" integer NOT NULL,
	"closures_count" integer DEFAULT 0 NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"user_id" integer,
	"user_name" varchar(100),
	"entity_type" varchar(50) NOT NULL,
	"entity_id" integer,
	"action" varchar(50) NOT NULL,
	"changes" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" varchar(45)
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_by_establishment_id" integer,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"parent_id" integer,
	"sort_order" integer DEFAULT 0,
	"icon" varchar(50),
	"color" varchar(20),
	"created_by_establishment_id" integer,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closures" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"closure_date" varchar(10) NOT NULL,
	"register_id" integer NOT NULL,
	"establishment_id" integer,
	"ticket_count" integer DEFAULT 0 NOT NULL,
	"cancelled_count" integer DEFAULT 0 NOT NULL,
	"total_ht" numeric(12, 2) NOT NULL,
	"total_tva" numeric(12, 2) NOT NULL,
	"total_ttc" numeric(12, 2) NOT NULL,
	"payment_methods" jsonb NOT NULL,
	"closure_hash" varchar(64) NOT NULL,
	"first_ticket_number" varchar(50),
	"last_ticket_number" varchar(50),
	"last_ticket_hash" varchar(64),
	"closed_by" varchar(100),
	"closed_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_establishments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"customer_id" integer NOT NULL,
	"establishment_id" integer NOT NULL,
	"local_discount" numeric(5, 2),
	"local_notes" text,
	"local_loyalty_points" integer DEFAULT 0,
	"first_name_override" varchar(100),
	"last_name_override" varchar(100),
	"email_override" varchar(255),
	"phone_override" varchar(20),
	"address_override" text,
	"metadata_override" jsonb,
	"gdpr_consent_override" boolean,
	"gdpr_consent_date_override" timestamp with time zone,
	"marketing_consent_override" boolean,
	"loyalty_program_override" boolean,
	"discount_override" numeric(5, 2),
	"first_purchase_date" timestamp with time zone,
	"last_purchase_date" timestamp with time zone,
	"total_purchases" numeric(10, 2) DEFAULT '0',
	"purchase_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"email" varchar(255),
	"phone" varchar(20),
	"address" text,
	"gdpr_consent" boolean DEFAULT false NOT NULL,
	"gdpr_consent_date" timestamp with time zone,
	"marketing_consent" boolean DEFAULT false,
	"loyalty_program" boolean DEFAULT false,
	"discount" numeric(5, 2) DEFAULT '0',
	"notes" text,
	"alerts" text,
	"metadata" jsonb,
	"is_anonymized" boolean DEFAULT false,
	"anonymized_at" timestamp with time zone,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "establishments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"establishment_number" integer NOT NULL,
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
	"share_pending_sales" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_preparation_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"preparation_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"variation" varchar(100),
	"expected_stock" integer NOT NULL,
	"counted_stock" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_preparations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"preparation_number" varchar(50) NOT NULL,
	"name" varchar(255),
	"comment" text,
	"establishment_id" integer,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"validated_at" timestamp with time zone,
	"validated_movement_id" integer,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_preparations_preparation_number_unique" UNIQUE("preparation_number")
);
--> statement-breakpoint
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
CREATE TABLE "movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"movement_number" varchar(50) NOT NULL,
	"type" varchar(50) NOT NULL,
	"comment" text,
	"supplier_id" integer,
	"delivery_note_number" varchar(100),
	"establishment_id" integer,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movements_movement_number_unique" UNIQUE("movement_number")
);
--> statement-breakpoint
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
CREATE TABLE "product_establishments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"product_id" integer NOT NULL,
	"establishment_id" integer NOT NULL,
	"price_override" numeric(10, 2),
	"purchase_price_override" numeric(10, 2),
	"supplier_id_override" integer,
	"category_id_override" integer,
	"brand_id_override" integer,
	"name_override" varchar(255),
	"description_override" text,
	"barcode_override" varchar(128),
	"tva_override" numeric(5, 2),
	"tva_id_override" integer,
	"image_override" text,
	"variation_group_ids_override" integer[],
	"is_available" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_stocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"product_id" integer NOT NULL,
	"establishment_id" integer NOT NULL,
	"stock" integer DEFAULT 0,
	"stock_by_variation" jsonb DEFAULT '[]',
	"min_stock" integer DEFAULT 5,
	"min_stock_by_variation" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"barcode" varchar(50),
	"barcode_by_variation" jsonb,
	"category_id" integer,
	"supplier_id" integer,
	"brand_id" integer,
	"supplier_code" varchar(100),
	"price" numeric(10, 2) NOT NULL,
	"purchase_price" numeric(10, 2),
	"tva_id" integer,
	"tva" numeric(5, 2),
	"stock" integer DEFAULT 0,
	"stock_by_variation" jsonb,
	"min_stock" integer DEFAULT 5,
	"min_stock_by_variation" jsonb,
	"variation_group_ids" jsonb,
	"image" text,
	"description" text,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"establishment_id" integer NOT NULL,
	"register_number" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"sale_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" varchar(255) NOT NULL,
	"variation" varchar(100),
	"variation_id" integer,
	"quantity" integer NOT NULL,
	"original_price" numeric(10, 2),
	"unit_price" numeric(10, 2) NOT NULL,
	"purchase_price_at_sale" numeric(10, 2),
	"discount" numeric(10, 2) DEFAULT '0',
	"discount_type" varchar(1) DEFAULT '%',
	"tva_id" integer,
	"tva_rate" numeric(5, 2) NOT NULL,
	"tva_code" varchar(10) NOT NULL,
	"tva" numeric(5, 2),
	"total_ht" numeric(10, 2) NOT NULL,
	"total_ttc" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"ticket_number" varchar(50) NOT NULL,
	"client_sale_id" uuid,
	"sale_date" timestamp with time zone DEFAULT now() NOT NULL,
	"total_ht" numeric(10, 2) NOT NULL,
	"total_tva" numeric(10, 2) NOT NULL,
	"total_ttc" numeric(10, 2) NOT NULL,
	"global_discount" numeric(10, 2) DEFAULT '0',
	"global_discount_type" varchar(1) DEFAULT '%',
	"seller_id" integer,
	"customer_id" integer,
	"establishment_id" integer,
	"register_id" integer,
	"payments" jsonb NOT NULL,
	"previous_hash" varchar(64),
	"current_hash" varchar(64) NOT NULL,
	"signature" text,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"type" varchar(20) DEFAULT 'sale' NOT NULL,
	"original_sale_id" integer,
	"credit_note_id" integer,
	"cancellation_reason" text,
	"cancelled_at" timestamp with time zone,
	"closure_id" integer,
	"closed_at" timestamp with time zone,
	"points_earned" integer DEFAULT 0 NOT NULL,
	"points_consumed" integer DEFAULT 0 NOT NULL,
	"voucher_used_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_establishments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"seller_id" integer NOT NULL,
	"establishment_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"movement_id" integer,
	"product_id" integer NOT NULL,
	"variation" varchar(100),
	"establishment_id" integer,
	"quantity" integer NOT NULL,
	"old_stock" integer NOT NULL,
	"new_stock" integer NOT NULL,
	"reason" varchar(50) NOT NULL,
	"oversell" boolean DEFAULT false NOT NULL,
	"sale_id" integer,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact" varchar(100),
	"email" varchar(255),
	"phone" varchar(20),
	"address" text,
	"created_by_establishment_id" integer,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_group_establishments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"sync_group_id" integer NOT NULL,
	"establishment_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"sync_group_id" integer NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" integer NOT NULL,
	"source_establishment_id" integer,
	"action" varchar(50) NOT NULL,
	"synced_fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"sync_group_id" integer NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"sync_name" boolean DEFAULT true,
	"sync_description" boolean DEFAULT true,
	"sync_barcode" boolean DEFAULT true,
	"sync_category" boolean DEFAULT true,
	"sync_supplier" boolean DEFAULT true,
	"sync_brand" boolean DEFAULT true,
	"sync_price_ht" boolean DEFAULT true,
	"sync_price_ttc" boolean DEFAULT false,
	"sync_tva" boolean DEFAULT true,
	"sync_image" boolean DEFAULT true,
	"sync_variations" boolean DEFAULT true,
	"sync_customer_info" boolean DEFAULT true,
	"sync_customer_contact" boolean DEFAULT true,
	"sync_customer_address" boolean DEFAULT true,
	"sync_customer_gdpr" boolean DEFAULT true,
	"sync_loyalty_program" boolean DEFAULT false,
	"sync_discount" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"name" varchar(100) NOT NULL,
	"rate" numeric(5, 2) NOT NULL,
	"code" varchar(10) NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variation_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_by_establishment_id" integer,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"group_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"sort_order" integer DEFAULT 0,
	"is_archived" boolean DEFAULT false,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "closures" ADD CONSTRAINT "closures_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closures" ADD CONSTRAINT "closures_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_establishments" ADD CONSTRAINT "customer_establishments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_establishments" ADD CONSTRAINT "customer_establishments_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_preparation_items" ADD CONSTRAINT "inventory_preparation_items_preparation_id_inventory_preparations_id_fk" FOREIGN KEY ("preparation_id") REFERENCES "public"."inventory_preparations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_preparation_items" ADD CONSTRAINT "inventory_preparation_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_preparations" ADD CONSTRAINT "inventory_preparations_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_preparations" ADD CONSTRAINT "inventory_preparations_validated_movement_id_movements_id_fk" FOREIGN KEY ("validated_movement_id") REFERENCES "public"."movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_vouchers" ADD CONSTRAINT "loyalty_vouchers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_vouchers" ADD CONSTRAINT "loyalty_vouchers_used_sale_id_sales_id_fk" FOREIGN KEY ("used_sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_sales" ADD CONSTRAINT "pending_sales_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_sales" ADD CONSTRAINT "pending_sales_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_sales" ADD CONSTRAINT "pending_sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_establishments" ADD CONSTRAINT "product_establishments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_establishments" ADD CONSTRAINT "product_establishments_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_stocks" ADD CONSTRAINT "product_stocks_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_stocks" ADD CONSTRAINT "product_stocks_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tva_id_tax_rates_id_fk" FOREIGN KEY ("tva_id") REFERENCES "public"."tax_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registers" ADD CONSTRAINT "registers_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_tva_id_tax_rates_id_fk" FOREIGN KEY ("tva_id") REFERENCES "public"."tax_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_original_sale_id_sales_id_fk" FOREIGN KEY ("original_sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_credit_note_id_sales_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_closure_id_closures_id_fk" FOREIGN KEY ("closure_id") REFERENCES "public"."closures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_establishments" ADD CONSTRAINT "seller_establishments_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_establishments" ADD CONSTRAINT "seller_establishments_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_movement_id_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."movements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_group_establishments" ADD CONSTRAINT "sync_group_establishments_sync_group_id_sync_groups_id_fk" FOREIGN KEY ("sync_group_id") REFERENCES "public"."sync_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_group_establishments" ADD CONSTRAINT "sync_group_establishments_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_sync_group_id_sync_groups_id_fk" FOREIGN KEY ("sync_group_id") REFERENCES "public"."sync_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_source_establishment_id_establishments_id_fk" FOREIGN KEY ("source_establishment_id") REFERENCES "public"."establishments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_rules" ADD CONSTRAINT "sync_rules_sync_group_id_sync_groups_id_fk" FOREIGN KEY ("sync_group_id") REFERENCES "public"."sync_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variations" ADD CONSTRAINT "variations_group_id_variation_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."variation_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "archives_tenant_id_idx" ON "archives" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "archives_period_start_idx" ON "archives" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "archives_archive_type_idx" ON "archives" USING btree ("archive_type");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_id_idx" ON "audit_logs" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "brands_tenant_id_idx" ON "brands" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "brands_name_idx" ON "brands" USING btree ("name");--> statement-breakpoint
CREATE INDEX "brands_establishment_idx" ON "brands" USING btree ("created_by_establishment_id");--> statement-breakpoint
CREATE INDEX "categories_tenant_id_idx" ON "categories" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "categories_name_idx" ON "categories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "categories_establishment_idx" ON "categories" USING btree ("created_by_establishment_id");--> statement-breakpoint
CREATE INDEX "closures_tenant_id_idx" ON "closures" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "closures_closure_date_idx" ON "closures" USING btree ("closure_date");--> statement-breakpoint
CREATE INDEX "closures_closure_hash_idx" ON "closures" USING btree ("closure_hash");--> statement-breakpoint
CREATE INDEX "closures_register_id_idx" ON "closures" USING btree ("register_id");--> statement-breakpoint
CREATE INDEX "closures_establishment_id_idx" ON "closures" USING btree ("establishment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "closures_tenant_closure_hash_unique" ON "closures" USING btree ("tenant_id","closure_hash");--> statement-breakpoint
CREATE INDEX "closures_tenant_register_closure_date_idx" ON "closures" USING btree ("tenant_id","register_id","closure_date");--> statement-breakpoint
CREATE INDEX "customer_establishments_tenant_id_idx" ON "customer_establishments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "customer_establishments_customer_id_idx" ON "customer_establishments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_establishments_establishment_id_idx" ON "customer_establishments" USING btree ("establishment_id");--> statement-breakpoint
CREATE INDEX "customers_tenant_id_idx" ON "customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_tenant_unique" ON "customers" USING btree ("email","tenant_id");--> statement-breakpoint
CREATE INDEX "establishments_tenant_id_idx" ON "establishments" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "establishments_tenant_number_unique" ON "establishments" USING btree ("tenant_id","establishment_number");--> statement-breakpoint
CREATE INDEX "inventory_preparation_items_tenant_id_idx" ON "inventory_preparation_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inventory_preparation_items_preparation_id_idx" ON "inventory_preparation_items" USING btree ("preparation_id");--> statement-breakpoint
CREATE INDEX "inventory_preparation_items_product_id_idx" ON "inventory_preparation_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "inventory_preparations_tenant_id_idx" ON "inventory_preparations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inventory_preparations_status_idx" ON "inventory_preparations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inventory_preparations_establishment_id_idx" ON "inventory_preparations" USING btree ("establishment_id");--> statement-breakpoint
CREATE INDEX "inventory_preparations_created_at_idx" ON "inventory_preparations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "inventory_preparations_preparation_number_idx" ON "inventory_preparations" USING btree ("preparation_number");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_config_tenant_id_idx" ON "loyalty_config" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "loyalty_vouchers_tenant_id_idx" ON "loyalty_vouchers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "loyalty_vouchers_customer_id_idx" ON "loyalty_vouchers" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_vouchers_code_idx" ON "loyalty_vouchers" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "loyalty_vouchers_status_idx" ON "loyalty_vouchers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "movements_tenant_id_idx" ON "movements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "movements_type_idx" ON "movements" USING btree ("type");--> statement-breakpoint
CREATE INDEX "movements_created_at_idx" ON "movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "movements_movement_number_idx" ON "movements" USING btree ("movement_number");--> statement-breakpoint
CREATE INDEX "movements_supplier_id_idx" ON "movements" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "movements_establishment_id_idx" ON "movements" USING btree ("establishment_id");--> statement-breakpoint
CREATE INDEX "notes_tenant_id_idx" ON "notes" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notes_tenant_done_idx" ON "notes" USING btree ("tenant_id","done");--> statement-breakpoint
CREATE INDEX "notes_due_date_idx" ON "notes" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "pending_sales_tenant_id_idx" ON "pending_sales" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "pending_sales_establishment_id_idx" ON "pending_sales" USING btree ("establishment_id");--> statement-breakpoint
CREATE INDEX "pending_sales_register_id_idx" ON "pending_sales" USING btree ("register_id");--> statement-breakpoint
CREATE INDEX "product_establishments_tenant_id_idx" ON "product_establishments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "product_establishments_product_id_idx" ON "product_establishments" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_establishments_establishment_id_idx" ON "product_establishments" USING btree ("establishment_id");--> statement-breakpoint
CREATE INDEX "product_stocks_tenant_id_idx" ON "product_stocks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "product_stocks_product_id_idx" ON "product_stocks" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_stocks_establishment_id_idx" ON "product_stocks" USING btree ("establishment_id");--> statement-breakpoint
CREATE INDEX "product_stocks_tenant_establishment_product_idx" ON "product_stocks" USING btree ("tenant_id","establishment_id","product_id");--> statement-breakpoint
CREATE INDEX "products_tenant_id_idx" ON "products" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "products_barcode_idx" ON "products" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "products_name_idx" ON "products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "products_category_id_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_supplier_id_idx" ON "products" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "products_brand_id_idx" ON "products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "registers_tenant_id_idx" ON "registers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "registers_establishment_id_idx" ON "registers" USING btree ("establishment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registers_establishment_number_unique" ON "registers" USING btree ("establishment_id","register_number");--> statement-breakpoint
CREATE INDEX "sale_items_tenant_id_idx" ON "sale_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sales_tenant_id_idx" ON "sales" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sales_ticket_number_idx" ON "sales" USING btree ("ticket_number");--> statement-breakpoint
CREATE INDEX "sales_sale_date_idx" ON "sales" USING btree ("sale_date");--> statement-breakpoint
CREATE INDEX "sales_closure_id_idx" ON "sales" USING btree ("closure_id");--> statement-breakpoint
CREATE INDEX "sales_seller_id_idx" ON "sales" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "sales_customer_id_idx" ON "sales" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sales_establishment_id_idx" ON "sales" USING btree ("establishment_id");--> statement-breakpoint
CREATE INDEX "sales_register_id_idx" ON "sales" USING btree ("register_id");--> statement-breakpoint
CREATE INDEX "sales_status_idx" ON "sales" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sales_voucher_used_id_idx" ON "sales" USING btree ("voucher_used_id");--> statement-breakpoint
CREATE INDEX "sales_original_sale_id_idx" ON "sales" USING btree ("original_sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_tenant_ticket_number_unique" ON "sales" USING btree ("tenant_id","ticket_number");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_tenant_client_sale_id_unique" ON "sales" USING btree ("tenant_id","client_sale_id");--> statement-breakpoint
CREATE INDEX "sales_tenant_register_status_idx" ON "sales" USING btree ("tenant_id","register_id","status");--> statement-breakpoint
CREATE INDEX "sales_tenant_establishment_sale_date_idx" ON "sales" USING btree ("tenant_id","establishment_id","sale_date");--> statement-breakpoint
CREATE INDEX "seller_establishments_tenant_id_idx" ON "seller_establishments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "seller_establishments_seller_id_idx" ON "seller_establishments" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "seller_establishments_establishment_id_idx" ON "seller_establishments" USING btree ("establishment_id");--> statement-breakpoint
CREATE INDEX "sellers_tenant_id_idx" ON "sellers" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sellers_tenant_code_unique" ON "sellers" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE INDEX "stock_movements_tenant_id_idx" ON "stock_movements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "stock_movements_product_id_idx" ON "stock_movements" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_movements_movement_id_idx" ON "stock_movements" USING btree ("movement_id");--> statement-breakpoint
CREATE INDEX "stock_movements_establishment_id_idx" ON "stock_movements" USING btree ("establishment_id");--> statement-breakpoint
CREATE INDEX "stock_movements_reason_idx" ON "stock_movements" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "stock_movements_created_at_idx" ON "stock_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "suppliers_tenant_id_idx" ON "suppliers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "suppliers_name_idx" ON "suppliers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "suppliers_establishment_idx" ON "suppliers" USING btree ("created_by_establishment_id");--> statement-breakpoint
CREATE INDEX "sync_group_establishments_tenant_id_idx" ON "sync_group_establishments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sync_group_establishments_sync_group_id_idx" ON "sync_group_establishments" USING btree ("sync_group_id");--> statement-breakpoint
CREATE INDEX "sync_group_establishments_establishment_id_idx" ON "sync_group_establishments" USING btree ("establishment_id");--> statement-breakpoint
CREATE INDEX "sync_groups_tenant_id_idx" ON "sync_groups" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sync_logs_tenant_id_idx" ON "sync_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sync_logs_sync_group_id_idx" ON "sync_logs" USING btree ("sync_group_id");--> statement-breakpoint
CREATE INDEX "sync_logs_entity_type_idx" ON "sync_logs" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "sync_logs_created_at_idx" ON "sync_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sync_rules_tenant_id_idx" ON "sync_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sync_rules_sync_group_id_idx" ON "sync_rules" USING btree ("sync_group_id");--> statement-breakpoint
CREATE INDEX "tax_rates_tenant_id_idx" ON "tax_rates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tax_rates_rate_idx" ON "tax_rates" USING btree ("rate");--> statement-breakpoint
CREATE INDEX "tax_rates_code_idx" ON "tax_rates" USING btree ("code");--> statement-breakpoint
CREATE INDEX "variation_groups_tenant_id_idx" ON "variation_groups" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "variation_groups_name_idx" ON "variation_groups" USING btree ("name");--> statement-breakpoint
CREATE INDEX "variation_groups_establishment_idx" ON "variation_groups" USING btree ("created_by_establishment_id");--> statement-breakpoint
CREATE INDEX "variations_tenant_id_idx" ON "variations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "variations_group_id_idx" ON "variations" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "variations_name_idx" ON "variations" USING btree ("name");