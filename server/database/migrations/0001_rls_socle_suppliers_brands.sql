-- A4a — Sécurité par ligne (RLS) : socle + pilote suppliers / brands.
--
-- Le compte de connexion de l'application (postgres sur Supabase) porte BYPASSRLS : aucune
-- règle ne s'applique à lui. On crée donc un rôle dédié, sans connexion propre et sans
-- contournement, que l'application endosse le temps d'une transaction
-- (server/database/tenantTx.ts). Sous ce rôle, seules les lignes du tenant posé dans
-- app.tenant_id sont visibles et modifiables.
--
-- Rien ne change pour le code qui n'utilise pas withTenantTx.
-- Migration rejouable sans erreur (rôle créé s'il manque, règles recréées).
--
-- Retour arrière : revenir D'ABORD au code précédent (sinon les écrans fournisseurs et
-- marques se vident sans erreur), PUIS :
--   DROP POLICY tenant_isolation ON suppliers; DROP POLICY tenant_isolation ON brands;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fympos_app') THEN
    CREATE ROLE fympos_app NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
--> statement-breakpoint
GRANT fympos_app TO CURRENT_USER;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO fympos_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON suppliers, brands TO fympos_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON SEQUENCE suppliers_id_seq, brands_id_seq TO fympos_app;
--> statement-breakpoint
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON suppliers;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON suppliers FOR ALL TO fympos_app
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation ON brands;
--> statement-breakpoint
CREATE POLICY tenant_isolation ON brands FOR ALL TO fympos_app
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''))
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));
