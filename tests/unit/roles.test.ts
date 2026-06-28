import { describe, it, expect, vi } from 'vitest'
import { createMockEvent } from '../setup'

// createError de Nitro renvoie une vraie H3Error (instanceof Error). Le stub global
// de tests/setup.ts renvoie un objet simple ; on l'override ici par une vraie Error
// portant statusCode, pour que `throw createError(...)` se propage comme un throw et
// que les blocs `catch (error instanceof Error && 'statusCode' in error)` des handlers
// le relancent fidèlement.
;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) =>
  Object.assign(new Error(String(data.statusMessage || data.message || 'error')), data)

// Éviter la création réelle du client Supabase lors de l'import transitif.
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ auth: {} })),
}))

// db mocké : un cashier doit être rejeté AVANT tout accès DB. Si la barrière de rôle
// laissait passer, l'accès à `db` lèverait une erreur distincte (non-403).
vi.mock('~/server/database/connection', () => ({
  get db() {
    throw Object.assign(new Error('db touchée — la barrière de rôle a été franchie'), {
      statusCode: 500,
    })
  },
}))

import { resolveRole, getRoleFromEvent, assertRole, ROLE_LEVELS } from '~/server/utils/roles'
import type { User } from '@supabase/supabase-js'

function userWithRole(role?: unknown): User {
  return { id: 'u1', app_metadata: role === undefined ? {} : { role } } as unknown as User
}

function eventWithRole(role?: string) {
  return createMockEvent({ auth: { user: { id: 'u1' }, ...(role ? { role } : {}) } })
}

describe('resolveRole — rétro-compat (défaut admin)', () => {
  it('absence de rôle → admin', () => {
    expect(resolveRole(userWithRole(undefined))).toBe('admin')
  })
  it('rôle invalide → admin', () => {
    expect(resolveRole(userWithRole('superuser'))).toBe('admin')
    expect(resolveRole(userWithRole(42))).toBe('admin')
  })
  it('user null → admin', () => {
    expect(resolveRole(null)).toBe('admin')
  })
  it('rôles valides conservés', () => {
    expect(resolveRole(userWithRole('admin'))).toBe('admin')
    expect(resolveRole(userWithRole('manager'))).toBe('manager')
    expect(resolveRole(userWithRole('cashier'))).toBe('cashier')
  })
})

describe('hiérarchie', () => {
  it('cashier < manager < admin', () => {
    expect(ROLE_LEVELS.cashier).toBeLessThan(ROLE_LEVELS.manager)
    expect(ROLE_LEVELS.manager).toBeLessThan(ROLE_LEVELS.admin)
  })
})

describe('getRoleFromEvent', () => {
  it('lit le rôle posé par le middleware', () => {
    expect(getRoleFromEvent(eventWithRole('manager'))).toBe('manager')
  })
  it('rôle manquant dans le contexte → admin (rétro-compat)', () => {
    expect(getRoleFromEvent(eventWithRole())).toBe('admin')
  })
})

describe('assertRole', () => {
  const expect403 = (fn: () => void) => {
    try {
      fn()
      throw new Error('aurait dû lever 403')
    } catch (e) {
      expect((e as { statusCode?: number }).statusCode).toBe(403)
    }
  }

  it('cashier → 403 sur manager+ ET sur admin', () => {
    expect403(() => assertRole(eventWithRole('cashier'), 'manager'))
    expect403(() => assertRole(eventWithRole('cashier'), 'admin'))
  })

  it('manager → OK sur manager+, 403 sur admin-only', () => {
    expect(() => assertRole(eventWithRole('manager'), 'manager')).not.toThrow()
    expect403(() => assertRole(eventWithRole('manager'), 'admin'))
  })

  it('admin → OK partout', () => {
    expect(() => assertRole(eventWithRole('admin'), 'manager')).not.toThrow()
    expect(() => assertRole(eventWithRole('admin'), 'admin')).not.toThrow()
  })

  it('absence de rôle → traité comme admin (rétro-compat)', () => {
    expect(() => assertRole(eventWithRole(), 'manager')).not.toThrow()
    expect(() => assertRole(eventWithRole(), 'admin')).not.toThrow()
  })
})

describe('intégration handler — /api/sales/close-day (manager+)', () => {
  async function callCloseDay(role: string): Promise<{ statusCode?: number }> {
    const handler = (await import('~/server/api/sales/close-day.post')).default as (e: unknown) => Promise<unknown>
    try {
      await handler(eventWithRole(role))
      throw new Error('le handler aurait dû rejeter')
    } catch (e) {
      return e as { statusCode?: number }
    }
  }

  it('un caissier est rejeté en 403 avant tout accès DB', async () => {
    expect((await callCloseDay('cashier')).statusCode).toBe(403)
  })

  it('un manager franchit la barrière de rôle (échec ultérieur ≠ 403)', async () => {
    expect((await callCloseDay('manager')).statusCode).not.toBe(403)
  })
})
