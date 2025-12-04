
-- ==========================================
-- SCHÉMA COMPLET POS APP - Base de données
-- ==========================================
-- À exécuter dans le SQL Editor de Supabase
-- https://supabase.com/dashboard/project/sbsdlmwtlvejfnszxrcp/sql/new
-- ==========================================

-- Activer les extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Pour la recherche full-text

-- ==========================================
-- SUPPRESSION DES TABLES (ATTENTION!)
-- Décommenter seulement si vous voulez TOUT RECRÉER
-- ==========================================
/*
DROP TABLE IF EXISTS "audit_logs" CASCADE;
DROP TABLE IF EXISTS "archives" CASCADE;
DROP TABLE IF EXISTS "stock_movements" CASCADE;
DROP TABLE IF EXISTS "sale_items" CASCADE;
DROP TABLE IF EXISTS "sales" CASCADE;
DROP TABLE IF EXISTS "closures" CASCADE;
DROP TABLE IF EXISTS "movements" CASCADE;
DROP TABLE IF EXISTS "products" CASCADE;
DROP TABLE IF EXISTS "variations" CASCADE;
DROP TABLE IF EXISTS "variation_groups" CASCADE;
DROP TABLE IF EXISTS "brands" CASCADE;
DROP TABLE IF EXISTS "categories" CASCADE;
DROP TABLE IF EXISTS "suppliers" CASCADE;
DROP TABLE IF EXISTS "customers" CASCADE;
DROP TABLE IF EXISTS "sellers" CASCADE;
*/

-- ==========================================
-- 1. SELLERS (Vendeurs/Caissiers)
-- ==========================================
CREATE TABLE IF NOT EXISTS "sellers" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "email" VARCHAR(255),
  "phone" VARCHAR(50),
  "role" VARCHAR(50) DEFAULT 'cashier',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "sellers_tenant_id_idx" ON "sellers" ("tenant_id");

-- ==========================================
-- 2. CUSTOMERS (Clients)
-- ==========================================
CREATE TABLE IF NOT EXISTS "customers" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "first_name" VARCHAR(255) NOT NULL,
  "last_name" VARCHAR(255),
  "company" VARCHAR(255),
  "email" VARCHAR(255),
  "phone" VARCHAR(50),
  "mobile" VARCHAR(50),
  "address" TEXT,
  "postal_code" VARCHAR(20),
  "city" VARCHAR(100),
  "country" VARCHAR(100) DEFAULT 'France',
  "notes" TEXT,
  "customer_type" VARCHAR(20) DEFAULT 'individual',
  "loyalty_points" INTEGER DEFAULT 0,
  "rgpd_consent" BOOLEAN DEFAULT false,
  "rgpd_consent_date" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "customers_tenant_id_idx" ON "customers" ("tenant_id");
CREATE INDEX IF NOT EXISTS "customers_email_idx" ON "customers" ("email");
CREATE INDEX IF NOT EXISTS "customers_phone_idx" ON "customers" ("phone");

-- ==========================================
-- 3. SUPPLIERS (Fournisseurs)
-- ==========================================
CREATE TABLE IF NOT EXISTS "suppliers" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "contact_name" VARCHAR(255),
  "email" VARCHAR(255),
  "phone" VARCHAR(50),
  "address" TEXT,
  "postal_code" VARCHAR(20),
  "city" VARCHAR(100),
  "country" VARCHAR(100) DEFAULT 'France',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "suppliers_tenant_id_idx" ON "suppliers" ("tenant_id");

-- ==========================================
-- 4. CATEGORIES (Catégories de produits)
-- ==========================================
CREATE TABLE IF NOT EXISTS "categories" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "parent_id" INTEGER REFERENCES "categories"("id") ON DELETE SET NULL,
  "color" VARCHAR(7),
  "icon" VARCHAR(50),
  "display_order" INTEGER DEFAULT 0,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "categories_tenant_id_idx" ON "categories" ("tenant_id");
CREATE INDEX IF NOT EXISTS "categories_parent_id_idx" ON "categories" ("parent_id");

-- ==========================================
-- 5. BRANDS (Marques)
-- ==========================================
CREATE TABLE IF NOT EXISTS "brands" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "logo_url" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "brands_tenant_id_idx" ON "brands" ("tenant_id");

-- ==========================================
-- 6. VARIATION GROUPS (Groupes de variations)
-- ==========================================
CREATE TABLE IF NOT EXISTS "variation_groups" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "display_order" INTEGER DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "variation_groups_tenant_id_idx" ON "variation_groups" ("tenant_id");

