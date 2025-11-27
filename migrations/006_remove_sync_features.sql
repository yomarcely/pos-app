-- Migration: Suppression des fonctionnalités de synchronisation
-- Date: 2025-11-27
-- Description: Supprime la table sync_queue et les colonnes de sync de la table sales
--              car l'application sera hébergée sur Supabase sans besoin de sync locale

-- 1. Supprimer les colonnes de synchronisation de la table sales
ALTER TABLE sales
DROP COLUMN IF EXISTS sync_status,
DROP COLUMN IF EXISTS synced_at;

-- 2. Supprimer l'index de sync_status (s'il existe)
DROP INDEX IF EXISTS sales_sync_status_idx;

-- 3. Supprimer la table sync_queue
DROP TABLE IF EXISTS sync_queue;

COMMENT ON TABLE sales IS 'Table des ventes NF525 - Hébergée sur Supabase';
