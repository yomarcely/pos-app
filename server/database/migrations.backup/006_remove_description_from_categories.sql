-- ==========================================
-- Migration: Supprimer la colonne description de la table categories
-- ==========================================

ALTER TABLE categories DROP COLUMN IF EXISTS description;
