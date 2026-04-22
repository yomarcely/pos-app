-- ==========================================
-- Migration: Synchronisation Multi-Établissements
-- ==========================================
-- Date: 2025-12-10
-- Description: Implémente la synchronisation des produits et clients entre établissements
--              avec gestion du stock par établissement et paramètres locaux personnalisables
-- Bénéfice:
--   - Partage de catalogue produits/clients entre établissements
--   - Stock indépendant par établissement
--   - Prix et paramètres personnalisables par établissement
--   - Synchronisation flexible avec règles configurables

-- ==========================================
-- 1. TABLE DES GROUPES DE SYNCHRONISATION
-- ==========================================
CREATE TABLE IF NOT EXISTS "sync_groups" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "sync_groups_tenant_id_idx" ON "sync_groups" ("tenant_id");

COMMENT ON TABLE "sync_groups" IS 'Groupes de synchronisation pour partager produits/clients entre établissements';

-- ==========================================
-- 2. ÉTABLISSEMENTS DANS LES GROUPES DE SYNC
-- ==========================================
CREATE TABLE IF NOT EXISTS "sync_group_establishments" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "sync_group_id" INTEGER NOT NULL REFERENCES "sync_groups"("id") ON DELETE CASCADE,
  "establishment_id" INTEGER NOT NULL REFERENCES "establishments"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Un établissement ne peut être dans un groupe qu'une seule fois
  UNIQUE("sync_group_id", "establishment_id")
);

CREATE INDEX IF NOT EXISTS "sync_group_establishments_tenant_id_idx" ON "sync_group_establishments" ("tenant_id");
CREATE INDEX IF NOT EXISTS "sync_group_establishments_sync_group_id_idx" ON "sync_group_establishments" ("sync_group_id");
CREATE INDEX IF NOT EXISTS "sync_group_establishments_establishment_id_idx" ON "sync_group_establishments" ("establishment_id");

COMMENT ON TABLE "sync_group_establishments" IS 'Liaison many-to-many entre groupes de sync et établissements';

-- ==========================================
-- 3. RÈGLES DE SYNCHRONISATION
-- ==========================================
CREATE TABLE IF NOT EXISTS "sync_rules" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "sync_group_id" INTEGER NOT NULL REFERENCES "sync_groups"("id") ON DELETE CASCADE,
  "entity_type" VARCHAR(50) NOT NULL, -- 'product' ou 'customer'

  -- Champs à synchroniser pour les PRODUITS
  "sync_name" BOOLEAN DEFAULT true,
  "sync_description" BOOLEAN DEFAULT true,
  "sync_barcode" BOOLEAN DEFAULT true,
  "sync_category" BOOLEAN DEFAULT true,
  "sync_supplier" BOOLEAN DEFAULT true,
  "sync_brand" BOOLEAN DEFAULT true,
  "sync_price_ht" BOOLEAN DEFAULT true,
  "sync_price_ttc" BOOLEAN DEFAULT false, -- Prix TTC peut être différent par établissement
  "sync_tva" BOOLEAN DEFAULT true,
  "sync_image" BOOLEAN DEFAULT true,
  "sync_variations" BOOLEAN DEFAULT true,

  -- Champs à synchroniser pour les CLIENTS
  "sync_customer_info" BOOLEAN DEFAULT true, -- nom, prénom
  "sync_customer_contact" BOOLEAN DEFAULT true, -- email, tel
  "sync_customer_address" BOOLEAN DEFAULT true,
  "sync_customer_gdpr" BOOLEAN DEFAULT true,
  "sync_loyalty_program" BOOLEAN DEFAULT false, -- fidélité locale ou partagée ?
  "sync_discount" BOOLEAN DEFAULT false,

  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Un groupe de sync ne peut avoir qu'une seule règle par type d'entité
  UNIQUE("sync_group_id", "entity_type")
);

CREATE INDEX IF NOT EXISTS "sync_rules_tenant_id_idx" ON "sync_rules" ("tenant_id");
CREATE INDEX IF NOT EXISTS "sync_rules_sync_group_id_idx" ON "sync_rules" ("sync_group_id");

COMMENT ON TABLE "sync_rules" IS 'Règles de synchronisation configurables par groupe';

