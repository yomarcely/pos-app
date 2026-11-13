// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { eq, sql } from 'drizzle-orm'
import { suppliers, brands, products } from '~/server/database/schema'

/**
 * A4a — test NÉGATIF de la sécurité par ligne, sur un vrai PostgreSQL (PGlite, embarqué).
 *
 * La base est construite en rejouant les migrations du dépôt (baseline + 0001) : ce test
 * vérifie donc aussi que la chaîne de migrations s'applique de zéro, et que la migration RLS
 * fait ce qu'elle annonce. Le vrai `withTenantTx` est exercé, branché sur cette base.
 *
 * Différence avec Supabase : ici le compte de connexion est super-utilisateur (il contourne
 * la RLS comme le compte `postgres` de Supabase, qui porte BYPASSRLS). Le comportement vu par
 * le rôle `fympos_app` est le même ; il a été vérifié à blanc sur la base dev le 2026-11-12.
 */

const holder = vi.hoisted(() => ({ db: undefined as unknown }))

vi.mock('~/server/database/connection', () => ({
  get db() { return holder.db },
}))

import { withTenantTx } from '~/server/database/tenantTx'

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'server/database/migrations')

let pg: PGlite
let db: ReturnType<typeof drizzle>

/** Message PostgreSQL d'origine, quel que soit l'emballage de l'erreur par Drizzle. */
async function pgError(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
  } catch (err) {
    const messages: string[] = []
    let current: unknown = err
    while (current instanceof Error) {
      messages.push(current.message)
      current = current.cause
    }
    return messages.join(' | ')
  }
  return '(aucune erreur)'
}

beforeAll(async () => {
  pg = new PGlite()
  db = drizzle(pg)
  holder.db = db
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR })

  // Données posées par le compte de connexion (hors RLS), comme le fait le seed.
  await db.insert(suppliers).values([
    { tenantId: 'tenant-A', name: 'Fournisseur A1' },
    { tenantId: 'tenant-A', name: 'Fournisseur A2' },
    { tenantId: 'tenant-B', name: 'Fournisseur B1' },
  ])
  await db.insert(brands).values([
    { tenantId: 'tenant-A', name: 'Marque A1' },
    { tenantId: 'tenant-B', name: 'Marque B1' },
    { tenantId: 'tenant-B', name: 'Marque B2' },
  ])
}, 60_000)

afterAll(async () => {
  await pg?.close()
})