-- ==========================================
-- 7. VARIATIONS (Variations)
-- ==========================================
CREATE TABLE IF NOT EXISTS "variations" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "group_id" INTEGER NOT NULL REFERENCES "variation_groups"("id") ON DELETE CASCADE,
  "name" VARCHAR(255) NOT NULL,
  "price_modifier" DECIMAL(10, 2) DEFAULT 0,
  "modifier_type" VARCHAR(10) DEFAULT 'add',
  "display_order" INTEGER DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "variations_tenant_id_idx" ON "variations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "variations_group_id_idx" ON "variations" ("group_id");

-- ==========================================
-- 8. PRODUCTS (Produits)
-- ==========================================
CREATE TABLE IF NOT EXISTS "products" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "sku" VARCHAR(100),
  "barcode" VARCHAR(100),
  "category_id" INTEGER REFERENCES "categories"("id") ON DELETE SET NULL,
  "brand_id" INTEGER REFERENCES "brands"("id") ON DELETE SET NULL,
  "supplier_id" INTEGER REFERENCES "suppliers"("id") ON DELETE SET NULL,
  "price_ht" DECIMAL(10, 2) NOT NULL,
  "price_ttc" DECIMAL(10, 2) NOT NULL,
  "tva_rate" DECIMAL(5, 2) NOT NULL DEFAULT 20,
  "cost_price" DECIMAL(10, 2),
  "stock_quantity" INTEGER DEFAULT 0,
  "stock_alert_threshold" INTEGER DEFAULT 5,
  "image_url" TEXT,
  "is_active" BOOLEAN DEFAULT true,
  "has_variations" BOOLEAN DEFAULT false,
  "variation_group_id" INTEGER REFERENCES "variation_groups"("id"),
  "unit" VARCHAR(20) DEFAULT 'unit',
  "weight" DECIMAL(10, 3),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "products_tenant_id_idx" ON "products" ("tenant_id");
CREATE INDEX IF NOT EXISTS "products_sku_idx" ON "products" ("sku");
CREATE INDEX IF NOT EXISTS "products_barcode_idx" ON "products" ("barcode");
CREATE INDEX IF NOT EXISTS "products_category_id_idx" ON "products" ("category_id");
CREATE INDEX IF NOT EXISTS "products_brand_id_idx" ON "products" ("brand_id");