-- ==========================================
-- 4. STOCK PAR ÉTABLISSEMENT
-- ==========================================
CREATE TABLE IF NOT EXISTS "product_stocks" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "product_id" INTEGER NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "establishment_id" INTEGER NOT NULL REFERENCES "establishments"("id") ON DELETE CASCADE,

  -- Stock global ou par variation
  "stock" INTEGER DEFAULT 0,
  "stock_by_variation" JSONB DEFAULT '[]'::jsonb,

  "min_stock" INTEGER DEFAULT 5,
  "min_stock_by_variation" JSONB,

  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Un produit ne peut avoir qu'un seul stock par établissement
  UNIQUE("product_id", "establishment_id")
);

CREATE INDEX IF NOT EXISTS "product_stocks_tenant_id_idx" ON "product_stocks" ("tenant_id");
CREATE INDEX IF NOT EXISTS "product_stocks_product_id_idx" ON "product_stocks" ("product_id");
CREATE INDEX IF NOT EXISTS "product_stocks_establishment_id_idx" ON "product_stocks" ("establishment_id");

COMMENT ON TABLE "product_stocks" IS 'Stock indépendant par produit et par établissement';

-- ==========================================
-- 5. PARAMÈTRES PRODUITS PAR ÉTABLISSEMENT
-- ==========================================
CREATE TABLE IF NOT EXISTS "product_establishments" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "product_id" INTEGER NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "establishment_id" INTEGER NOT NULL REFERENCES "establishments"("id") ON DELETE CASCADE,

  -- Prix spécifiques par établissement (si sync_price_ttc = FALSE)
  "price_override" DECIMAL(10, 2), -- Prix TTC local si différent
  "purchase_price_override" DECIMAL(10, 2),

  -- Autres paramètres locaux
  "is_available" BOOLEAN DEFAULT true, -- Produit disponible dans cet établissement ?
  "notes" TEXT, -- Notes spécifiques à l'établissement

  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Un produit ne peut avoir qu'un seul paramétrage par établissement
  UNIQUE("product_id", "establishment_id")
);

CREATE INDEX IF NOT EXISTS "product_establishments_tenant_id_idx" ON "product_establishments" ("tenant_id");
CREATE INDEX IF NOT EXISTS "product_establishments_product_id_idx" ON "product_establishments" ("product_id");
CREATE INDEX IF NOT EXISTS "product_establishments_establishment_id_idx" ON "product_establishments" ("establishment_id");

COMMENT ON TABLE "product_establishments" IS 'Paramètres spécifiques par produit et établissement (prix locaux, disponibilité)';

-- Colonnes d'override pour les champs non synchronisés (fusionné depuis 0007_icy_madripoor.sql)
ALTER TABLE "product_establishments" ADD COLUMN "supplier_id_override" integer;
ALTER TABLE "product_establishments" ADD COLUMN "category_id_override" integer;
ALTER TABLE "product_establishments" ADD COLUMN "brand_id_override" integer;

-- ==========================================
-- 6. CLIENTS PAR ÉTABLISSEMENT
-- ==========================================
CREATE TABLE IF NOT EXISTS "customer_establishments" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "customer_id" INTEGER NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "establishment_id" INTEGER NOT NULL REFERENCES "establishments"("id") ON DELETE CASCADE,

  -- Paramètres locaux
  "local_discount" DECIMAL(5, 2), -- Remise spécifique à cet établissement
  "local_notes" TEXT,

  -- Fidélité locale ou globale ?
  "local_loyalty_points" INTEGER DEFAULT 0,

  "first_purchase_date" TIMESTAMP WITH TIME ZONE,
  "last_purchase_date" TIMESTAMP WITH TIME ZONE,
  "total_purchases" DECIMAL(10, 2) DEFAULT 0,
  "purchase_count" INTEGER DEFAULT 0,

  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

  -- Un client ne peut avoir qu'un seul profil par établissement
  UNIQUE("customer_id", "establishment_id")
);

CREATE INDEX IF NOT EXISTS "customer_establishments_tenant_id_idx" ON "customer_establishments" ("tenant_id");
CREATE INDEX IF NOT EXISTS "customer_establishments_customer_id_idx" ON "customer_establishments" ("customer_id");
CREATE INDEX IF NOT EXISTS "customer_establishments_establishment_id_idx" ON "customer_establishments" ("establishment_id");