describe('RLS suppliers / brands (migration 0001)', () => {
  it('la migration a posé le rôle, la RLS et une règle par table', async () => {
    const role = await db.execute(sql`
      select rolcanlogin, rolbypassrls, rolsuper from pg_roles where rolname = 'fympos_app'`)
    expect(role.rows).toEqual([{ rolcanlogin: false, rolbypassrls: false, rolsuper: false }])

    const policies = await db.execute(sql`
      select tablename, policyname, cmd, roles::text as roles from pg_policies
      where schemaname = 'public' order by tablename`)
    expect(policies.rows).toEqual([
      { tablename: 'brands', policyname: 'tenant_isolation', cmd: 'ALL', roles: '{fympos_app}' },
      { tablename: 'suppliers', policyname: 'tenant_isolation', cmd: 'ALL', roles: '{fympos_app}' },
    ])

    // Même condition en lecture (USING) et en écriture (WITH CHECK), sur les deux tables.
    const expressions = await db.execute(sql`
      select tablename, qual, with_check from pg_policies
      where schemaname = 'public' order by tablename`)
    for (const row of expressions.rows as Array<{ tablename: string; qual: string; with_check: string }>) {
      expect(row.qual, row.tablename).toContain("current_setting('app.tenant_id'")
      expect(row.qual, row.tablename).toContain('NULLIF')
      expect(row.with_check, row.tablename).toBe(row.qual)
    }

    const rls = await db.execute(sql`
      select relname, relrowsecurity, relforcerowsecurity from pg_class
      where relname in ('suppliers', 'brands') order by relname`)
    expect(rls.rows).toEqual([
      { relname: 'brands', relrowsecurity: true, relforcerowsecurity: false },
      { relname: 'suppliers', relrowsecurity: true, relforcerowsecurity: false },
    ])
  })

  describe('lecture', () => {
    it('un WHERE tenant oublié ne fuit pas : seules les lignes du tenant posé sont visibles', async () => {
      // Volontairement SANS filtre tenantId : c'est l'erreur que la RLS doit rattraper.
      const rowsA = await withTenantTx('tenant-A', tx => tx.select().from(suppliers))
      const rowsB = await withTenantTx('tenant-B', tx => tx.select().from(suppliers))

      expect(rowsA.map(r => r.name).sort()).toEqual(['Fournisseur A1', 'Fournisseur A2'])
      expect(rowsB.map(r => r.name)).toEqual(['Fournisseur B1'])
    })

    it('même isolation sur brands', async () => {
      const rowsA = await withTenantTx('tenant-A', tx => tx.select().from(brands))
      const rowsB = await withTenantTx('tenant-B', tx => tx.select().from(brands))

      expect(rowsA.map(r => r.name)).toEqual(['Marque A1'])
      expect(rowsB.map(r => r.name).sort()).toEqual(['Marque B1', 'Marque B2'])
    })

    it('un tenant inconnu ne voit rien', async () => {
      const rows = await withTenantTx('tenant-inconnu', tx => tx.select().from(suppliers))
      expect(rows).toEqual([])
    })

    it('viser explicitement un autre tenant dans le WHERE ne renvoie rien', async () => {
      const rows = await withTenantTx('tenant-A', tx =>
        tx.select().from(suppliers).where(eq(suppliers.tenantId, 'tenant-B')))
      expect(rows).toEqual([])
    })

    it('rôle endossé mais tenant jamais posé : 0 ligne (fermé par défaut)', async () => {
      const rows = await db.transaction(async (tx) => {
        await tx.execute(sql`select set_config('role', 'fympos_app', true)`)
        return tx.select().from(suppliers)
      })
      expect(rows).toEqual([])
    })

    it('tenant vide en session (état laissé par une transaction précédente) : une ligne à tenant_id vide reste invisible', async () => {
      const [orphan] = await db.insert(suppliers).values({ tenantId: '', name: 'Sans tenant' }).returning()
      try {
        // Après une première transaction, app.tenant_id vaut '' dans la session, plus NULL.
        await withTenantTx('tenant-A', tx => tx.select().from(suppliers))
        const rows = await db.transaction(async (tx) => {
          await tx.execute(sql`select set_config('role', 'fympos_app', true)`)
          return tx.select().from(suppliers)
        })
        expect(rows).toEqual([])
      } finally {
        await db.delete(suppliers).where(eq(suppliers.id, orphan!.id))
      }
    })
  })

  describe('écriture', () => {
    it('insérer pour son propre tenant fonctionne (droit sur la séquence, RETURNING)', async () => {
      const [created] = await withTenantTx('tenant-A', tx =>
        tx.insert(suppliers).values({ tenantId: 'tenant-A', name: 'Créé par A' }).returning())

      expect(created).toMatchObject({ tenantId: 'tenant-A', name: 'Créé par A' })
      expect(created!.id).toBeGreaterThan(0)

      await db.delete(suppliers).where(eq(suppliers.id, created!.id))
    })

    it('insérer pour un AUTRE tenant est refusé par la base', async () => {
      const message = await pgError(() => withTenantTx('tenant-A', tx =>
        tx.insert(suppliers).values({ tenantId: 'tenant-B', name: 'Intrus' }).returning()))

      expect(message).toContain('row-level security')
      const intrus = await db.select().from(suppliers).where(eq(suppliers.name, 'Intrus'))
      expect(intrus).toEqual([])
    })

    it('déplacer sa propre ligne vers un autre tenant est refusé', async () => {
      const message = await pgError(() => withTenantTx('tenant-A', tx =>
        tx.update(suppliers).set({ tenantId: 'tenant-B' }).where(eq(suppliers.name, 'Fournisseur A1'))))

      expect(message).toContain('row-level security')
      const [row] = await db.select().from(suppliers).where(eq(suppliers.name, 'Fournisseur A1'))
      expect(row!.tenantId).toBe('tenant-A')
    })

    it('modifier ou supprimer la ligne d\'un autre tenant ne touche rien', async () => {
      const updated = await withTenantTx('tenant-A', tx =>
        tx.update(suppliers).set({ name: 'Piraté' }).where(eq(suppliers.name, 'Fournisseur B1')).returning())
      const deleted = await withTenantTx('tenant-A', tx =>
        tx.delete(suppliers).where(eq(suppliers.name, 'Fournisseur B1')).returning())

      expect(updated).toEqual([])
      expect(deleted).toEqual([])
      const [row] = await db.select().from(suppliers).where(eq(suppliers.name, 'Fournisseur B1'))
      expect(row).toMatchObject({ tenantId: 'tenant-B', name: 'Fournisseur B1' })
    })

    it('brands : mêmes refus en écriture (insertion et déplacement vers un autre tenant)', async () => {
      const inserted = await pgError(() => withTenantTx('tenant-A', tx =>
        tx.insert(brands).values({ tenantId: 'tenant-B', name: 'Marque intruse' }).returning()))
      const moved = await pgError(() => withTenantTx('tenant-A', tx =>
        tx.update(brands).set({ tenantId: 'tenant-B' }).where(eq(brands.name, 'Marque A1'))))
      const touched = await withTenantTx('tenant-A', tx =>
        tx.delete(brands).where(eq(brands.name, 'Marque B1')).returning())

      expect(inserted).toContain('row-level security')
      expect(moved).toContain('row-level security')
      expect(touched).toEqual([])
      const all = await db.select().from(brands)
      expect(all.map(r => `${r.tenantId}:${r.name}`).sort()).toEqual([
        'tenant-A:Marque A1', 'tenant-B:Marque B1', 'tenant-B:Marque B2',
      ])
    })

    it('une erreur dans fn annule ce qui a été écrit dans la transaction', async () => {
      await expect(withTenantTx('tenant-A', async (tx) => {
        await tx.insert(suppliers).values({ tenantId: 'tenant-A', name: 'Annulé' })
        throw new Error('échec volontaire')
      })).rejects.toThrow('échec volontaire')

      const rows = await db.select().from(suppliers).where(eq(suppliers.name, 'Annulé'))
      expect(rows).toEqual([])
    })
  })

  describe('limites, écrites noir sur blanc', () => {
    it('une table sans règle est interdite dans la transaction (erreur franche, pas 0 ligne)', async () => {
      const message = await pgError(() => withTenantTx('tenant-A', tx => tx.select().from(products)))
      expect(message).toContain('permission denied for table products')
    })

    it('rien ne fuit après la transaction : le rôle et le tenant sont revenus à l\'état initial', async () => {
      const before = await db.execute(sql`select current_user as u`)
      await withTenantTx('tenant-A', tx => tx.select().from(suppliers))
      const after = await db.execute(sql`
        select current_user as u, coalesce(current_setting('app.tenant_id', true), '') as tenant`)

      expect(after.rows[0]!.u).toBe(before.rows[0]!.u)
      expect(after.rows[0]!.u).not.toBe('fympos_app')
      expect(after.rows[0]!.tenant).toBe('')
    })

    it('rien ne fuit non plus après une transaction ANNULÉE', async () => {
      await expect(withTenantTx('tenant-A', async () => { throw new Error('annulée') })).rejects.toThrow('annulée')

      const after = await db.execute(sql`
        select current_user as u, coalesce(current_setting('app.tenant_id', true), '') as tenant`)
      expect(after.rows[0]!.u).not.toBe('fympos_app')
      expect(after.rows[0]!.tenant).toBe('')
    })

    it('HORS withTenantTx, la RLS ne protège pas : le compte de connexion voit tous les tenants', async () => {
      // Limite connue d'A4a (compte propriétaire qui contourne la RLS). Si ce test échoue un
      // jour, c'est que l'application se connecte enfin avec un compte sans contournement
      // (fin d'A4b) : le remplacer alors par l'attente inverse.
      const rows = await db.select().from(suppliers)
      expect(new Set(rows.map(r => r.tenantId))).toEqual(new Set(['tenant-A', 'tenant-B']))
    })
  })
})
