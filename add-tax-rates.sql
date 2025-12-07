-- ==========================================
-- Migration : Ajout de la table tax_rates
-- ==========================================

-- 1. Créer la table tax_rates si elle n'existe pas
CREATE TABLE IF NOT EXISTS tax_rates (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  name VARCHAR(100) NOT NULL,
  rate DECIMAL(5, 2) NOT NULL,
  code VARCHAR(10) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. Créer les index
CREATE INDEX IF NOT EXISTS tax_rates_tenant_id_idx ON tax_rates(tenant_id);
CREATE INDEX IF NOT EXISTS tax_rates_rate_idx ON tax_rates(rate);
CREATE INDEX IF NOT EXISTS tax_rates_code_idx ON tax_rates(code);

-- 3. Ajouter tva_id dans products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'tva_id'
  ) THEN
    ALTER TABLE products ADD COLUMN tva_id INTEGER REFERENCES tax_rates(id);
  END IF;
END $$;

-- 4. Ajouter les colonnes TVA dans sale_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_items' AND column_name = 'tva_id'
  ) THEN
    ALTER TABLE sale_items ADD COLUMN tva_id INTEGER REFERENCES tax_rates(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_items' AND column_name = 'tva_rate'
  ) THEN
    ALTER TABLE sale_items ADD COLUMN tva_rate DECIMAL(5, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sale_items' AND column_name = 'tva_code'
  ) THEN
    ALTER TABLE sale_items ADD COLUMN tva_code VARCHAR(10);
  END IF;
END $$;

-- 5. Insérer les taux de TVA standards français (à adapter avec votre tenant_id)
-- Remplacez 'VOTRE_TENANT_ID' par votre vrai tenant_id
INSERT INTO tax_rates (tenant_id, name, rate, code, description, is_default)
SELECT
  'f831a590-f365-4302-8aaf-1a7ac06d357d',
  name,
  rate,
  code,
  description,
  is_default
FROM (VALUES
  ('TVA 20%', 20.00, 'T1', 'Taux normal', true),
  ('TVA 10%', 10.00, 'T2', 'Taux intermédiaire', false),
  ('TVA 5.5%', 5.50, 'T3', 'Taux réduit', false),
  ('TVA 2.1%', 2.10, 'T4', 'Taux super réduit', false),
  ('TVA 0%', 0.00, 'T0', 'Exonéré', false)
) AS v(name, rate, code, description, is_default)
WHERE NOT EXISTS (
  SELECT 1 FROM tax_rates
  WHERE tenant_id = 'f831a590-f365-4302-8aaf-1a7ac06d357d'
);

-- Si vous avez un second tenant :
INSERT INTO tax_rates (tenant_id, name, rate, code, description, is_default)
SELECT
  '9da91f8f-7513-451c-8a07-9008fa697a88',
  name,
  rate,
  code,
  description,
  is_default
FROM (VALUES
  ('TVA 20%', 20.00, 'T1', 'Taux normal', true),
  ('TVA 10%', 10.00, 'T2', 'Taux intermédiaire', false),
  ('TVA 5.5%', 5.50, 'T3', 'Taux réduit', false),
  ('TVA 2.1%', 2.10, 'T4', 'Taux super réduit', false),
  ('TVA 0%', 0.00, 'T0', 'Exonéré', false)
) AS v(name, rate, code, description, is_default)
WHERE NOT EXISTS (
  SELECT 1 FROM tax_rates
  WHERE tenant_id = '9da91f8f-7513-451c-8a07-9008fa697a88'
);
