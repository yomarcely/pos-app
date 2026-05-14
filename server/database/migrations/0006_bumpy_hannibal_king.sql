CREATE TABLE IF NOT EXISTS "seller_establishments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"seller_id" integer NOT NULL,
	"establishment_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tax_rates" (
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
ALTER TABLE "archives" ALTER COLUMN "file_path" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "entity_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "tva" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "tva" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_items" ALTER COLUMN "tva" DROP NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'archives' AND column_name = 'period') THEN
    ALTER TABLE "archives" ADD COLUMN "period" varchar(20) NOT NULL DEFAULT '';
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'archives' AND column_name = 'register_id') THEN
    ALTER TABLE "archives" ADD COLUMN "register_id" integer;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'archives' AND column_name = 'archive_hash') THEN
    ALTER TABLE "archives" ADD COLUMN "archive_hash" varchar(64) NOT NULL DEFAULT '';
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'archives' AND column_name = 'archive_signature') THEN
    ALTER TABLE "archives" ADD COLUMN "archive_signature" varchar(64);
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'archives' AND column_name = 'closures_count') THEN
    ALTER TABLE "archives" ADD COLUMN "closures_count" integer DEFAULT 0 NOT NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'archives' AND column_name = 'metadata') THEN
    ALTER TABLE "archives" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'closures' AND column_name = 'register_id') THEN
    ALTER TABLE "closures" ADD COLUMN "register_id" integer NOT NULL DEFAULT 1;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'closures' AND column_name = 'establishment_id') THEN
    ALTER TABLE "closures" ADD COLUMN "establishment_id" integer;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'tva_id') THEN
    ALTER TABLE "products" ADD COLUMN "tva_id" integer;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'tva_id') THEN
    ALTER TABLE "sale_items" ADD COLUMN "tva_id" integer;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'tva_rate') THEN
    ALTER TABLE "sale_items" ADD COLUMN "tva_rate" numeric(5, 2);
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'tva_code') THEN
    ALTER TABLE "sale_items" ADD COLUMN "tva_code" varchar(10);
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seller_establishments_seller_id_sellers_id_fk') THEN
    ALTER TABLE "seller_establishments" ADD CONSTRAINT "seller_establishments_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seller_establishments_establishment_id_establishments_id_fk') THEN
    ALTER TABLE "seller_establishments" ADD CONSTRAINT "seller_establishments_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seller_establishments_tenant_id_idx" ON "seller_establishments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seller_establishments_seller_id_idx" ON "seller_establishments" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seller_establishments_establishment_id_idx" ON "seller_establishments" USING btree ("establishment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tax_rates_tenant_id_idx" ON "tax_rates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tax_rates_rate_idx" ON "tax_rates" USING btree ("rate");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tax_rates_code_idx" ON "tax_rates" USING btree ("code");--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'closures_register_id_registers_id_fk') THEN
    ALTER TABLE "closures" ADD CONSTRAINT "closures_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'closures_establishment_id_establishments_id_fk') THEN
    ALTER TABLE "closures" ADD CONSTRAINT "closures_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_tva_id_tax_rates_id_fk') THEN
    ALTER TABLE "products" ADD CONSTRAINT "products_tva_id_tax_rates_id_fk" FOREIGN KEY ("tva_id") REFERENCES "public"."tax_rates"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_tva_id_tax_rates_id_fk') THEN
    ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_tva_id_tax_rates_id_fk" FOREIGN KEY ("tva_id") REFERENCES "public"."tax_rates"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "closures_register_id_idx" ON "closures" USING btree ("register_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "closures_establishment_id_idx" ON "closures" USING btree ("establishment_id");--> statement-breakpoint
ALTER TABLE "archives" DROP COLUMN "file_hash";