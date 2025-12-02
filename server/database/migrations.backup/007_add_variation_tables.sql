-- ==========================================
-- Migration: Ajouter les tables de gestion des variations
-- ==========================================

-- 1. Créer la table variation_groups
CREATE TABLE IF NOT EXISTS variation_groups (
  id SERIAL PRIMARY KEY,

  -- Nom du groupe de variation (ex: "Couleur", "Taille")
  name VARCHAR(100) NOT NULL,

  -- Archivage
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Créer les index pour variation_groups
CREATE INDEX IF NOT EXISTS variation_groups_name_idx ON variation_groups(name);

-- 3. Créer la table variations
CREATE TABLE IF NOT EXISTS variations (
  id SERIAL PRIMARY KEY,

  -- Référence au groupe de variation
  group_id INTEGER NOT NULL REFERENCES variation_groups(id) ON DELETE CASCADE,

  -- Nom de la variation (ex: "Rouge", "Bleu", "S", "M", "L")
  name VARCHAR(100) NOT NULL,

  -- Ordre d'affichage
  sort_order INTEGER DEFAULT 0,

  -- Archivage
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 4. Créer les index pour variations
CREATE INDEX IF NOT EXISTS variations_group_id_idx ON variations(group_id);
CREATE INDEX IF NOT EXISTS variations_name_idx ON variations(name);

-- 5. Commentaires pour documentation
COMMENT ON TABLE variation_groups IS 'Groupes de variations de produits (ex: Couleur, Taille, Matière)';
COMMENT ON TABLE variations IS 'Valeurs possibles pour chaque groupe de variation (ex: Rouge, Bleu, S, M, L)';
COMMENT ON COLUMN variations.group_id IS 'Référence au groupe de variation parent';
COMMENT ON COLUMN variations.sort_order IS 'Ordre d''affichage de la variation dans son groupe';
