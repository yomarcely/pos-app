-- ==========================================
-- Migration: Ajouter la table categories et la relation dans products
-- ==========================================

-- 1. Créer la table categories
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,

  -- Nom de la catégorie
  name VARCHAR(255) NOT NULL,

  -- Catégorie parente (NULL = catégorie racine)
  parent_id INTEGER REFERENCES categories(id),

  -- Ordre d'affichage
  sort_order INTEGER DEFAULT 0,

  -- Métadonnées
  icon VARCHAR(50),
  color VARCHAR(20),

  -- Archivage
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Créer les index
CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON categories(parent_id);
CREATE INDEX IF NOT EXISTS categories_name_idx ON categories(name);

-- 3. Ajouter la colonne category_id dans products
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id);

-- 4. Créer l'index sur category_id
CREATE INDEX IF NOT EXISTS products_category_id_idx ON products(category_id);

-- 5. Commentaires pour documentation
COMMENT ON TABLE categories IS 'Table des catégories de produits avec support des sous-catégories imbriquées';
COMMENT ON COLUMN categories.parent_id IS 'ID de la catégorie parente (NULL pour catégories racines)';
COMMENT ON COLUMN categories.sort_order IS 'Ordre d''affichage de la catégorie';
COMMENT ON COLUMN products.category_id IS 'Référence à la catégorie du produit';
