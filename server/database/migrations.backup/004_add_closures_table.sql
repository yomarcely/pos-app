-- ==========================================
-- Migration: Ajouter la table closures et les colonnes de clôture dans sales
-- ==========================================

-- 1. Créer la table closures
CREATE TABLE IF NOT EXISTS closures (
  id SERIAL PRIMARY KEY,

  -- Date de la journée clôturée
  closure_date VARCHAR(10) NOT NULL,

  -- Statistiques de la journée
  ticket_count INTEGER NOT NULL DEFAULT 0,
  cancelled_count INTEGER NOT NULL DEFAULT 0,

  -- Totaux
  total_ht DECIMAL(12, 2) NOT NULL,
  total_tva DECIMAL(12, 2) NOT NULL,
  total_ttc DECIMAL(12, 2) NOT NULL,

  -- Modes de paiement
  payment_methods JSONB NOT NULL,

  -- Hash NF525 de clôture
  closure_hash VARCHAR(64) NOT NULL UNIQUE,

  -- Premier et dernier ticket de la journée
  first_ticket_number VARCHAR(50),
  last_ticket_number VARCHAR(50),
  last_ticket_hash VARCHAR(64),

  -- Métadonnées
  closed_by VARCHAR(100),
  closed_by_id INTEGER,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Créer les index
CREATE INDEX IF NOT EXISTS closures_closure_date_idx ON closures(closure_date);
CREATE INDEX IF NOT EXISTS closures_closure_hash_idx ON closures(closure_hash);

-- 3. Ajouter les colonnes de clôture à la table sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS closure_id INTEGER REFERENCES closures(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

-- 4. Créer l'index sur closure_id
CREATE INDEX IF NOT EXISTS sales_closure_id_idx ON sales(closure_id);

-- 5. Commentaires pour documentation
COMMENT ON TABLE closures IS 'Table des clôtures journalières conformes NF525';
COMMENT ON COLUMN closures.closure_hash IS 'Hash SHA-256 cryptographique de la clôture pour garantir l''inaltérabilité';
COMMENT ON COLUMN sales.closure_id IS 'Référence à la clôture journalière si la vente a été clôturée';
COMMENT ON COLUMN sales.closed_at IS 'Date et heure de clôture de la vente';
