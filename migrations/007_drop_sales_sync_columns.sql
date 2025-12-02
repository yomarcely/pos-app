-- Migration: Suppression des colonnes de synchronisation sur sales
-- Description: retire les colonnes legacy sync_status et synced_at ainsi que l'index associé

ALTER TABLE sales
DROP COLUMN IF EXISTS sync_status,
DROP COLUMN IF EXISTS synced_at;

DROP INDEX IF EXISTS sales_sync_status_idx;
