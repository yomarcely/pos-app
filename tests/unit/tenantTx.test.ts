import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { createMockEvent } from '../setup'

/**
 * Socle A4a — withTenantTx : ce que le wrapper envoie à la base, et dans quel ordre.
 * Le comportement réel de la RLS (lignes visibles, écritures refusées) est vérifié sur un
 * vrai PostgreSQL dans tests/integration/rlsSuppliersBrands.test.ts.
 */

const fake = vi.hoisted(() => {
  const log: string[] = []
  const tx = {
    execute: vi.fn(async (_query: unknown) => { log.push('execute') }),
  }
  const db = {
    transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => {
      log.push('debut')
      try {
        const result = await cb(tx)
        log.push('commit')
        return result
      } catch (err) {
        log.push('rollback')
        throw err
      }
    }),
  }
  return { log, tx, db }
})

vi.mock('~/server/database/connection', () => ({ db: fake.db }))

import { withTenantTx, withTenantTxFromEvent, TENANT_DB_ROLE } from '~/server/database/tenantTx'
import { getTenantIdFromEvent } from '~/server/utils/tenant'

/** Requête réellement envoyée : texte SQL + paramètres, tels que Drizzle les produit. */
function sentQuery() {
  const query = fake.tx.execute.mock.calls[0]![0] as SQL
  return new PgDialect().sqlToQuery(query)
}

describe('withTenantTx', () => {
  beforeEach(() => {
    fake.log.length = 0
    fake.tx.execute.mockClear()
    fake.db.transaction.mockClear()
  })

  it('ouvre une transaction, pose rôle et tenant, PUIS exécute fn avec la transaction', async () => {
    const fn = vi.fn(async (tx: unknown) => {
      fake.log.push('fn')
      return { tx, value: 42 }
    })

    const result = await withTenantTx('tenant-A', fn as never) as { tx: unknown; value: number }

    expect(fake.log).toEqual(['debut', 'execute', 'fn', 'commit'])
    expect(result.value).toBe(42)
    expect(result.tx).toBe(fake.tx)
    expect(fake.db.transaction).toHaveBeenCalledTimes(1)
    expect(fake.tx.execute).toHaveBeenCalledTimes(1)
  })

  it('pose le rôle sans contournement et le tenant en portée transaction, en une instruction', async () => {
    await withTenantTx('tenant-A', async () => undefined)

    const { sql, params } = sentQuery()
    expect(TENANT_DB_ROLE).toBe('fympos_app')
    expect(params).toEqual(['fympos_app', 'tenant-A'])
    expect(sql.replace(/\s+/g, ' ')).toBe(
      "select set_config('role', $1, true), set_config('app.tenant_id', $2, true)",
    )
  })

  it('passe le tenant en PARAMÈTRE : une valeur hostile n\'entre jamais dans le texte SQL', async () => {
    const hostile = "x', true); drop table suppliers; --"

    await withTenantTx(hostile, async () => undefined)

    const { sql, params } = sentQuery()
    expect(params).toEqual(['fympos_app', hostile])
    expect(sql).not.toContain('drop table')
    expect(sql).not.toContain(hostile)
  })

  it.each([
    ['chaîne vide', ''],
    ['espaces seuls', '   '],
    ['undefined', undefined],
    ['null', null],
    ['nombre', 12],
  ])('refuse un tenant absent ou invalide (%s) sans ouvrir de transaction', async (_label, tenantId) => {
    const fn = vi.fn(async () => 'jamais')

    await expect(withTenantTx(tenantId as never, fn)).rejects.toThrow('tenantId manquant')

    expect(fake.db.transaction).not.toHaveBeenCalled()
    expect(fn).not.toHaveBeenCalled()
  })

  it('propage l\'erreur de fn : la transaction est annulée, pas validée', async () => {
    const boom = new Error('new row violates row-level security policy for table "suppliers"')

    await expect(withTenantTx('tenant-A', async () => { throw boom })).rejects.toBe(boom)

    expect(fake.log).toEqual(['debut', 'execute', 'rollback'])
  })

  it('n\'exécute pas fn si la mise en portée échoue (rôle absent = migration non appliquée)', async () => {
    fake.tx.execute.mockRejectedValueOnce(new Error('role "fympos_app" does not exist'))
    const fn = vi.fn(async () => 'jamais')

    await expect(withTenantTx('tenant-A', fn)).rejects.toThrow('role "fympos_app" does not exist')

    expect(fn).not.toHaveBeenCalled()
    expect(fake.log).toEqual(['debut', 'rollback'])
  })
})

describe('withTenantTxFromEvent', () => {
  beforeEach(() => {
    fake.log.length = 0
    fake.tx.execute.mockClear()
    fake.db.transaction.mockClear()
    vi.mocked(getTenantIdFromEvent).mockReset()
  })

  it('prend le tenant via getTenantIdFromEvent(event), jamais ailleurs', async () => {
    vi.mocked(getTenantIdFromEvent).mockReturnValue('tenant-de-la-session')
    const event = createMockEvent()

    const result = await withTenantTxFromEvent(event, async () => 'ok')

    expect(result).toBe('ok')
    expect(getTenantIdFromEvent).toHaveBeenCalledWith(event)
    expect(sentQuery().params).toEqual(['fympos_app', 'tenant-de-la-session'])
  })

  it('laisse remonter le 401 de getTenantIdFromEvent sans ouvrir de transaction', async () => {
    const unauthorized = Object.assign(new Error('Tenant ID manquant'), { statusCode: 401 })
    vi.mocked(getTenantIdFromEvent).mockImplementation(() => { throw unauthorized })

    await expect(withTenantTxFromEvent(createMockEvent(), async () => 'jamais')).rejects.toBe(unauthorized)

    expect(fake.db.transaction).not.toHaveBeenCalled()
  })
})
