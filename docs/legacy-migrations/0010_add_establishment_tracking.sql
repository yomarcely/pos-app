-- Migration: Add establishment tracking to reference entities
-- This allows proper isolation of categories, brands, suppliers, and variations per establishment

-- Add created_by_establishment_id to categories
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS created_by_establishment_id INTEGER;

-- Add created_by_establishment_id to brands
ALTER TABLE brands
ADD COLUMN IF NOT EXISTS created_by_establishment_id INTEGER;

-- Add created_by_establishment_id to suppliers
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS created_by_establishment_id INTEGER;

-- Add created_by_establishment_id to variation_groups
ALTER TABLE variation_groups
ADD COLUMN IF NOT EXISTS created_by_establishment_id INTEGER;

-- Add foreign key constraints
ALTER TABLE categories
ADD CONSTRAINT fk_categories_establishment
FOREIGN KEY (created_by_establishment_id)
REFERENCES establishments(id)
ON DELETE SET NULL;

ALTER TABLE brands
ADD CONSTRAINT fk_brands_establishment
FOREIGN KEY (created_by_establishment_id)
REFERENCES establishments(id)
ON DELETE SET NULL;

ALTER TABLE suppliers
ADD CONSTRAINT fk_suppliers_establishment
FOREIGN KEY (created_by_establishment_id)
REFERENCES establishments(id)
ON DELETE SET NULL;

ALTER TABLE variation_groups
ADD CONSTRAINT fk_variation_groups_establishment
FOREIGN KEY (created_by_establishment_id)
REFERENCES establishments(id)
ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_categories_establishment ON categories(created_by_establishment_id);
CREATE INDEX IF NOT EXISTS idx_brands_establishment ON brands(created_by_establishment_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_establishment ON suppliers(created_by_establishment_id);
CREATE INDEX IF NOT EXISTS idx_variation_groups_establishment ON variation_groups(created_by_establishment_id);