COMMENT ON TABLE "customer_establishments" IS 'Statistiques et paramètres clients par établissement';

-- ==========================================
-- 7. LOGS DE SYNCHRONISATION (Audit NF525)
-- ==========================================
CREATE TABLE IF NOT EXISTS "sync_logs" (
  "id" SERIAL PRIMARY KEY,
  "tenant_id" VARCHAR(64) NOT NULL,
  "sync_group_id" INTEGER NOT NULL REFERENCES "sync_groups"("id") ON DELETE CASCADE,
  "entity_type" VARCHAR(50) NOT NULL,
  "entity_id" INTEGER NOT NULL,
  "source_establishment_id" INTEGER REFERENCES "establishments"("id"),
  "action" VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete'
  "synced_fields" JSONB,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "sync_logs_tenant_id_idx" ON "sync_logs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "sync_logs_sync_group_id_idx" ON "sync_logs" ("sync_group_id");
CREATE INDEX IF NOT EXISTS "sync_logs_entity_type_idx" ON "sync_logs" ("entity_type");
CREATE INDEX IF NOT EXISTS "sync_logs_created_at_idx" ON "sync_logs" ("created_at");

COMMENT ON TABLE "sync_logs" IS 'Historique des synchronisations (audit NF525)';

-- ==========================================
-- 8. AJOUT COLONNE establishment_id À stock_movements
-- ==========================================
-- Ajouter la colonne establishment_id pour tracer les mouvements par établissement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_movements'
    AND column_name = 'establishment_id'
  ) THEN
    ALTER TABLE "stock_movements"
    ADD COLUMN "establishment_id" INTEGER REFERENCES "establishments"("id");

    CREATE INDEX "stock_movements_establishment_id_idx" ON "stock_movements" ("establishment_id");
  END IF;
END $$;

COMMENT ON COLUMN "stock_movements"."establishment_id" IS 'Établissement concerné par le mouvement de stock';

-- ==========================================
-- 9. MIGRATION DES DONNÉES EXISTANTES
-- ==========================================
-- Migrer le stock actuel des produits vers product_stocks
-- pour tous les établissements existants

DO $$
BEGIN
  -- Vérifier s'il y a des données à migrer
  IF EXISTS (SELECT 1 FROM products LIMIT 1) AND
     EXISTS (SELECT 1 FROM establishments LIMIT 1) AND
     NOT EXISTS (SELECT 1 FROM product_stocks LIMIT 1) THEN

    -- Créer un stock pour chaque produit dans chaque établissement du même tenant
    INSERT INTO "product_stocks" (
      "tenant_id",
      "product_id",
      "establishment_id",
      "stock",
      "stock_by_variation",
      "min_stock",
      "min_stock_by_variation"
    )
    SELECT
      p."tenant_id",
      p."id" as product_id,
      e."id" as establishment_id,
      p."stock",
      p."stock_by_variation",
      p."min_stock",
      p."min_stock_by_variation"
    FROM "products" p
    CROSS JOIN "establishments" e
    WHERE p."tenant_id" = e."tenant_id"
    ON CONFLICT ("product_id", "establishment_id") DO NOTHING;

    RAISE NOTICE 'Migration du stock des produits vers product_stocks effectuée';
  END IF;
END $$;

-- ==========================================
-- 10. COMMENTAIRES COMPLÉMENTAIRES
-- ==========================================
COMMENT ON COLUMN "products"."stock" IS 'Stock global (DEPRECATED - utiliser product_stocks)';
COMMENT ON COLUMN "products"."stock_by_variation" IS 'Stock par variation (DEPRECATED - utiliser product_stocks)';

-- ==========================================
-- 11. POLITIQUES RLS (Row Level Security)
-- ==========================================
-- Sécuriser l'accès aux nouvelles tables

-- SYNC_GROUPS
ALTER TABLE sync_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own sync groups" ON sync_groups FOR SELECT TO authenticated USING (tenant_id = auth.uid()::TEXT);
CREATE POLICY "Users can create their own sync groups" ON sync_groups FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.uid()::TEXT);
CREATE POLICY "Users can update their own sync groups" ON sync_groups FOR UPDATE TO authenticated USING (tenant_id = auth.uid()::TEXT) WITH CHECK (tenant_id = auth.uid()::TEXT);
CREATE POLICY "Users can delete their own sync groups" ON sync_groups FOR DELETE TO authenticated USING (tenant_id = auth.uid()::TEXT);

