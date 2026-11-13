import { sql } from 'drizzle-orm'
import { db } from './connection'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

// Type inline érasé par TS — pas d'import 'h3' (cf. server/utils/tenant.ts).
type H3Event = import('h3').H3Event

/**
 * Transaction « scopée tenant » : la barrière PostgreSQL (RLS) sous le filtrage applicatif.
 *
 * ## Ce que ça fait
 *
 * `withTenantTx(tenantId, fn)` ouvre une transaction, y endosse le rôle `fympos_app` et pose
 * `app.tenant_id`, puis exécute `fn(tx)`. Sous ce rôle, les tables protégées n'exposent que
 * les lignes du tenant posé : un `WHERE tenantId` oublié renvoie 0 ligne au lieu de fuiter,
 * et une écriture vers un autre tenant est refusée par la base.
 *
 * ## Pourquoi un rôle dédié (et pas ENABLE + FORCE comme prévu en juillet 2026)
 *
 * L'application se connecte avec le compte `postgres` de Supabase, qui porte `BYPASSRLS` :
 * aucune règle RLS ne s'applique à lui, `FORCE ROW LEVEL SECURITY` compris (constaté sur la
 * base dev le 2026-11-12). `fympos_app` est un rôle PostgreSQL standard, sans connexion
 * propre et sans contournement, endossé le temps de la transaction.
 *
 * ## Ce que ça ne fait PAS
 *
 * Hors de `withTenantTx`, rien ne change : le code garde le compte `postgres` et voit tout.
 * La protection est donc « là où on l'utilise », pas un verrou global. Le verrou global
 * (connexion de l'application avec un compte sans contournement) n'est possible qu'une fois
 * toutes les tables couvertes (A4b). D'ici là, le filtre `eq(table.tenantId, tenantId)` reste
 * obligatoire partout, y compris dans `fn` (`pnpm audit:tenant` le vérifie).
 *
 * La barrière rattrape un filtre oublié, pas du SQL injecté : dans la transaction, un
 * `RESET ROLE` rend le compte de connexion. Les requêtes restent donc paramétrées.
 *
 * ## Règles d'usage dans `fn`
 *
 * 1. N'utiliser QUE `tx`. Un accès via le `db` global pendant la transaction attend la
 *    connexion qu'elle occupe : auto-blocage en mode pooler (invariant 8 de CLAUDE.md).
 *    Pour la même raison, ne jamais appeler `withTenantTx` depuis une transaction ouverte.
 * 2. Ne toucher qu'aux tables protégées (liste ci-dessous). Sur toute autre table, le rôle
 *    n'a aucun droit : PostgreSQL répond « permission denied » (erreur franche, pas 0 ligne).
 *    Les lectures annexes (groupes de synchro, produits) et le journal d'audit se font
 *    avant ou après, sur `db`.
 * 3. Les mises en portée sont locales à la transaction (`set_config(..., true)`) : rien ne
 *    fuit vers la requête suivante, y compris derrière le pooler en mode transaction.
 *
 * ## Tables protégées
 *
 * `suppliers`, `brands` — migration `0001_rls_socle_suppliers_brands`.
 *
 * ## Étendre à une nouvelle table
 *
 * Nouvelle migration (`pnpm drizzle-kit generate --custom`), jamais de retouche de l'existante :
 *
 *   GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO fympos_app;
 *   GRANT USAGE, SELECT ON SEQUENCE <table>_id_seq TO fympos_app;
 *   ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
 *   DROP POLICY IF EXISTS tenant_isolation ON <table>;
 *   CREATE POLICY tenant_isolation ON <table> FOR ALL TO fympos_app
 *     USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''))
 *     WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));
 *
 * (une instruction par bloc, séparées par `--> statement-breakpoint`). Avant de l'appliquer,
 * vérifier dans `pg_policies` qu'aucune autre règle de la table ne s'adresse à `fympos_app`
 * ou à tous les rôles : les règles permissives se cumulent en OU.
 *
 * Puis : passer les requêtes de la table par `withTenantTx`, ajouter ses cas à
 * `tests/integration/rlsSuppliersBrands.test.ts`, et compléter la liste ci-dessus.
 * Déploiement : la migration AVANT le code (sans le rôle, `withTenantTx` échoue).
 */

/** Rôle PostgreSQL sans BYPASSRLS endossé dans la transaction (créé par la migration 0001). */
export const TENANT_DB_ROLE = 'fympos_app'

/** Transaction Drizzle reçue par `fn` — assignable à `DbExecutor`. */
export type TenantTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function withTenantTx<T>(
  tenantId: string,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  // Fermé par défaut : sans tenant, on n'ouvre même pas la transaction.
  if (typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error('withTenantTx : tenantId manquant')
  }

  return db.transaction(async (tx) => {
    // Une seule instruction, valeurs paramétrées (jamais d'interpolation dans le SQL).
    // `set_config(..., true)` = portée transaction, équivalent de SET LOCAL.
    await tx.execute(
      sql`select set_config('role', ${TENANT_DB_ROLE}, true), set_config('app.tenant_id', ${tenantId}, true)`,
    )
    return fn(tx)
  })
}

/** Variante endpoint : le tenant vient de `getTenantIdFromEvent` (401 s'il est absent). */
export async function withTenantTxFromEvent<T>(
  event: H3Event,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  return withTenantTx(getTenantIdFromEvent(event), fn)
}
