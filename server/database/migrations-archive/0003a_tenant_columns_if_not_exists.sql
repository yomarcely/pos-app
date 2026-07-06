-- Ajout (idempotent) des colonnes tenant_id + indexes sur toutes les tables

DO $$ BEGIN
  ALTER TABLE "archives" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(64) NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(64) NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(64) NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(64) NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "closures" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(64) NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(64) NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "movements" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(64) NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(64) NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(64) NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(64) NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "sellers" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(64) NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(64) NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(64) NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "variation_groups" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(64) NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "variations" ADD COLUMN IF NOT EXISTS "tenant_id" varchar(64) NOT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "archives_tenant_id_idx" ON "archives" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_id_idx" ON "audit_logs" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "brands_tenant_id_idx" ON "brands" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "categories_tenant_id_idx" ON "categories" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "closures_tenant_id_idx" ON "closures" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "customers_tenant_id_idx" ON "customers" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "movements_tenant_id_idx" ON "movements" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "products_tenant_id_idx" ON "products" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "sale_items_tenant_id_idx" ON "sale_items" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "sales_tenant_id_idx" ON "sales" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "sellers_tenant_id_idx" ON "sellers" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "stock_movements_tenant_id_idx" ON "stock_movements" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "suppliers_tenant_id_idx" ON "suppliers" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "variation_groups_tenant_id_idx" ON "variation_groups" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "variations_tenant_id_idx" ON "variations" USING btree ("tenant_id");