-- SYNC_GROUP_ESTABLISHMENTS
ALTER TABLE sync_group_establishments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own sync group establishments" ON sync_group_establishments FOR SELECT TO authenticated USING (tenant_id = auth.uid()::TEXT);
CREATE POLICY "Users can create their own sync group establishments" ON sync_group_establishments FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.uid()::TEXT);
CREATE POLICY "Users can update their own sync group establishments" ON sync_group_establishments FOR UPDATE TO authenticated USING (tenant_id = auth.uid()::TEXT) WITH CHECK (tenant_id = auth.uid()::TEXT);
CREATE POLICY "Users can delete their own sync group establishments" ON sync_group_establishments FOR DELETE TO authenticated USING (tenant_id = auth.uid()::TEXT);

-- SYNC_RULES
ALTER TABLE sync_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own sync rules" ON sync_rules FOR SELECT TO authenticated USING (tenant_id = auth.uid()::TEXT);
CREATE POLICY "Users can create their own sync rules" ON sync_rules FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.uid()::TEXT);
CREATE POLICY "Users can update their own sync rules" ON sync_rules FOR UPDATE TO authenticated USING (tenant_id = auth.uid()::TEXT) WITH CHECK (tenant_id = auth.uid()::TEXT);
CREATE POLICY "Users can delete their own sync rules" ON sync_rules FOR DELETE TO authenticated USING (tenant_id = auth.uid()::TEXT);

-- PRODUCT_STOCKS
ALTER TABLE product_stocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own product stocks" ON product_stocks FOR SELECT TO authenticated USING (tenant_id = auth.uid()::TEXT);
CREATE POLICY "Users can create their own product stocks" ON product_stocks FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.uid()::TEXT);
CREATE POLICY "Users can update their own product stocks" ON product_stocks FOR UPDATE TO authenticated USING (tenant_id = auth.uid()::TEXT) WITH CHECK (tenant_id = auth.uid()::TEXT);
CREATE POLICY "Users can delete their own product stocks" ON product_stocks FOR DELETE TO authenticated USING (tenant_id = auth.uid()::TEXT);

-- PRODUCT_ESTABLISHMENTS
ALTER TABLE product_establishments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own product establishments" ON product_establishments FOR SELECT TO authenticated USING (tenant_id = auth.uid()::TEXT);
CREATE POLICY "Users can create their own product establishments" ON product_establishments FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.uid()::TEXT);
CREATE POLICY "Users can update their own product establishments" ON product_establishments FOR UPDATE TO authenticated USING (tenant_id = auth.uid()::TEXT) WITH CHECK (tenant_id = auth.uid()::TEXT);
CREATE POLICY "Users can delete their own product establishments" ON product_establishments FOR DELETE TO authenticated USING (tenant_id = auth.uid()::TEXT);

-- CUSTOMER_ESTABLISHMENTS
ALTER TABLE customer_establishments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own customer establishments" ON customer_establishments FOR SELECT TO authenticated USING (tenant_id = auth.uid()::TEXT);
CREATE POLICY "Users can create their own customer establishments" ON customer_establishments FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.uid()::TEXT);
CREATE POLICY "Users can update their own customer establishments" ON customer_establishments FOR UPDATE TO authenticated USING (tenant_id = auth.uid()::TEXT) WITH CHECK (tenant_id = auth.uid()::TEXT);
CREATE POLICY "Users can delete their own customer establishments" ON customer_establishments FOR DELETE TO authenticated USING (tenant_id = auth.uid()::TEXT);

-- SYNC_LOGS (Read-Only après insertion - conformité NF525)
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own sync logs" ON sync_logs FOR SELECT TO authenticated USING (tenant_id = auth.uid()::TEXT);
CREATE POLICY "Users can create their own sync logs" ON sync_logs FOR INSERT TO authenticated WITH CHECK (tenant_id = auth.uid()::TEXT);

-- ==========================================
-- FIN DE LA MIGRATION
-- ==========================================
