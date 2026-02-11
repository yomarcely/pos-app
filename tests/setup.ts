// Configuration globale des tests Vitest
// Les types globaux sont activés via vitest.config.ts (globals: true)

import { vi } from 'vitest'

// ===========================================
// Mocks globaux pour l'environnement Nuxt/Nitro
// ===========================================

// Fonctions Nitro/H3 disponibles globalement dans les handlers
;(globalThis as Record<string, unknown>).defineEventHandler = (fn: unknown) => fn
;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) => ({ __isError: true, ...data })
;(globalThis as Record<string, unknown>).getQuery = (event: { query?: Record<string, unknown> }) => event?.query || {}
;(globalThis as Record<string, unknown>).getRouterParam = (event: { context?: { params?: Record<string, string> } }, param: string) => event?.context?.params?.[param]
;(globalThis as Record<string, unknown>).readBody = async (event: { body?: unknown }) => event?.body || {}
;(globalThis as Record<string, unknown>).getCookie = () => undefined
;(globalThis as Record<string, unknown>).setCookie = () => undefined

// Fonctions auto-importées par Nuxt dans le dossier server/
;(globalThis as Record<string, unknown>).getTenantIdFromEvent = () => 'test-tenant-id'

// ===========================================
// Mocks pour les utilitaires serveur
// ===========================================

// Mock du tenant - retourne un tenant de test par défaut
vi.mock('~/server/utils/tenant', () => ({
  getTenantIdFromEvent: vi.fn(() => 'test-tenant-id')
}))

// Mock du logger pour éviter les logs pendant les tests
vi.mock('~/server/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    }))
  }
}))

// Mock de la validation - passe les données telles quelles par défaut
vi.mock('~/server/utils/validation', () => ({
  validateBody: vi.fn(async (_event: unknown, _schema: unknown) => {
    // Par défaut, retourne le body de l'event
    const event = _event as { body?: unknown }
    return event?.body || {}
  })
}))

// ===========================================
// Helpers pour les tests
// ===========================================

// Helper pour créer un événement H3 mocké
export function createMockEvent(options: {
  query?: Record<string, unknown>
  body?: unknown
  params?: Record<string, string>
  headers?: Record<string, string>
  auth?: { user?: { id: string } }
} = {}) {
  return {
    query: options.query || {},
    body: options.body || {},
    context: {
      params: options.params || {},
      auth: options.auth || { user: { id: 'test-user-id' } }
    },
    node: {
      req: {
        headers: options.headers || {}
      }
    }
  }
}

// Helper pour créer un mock de base de données simple
export function createMockDb(results: unknown[] = []) {
  const chain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    having: vi.fn(() => chain),
    orderBy: vi.fn(() => Promise.resolve(results)),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(results))
      }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(() => Promise.resolve(results))
        }))
      }))
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve())
    })),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(chain))
  }
  return chain
}
