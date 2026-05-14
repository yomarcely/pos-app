-- Migration: Update existing data to assign them to first establishment of each tenant
-- This is a one-time migration to fix existing data after adding created_by_establishment_id

-- Pour chaque tenant, assigner les entités existantes au premier établissement
DO $$
DECLARE
  tenant_record RECORD;
  first_establishment_id INTEGER;
BEGIN
  -- Pour chaque tenant
  FOR tenant_record IN
    SELECT DISTINCT tenant_id FROM establishments ORDER BY tenant_id
  LOOP
    -- Trouver le premier établissement de ce tenant
    SELECT id INTO first_establishment_id
    FROM establishments
    WHERE tenant_id = tenant_record.tenant_id
    ORDER BY id ASC
    LIMIT 1;

    -- Mettre à jour les catégories sans created_by_establishment_id
    UPDATE categories
    SET created_by_establishment_id = first_establishment_id
    WHERE tenant_id = tenant_record.tenant_id
    AND created_by_establishment_id IS NULL;

    -- Mettre à jour les marques sans created_by_establishment_id
    UPDATE brands
    SET created_by_establishment_id = first_establishment_id
    WHERE tenant_id = tenant_record.tenant_id
    AND created_by_establishment_id IS NULL;

    -- Mettre à jour les fournisseurs sans created_by_establishment_id
    UPDATE suppliers
    SET created_by_establishment_id = first_establishment_id
    WHERE tenant_id = tenant_record.tenant_id
    AND created_by_establishment_id IS NULL;

    -- Mettre à jour les groupes de variations sans created_by_establishment_id
    UPDATE variation_groups
    SET created_by_establishment_id = first_establishment_id
    WHERE tenant_id = tenant_record.tenant_id
    AND created_by_establishment_id IS NULL;

    RAISE NOTICE 'Updated entities for tenant % with establishment %', tenant_record.tenant_id, first_establishment_id;
  END LOOP;
END $$;
