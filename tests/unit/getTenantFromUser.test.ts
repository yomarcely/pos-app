import { describe, it, expect, vi, beforeEach } from 'vitest'

// supabase.ts utilise `getHeader` via auto-import Nuxt → exposé sur globalThis
// par tests/setup.ts. On override ici pour pouvoir contrôler la valeur retournée.
const mockGetHeader = vi.fn()
;(globalThis as Record<string, unknown>).getHeader = mockGetHeader

// Éviter la création réelle du client Supabase (SUPABASE_SERVICE_ROLE_KEY absent en test)
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ auth: {} })),
}))

import { getTenantFromUser } from '~/server/utils/supabase'
import type { User } from '@supabase/supabase-js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// On évite `import type { H3Event } from 'h3'` (Vite essaie de résoudre 'h3' en CI).
// Les fonctions testées n'inspectent pas event, on peut donc passer un objet vide
// casté en `never` pour satisfaire la signature sans dépendre du vrai type h3.
const mockEvent = {} as never

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-id-123',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  } as User
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getTenantFromUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Par défaut : aucun header x-tenant-id
    mockGetHeader.mockReturnValue(undefined)
  })

  // ── Priorité 1 : header x-tenant-id ────────────────────────────────────────

  describe('Priorité 1 — header x-tenant-id', () => {
    it('retourne la valeur du header si présent', () => {
      mockGetHeader.mockReturnValue('tenant-from-header')
      expect(getTenantFromUser(makeUser(), mockEvent)).toBe('tenant-from-header')
    })

    it('prend la priorité sur app_metadata', () => {
      mockGetHeader.mockReturnValue('header-wins')
      const user = makeUser({ app_metadata: { tenant_id: 'meta-should-lose' } })
      expect(getTenantFromUser(user, mockEvent)).toBe('header-wins')
    })

    it('prend la priorité même si user est null', () => {
      mockGetHeader.mockReturnValue('header-no-user')
      expect(getTenantFromUser(null, mockEvent)).toBe('header-no-user')
    })
  })

  // ── Priorité 2 : app_metadata / user_metadata ───────────────────────────────

  describe('Priorité 2 — app_metadata / user_metadata', () => {
    it('retourne app_metadata.tenant_id (snake_case)', () => {
      const user = makeUser({ app_metadata: { tenant_id: 'tenant-snake' } })
      expect(getTenantFromUser(user, mockEvent)).toBe('tenant-snake')
    })

    it('retourne app_metadata.tenantId (camelCase)', () => {
      const user = makeUser({ app_metadata: { tenantId: 'tenant-camel' } })
      expect(getTenantFromUser(user, mockEvent)).toBe('tenant-camel')
    })

    it('retourne user_metadata.tenant_id si app_metadata est absent', () => {
      const user = makeUser({
        app_metadata: undefined as unknown as User['app_metadata'],
        user_metadata: { tenant_id: 'tenant-user-meta' },
      })
      expect(getTenantFromUser(user, mockEvent)).toBe('tenant-user-meta')
    })
  })

  // ── Priorité 3 : tenants[] (premier élément) ────────────────────────────────

  describe('Priorité 3 — tenants[] array', () => {
    it('retourne tenants[0].id', () => {
      const user = makeUser({ app_metadata: { tenants: [{ id: 'tenant-list-id' }] } })
      expect(getTenantFromUser(user, mockEvent)).toBe('tenant-list-id')
    })

    it('retourne tenants[0].tenant_id si .id absent', () => {
      const user = makeUser({ app_metadata: { tenants: [{ tenant_id: 'tenant-list-snake' }] } })
      expect(getTenantFromUser(user, mockEvent)).toBe('tenant-list-snake')
    })

    it('retourne tenants[0].slug si .id et .tenant_id absents', () => {
      const user = makeUser({ app_metadata: { tenants: [{ slug: 'my-org-slug' }] } })
      expect(getTenantFromUser(user, mockEvent)).toBe('my-org-slug')
    })

    it('ignore un tableau vide et continue vers le fallback suivant', () => {
      const user = makeUser({ id: 'user-id-fallback', app_metadata: { tenants: [] } })
      expect(getTenantFromUser(user, mockEvent)).toBe('user-id-fallback')
    })
  })

  // ── Priorité 4 : user.id (fallback ultime) ──────────────────────────────────

  describe('Priorité 4 — user.id (fallback ultime)', () => {
    it('retourne user.id si aucune métadonnée tenant n\'est présente', () => {
      const user = makeUser({ id: 'user-fallback-id', app_metadata: {}, user_metadata: {} })
      expect(getTenantFromUser(user, mockEvent)).toBe('user-fallback-id')
    })

    it('caste user.id en string', () => {
      const user = makeUser({ id: '42', app_metadata: {} })
      expect(typeof getTenantFromUser(user, mockEvent)).toBe('string')
    })
  })

  // ── Aucun tenant trouvé → null ───────────────────────────────────────────────

  describe('Aucun tenant trouvé', () => {
    it('retourne null si user est null et aucun header', () => {
      expect(getTenantFromUser(null, mockEvent)).toBeNull()
    })

    it('retourne null si user.id est undefined et pas de métadonnées', () => {
      const user = makeUser({
        id: undefined as unknown as string,
        app_metadata: undefined as unknown as User['app_metadata'],
        user_metadata: undefined as unknown as User['user_metadata'],
      })
      expect(getTenantFromUser(user, mockEvent)).toBeNull()
    })
  })
})