-- ==========================================
-- 9. CLOSURES (Clôtures de caisse)
-- ==========================================
CREATE TABLE IF NOT EXISTS "closures" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "closure_number" VARCHAR(50) NOT NULL UNIQUE,
  "closure_date" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "seller_id" INTEGER REFERENCES "sellers"("id"),
  "sales_count" INTEGER DEFAULT 0,
  "total_cash" DECIMAL(10, 2) DEFAULT 0,
  "total_card" DECIMAL(10, 2) DEFAULT 0,
  "total_check" DECIMAL(10, 2) DEFAULT 0,
  "total_other" DECIMAL(10, 2) DEFAULT 0,
  "total_revenue" DECIMAL(10, 2) DEFAULT 0,
  "grand_total_cumulative" DECIMAL(15, 2) NOT NULL,
  "status" VARCHAR(20) DEFAULT 'open',
  "notes" TEXT,
  "closed_by" INTEGER REFERENCES "sellers"("id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "closures_tenant_id_idx" ON "closures" ("tenant_id");
CREATE INDEX IF NOT EXISTS "closures_closure_number_idx" ON "closures" ("closure_number");

-- ==========================================
-- 10. SALES (Ventes - Tickets de caisse NF525)
-- ==========================================
CREATE TABLE IF NOT EXISTS "sales" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "ticket_number" VARCHAR(50) NOT NULL UNIQUE,
  "sale_date" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "total_ht" DECIMAL(10, 2) NOT NULL,
  "total_tva" DECIMAL(10, 2) NOT NULL,
  "total_ttc" DECIMAL(10, 2) NOT NULL,
  "global_discount" DECIMAL(10, 2) DEFAULT 0,
  "global_discount_type" VARCHAR(1) DEFAULT '%',
  "seller_id" INTEGER REFERENCES "sellers"("id"),
  "customer_id" INTEGER REFERENCES "customers"("id"),
  "payments" JSONB NOT NULL,
  "previous_hash" VARCHAR(64),
  "current_hash" VARCHAR(64) NOT NULL,
  "signature" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'completed',
  "cancellation_reason" TEXT,
  "cancelled_at" TIMESTAMPTZ,
  "closure_id" INTEGER REFERENCES "closures"("id"),
  "closed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "sales_tenant_id_idx" ON "sales" ("tenant_id");
CREATE INDEX IF NOT EXISTS "sales_ticket_number_idx" ON "sales" ("ticket_number");
CREATE INDEX IF NOT EXISTS "sales_sale_date_idx" ON "sales" ("sale_date");
CREATE INDEX IF NOT EXISTS "sales_closure_id_idx" ON "sales" ("closure_id");

-- ==========================================
-- 11. SALE ITEMS (Lignes de vente)
-- ==========================================
CREATE TABLE IF NOT EXISTS "sale_items" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "sale_id" INTEGER NOT NULL REFERENCES "sales"("id") ON DELETE CASCADE,
  "product_id" INTEGER NOT NULL REFERENCES "products"("id"),
  "product_name" VARCHAR(255) NOT NULL,
  "variation" VARCHAR(100),
  "quantity" INTEGER NOT NULL,
  "unit_price_ht" DECIMAL(10, 2) NOT NULL,
  "unit_price_ttc" DECIMAL(10, 2) NOT NULL,
  "tva_rate" DECIMAL(5, 2) NOT NULL,
  "discount" DECIMAL(10, 2) DEFAULT 0,
  "discount_type" VARCHAR(1) DEFAULT '%',
  "subtotal_ht" DECIMAL(10, 2) NOT NULL,
  "subtotal_ttc" DECIMAL(10, 2) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "sale_items_tenant_id_idx" ON "sale_items" ("tenant_id");

-- ==========================================
-- 12. STOCK MOVEMENTS (Mouvements de stock)
-- ==========================================
CREATE TABLE IF NOT EXISTS "stock_movements" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "product_id" INTEGER NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "movement_type" VARCHAR(20) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "previous_stock" INTEGER NOT NULL,
  "new_stock" INTEGER NOT NULL,
  "unit_cost" DECIMAL(10, 2),
  "reference" VARCHAR(100),
  "notes" TEXT,
  "created_by" INTEGER REFERENCES "sellers"("id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "stock_movements_tenant_id_idx" ON "stock_movements" ("tenant_id");
CREATE INDEX IF NOT EXISTS "stock_movements_product_id_idx" ON "stock_movements" ("product_id");
CREATE INDEX IF NOT EXISTS "stock_movements_created_at_idx" ON "stock_movements" ("created_at");
CREATE INDEX IF NOT EXISTS "stock_movements_movement_type_idx" ON "stock_movements" ("movement_type");

-- ==========================================
-- 13. MOVEMENTS (Journal général)
-- ==========================================
CREATE TABLE IF NOT EXISTS "movements" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "movement_type" VARCHAR(50) NOT NULL,
  "entity_type" VARCHAR(50) NOT NULL,
  "entity_id" INTEGER NOT NULL,
  "data" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "movements_tenant_id_idx" ON "movements" ("tenant_id");
CREATE INDEX IF NOT EXISTS "movements_entity_type_idx" ON "movements" ("entity_type");
CREATE INDEX IF NOT EXISTS "movements_created_at_idx" ON "movements" ("created_at");

-- ==========================================
-- 14. ARCHIVES (Archives NF525)
-- ==========================================
CREATE TABLE IF NOT EXISTS "archives" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "archive_type" VARCHAR(50) NOT NULL,
  "period_start" TIMESTAMPTZ NOT NULL,
  "period_end" TIMESTAMPTZ NOT NULL,
  "file_path" TEXT NOT NULL,
  "file_hash" VARCHAR(64) NOT NULL,
  "file_size" INTEGER,
  "status" VARCHAR(20) DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "archives_tenant_id_idx" ON "archives" ("tenant_id");
CREATE INDEX IF NOT EXISTS "archives_created_at_idx" ON "archives" ("created_at");

-- ==========================================
-- 15. AUDIT LOGS (Logs d'audit)
-- ==========================================
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "action" VARCHAR(100) NOT NULL,
  "entity_type" VARCHAR(50) NOT NULL,
  "entity_id" INTEGER NOT NULL,
  "user_id" INTEGER,
  "ip_address" VARCHAR(45),
  "user_agent" TEXT,
  "old_values" JSONB,
  "new_values" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "audit_logs_tenant_id_idx" ON "audit_logs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_idx" ON "audit_logs" ("entity_type");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_id_idx" ON "audit_logs" ("entity_id");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at");

-- ==========================================
-- FONCTIONS ET TRIGGERS
-- ==========================================

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Appliquer le trigger à toutes les tables avec updated_at
CREATE TRIGGER update_sellers_updated_at BEFORE UPDATE ON sellers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_variation_groups_updated_at BEFORE UPDATE ON variation_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_variations_updated_at BEFORE UPDATE ON variations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_closures_updated_at BEFORE UPDATE ON closures FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- FIN DU SCHÉMA
-- ==========================================

SELECT 'Schéma créé avec succès!' as message;

