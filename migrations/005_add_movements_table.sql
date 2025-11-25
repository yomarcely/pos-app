-- Migration: Ajout de la table movements et modification de stock_movements
-- Date: 2025-11-25
-- Description: Regroupe les mouvements de stock en opérations avec numérotation

-- 1. Créer la table movements
CREATE TABLE IF NOT EXISTS movements (
  id SERIAL PRIMARY KEY,
  movement_number VARCHAR(50) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL,
  comment TEXT,
  user_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index pour la table movements
CREATE INDEX IF NOT EXISTS movements_type_idx ON movements(type);
CREATE INDEX IF NOT EXISTS movements_created_at_idx ON movements(created_at);
CREATE INDEX IF NOT EXISTS movements_movement_number_idx ON movements(movement_number);

-- 2. Ajouter la colonne movement_id à stock_movements
ALTER TABLE stock_movements
ADD COLUMN IF NOT EXISTS movement_id INTEGER REFERENCES movements(id) ON DELETE CASCADE;

-- Index pour movement_id
CREATE INDEX IF NOT EXISTS stock_movements_movement_id_idx ON stock_movements(movement_id);

-- 3. Créer une fonction pour générer les numéros de mouvement
CREATE OR REPLACE FUNCTION generate_movement_number(movement_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  prefix VARCHAR(10);
  next_number INTEGER;
  formatted_number VARCHAR(50);
BEGIN
  -- Déterminer le préfixe selon le type
  CASE movement_type
    WHEN 'reception' THEN prefix := 'REC';
    WHEN 'adjustment' THEN prefix := 'ADJ';
    WHEN 'loss' THEN prefix := 'LOSS';
    WHEN 'transfer' THEN prefix := 'TRANS';
    ELSE prefix := 'MOV';
  END CASE;

  -- Obtenir le prochain numéro pour ce type
  SELECT COALESCE(MAX(CAST(SUBSTRING(movement_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_number
  FROM movements
  WHERE movement_number LIKE prefix || '-%';

  -- Formater le numéro (ex: REC-001)
  formatted_number := prefix || '-' || LPAD(next_number::TEXT, 3, '0');

  RETURN formatted_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE movements IS 'Table principale regroupant les opérations de mouvement de stock';
COMMENT ON TABLE stock_movements IS 'Détails des mouvements de stock par produit/variation';
COMMENT ON FUNCTION generate_movement_number IS 'Génère un numéro de mouvement unique par type';
