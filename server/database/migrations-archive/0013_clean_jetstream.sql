-- A2 : numérotation NF525 stable (immutable, ne dépend plus de isActive ni de l'ordre des id).
--
-- Procédure :
-- 1. Ajout colonnes nullables
-- 2. Backfill via ROW_NUMBER : rang ASC par id (= ordre historique de création)
--    pour chaque tenant (establishments) et chaque établissement (registers)
-- 3. Application des contraintes NOT NULL + UNIQUE

ALTER TABLE "establishments" ADD COLUMN "establishment_number" integer;--> statement-breakpoint
ALTER TABLE "registers" ADD COLUMN "register_number" integer;--> statement-breakpoint

-- Backfill establishments : numéro = position chronologique dans le tenant
UPDATE "establishments" e
SET "establishment_number" = sub.rank
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY id ASC) AS rank
  FROM "establishments"
) sub
WHERE e.id = sub.id;--> statement-breakpoint

-- Backfill registers : numéro = position chronologique dans l'établissement
UPDATE "registers" r
SET "register_number" = sub.rank
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY establishment_id ORDER BY id ASC) AS rank
  FROM "registers"
) sub
WHERE r.id = sub.id;--> statement-breakpoint

ALTER TABLE "establishments" ALTER COLUMN "establishment_number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "registers" ALTER COLUMN "register_number" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "establishments_tenant_number_unique" ON "establishments" USING btree ("tenant_id","establishment_number");--> statement-breakpoint
CREATE UNIQUE INDEX "registers_establishment_number_unique" ON "registers" USING btree ("establishment_id","register_number");
