import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Override createError
;(globalThis as Record<string, unknown>).createError = (data: Record<string, unknown>) => {
  const err = new Error((data.message || data.statusMessage) as string) as Error & Record<string, unknown>
  err.statusCode = data.statusCode
  err.__isError = true
  return err
}

vi.mock('~/server/utils/logger', () => ({
  logger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }))
  }
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let seedResult: any = {}
let seedShouldThrow = false

vi.mock('~/server/database/seed', () => ({
  seedDatabase: vi.fn(async () => {
    if (seedShouldThrow) throw new Error('DB connection failed')
    return seedResult
  })
}))

// ===========================================
// Tests
// ===========================================

describe('API /api/database', () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    vi.resetModules()
    seedResult = {}
    seedShouldThrow = false
    process.env.NODE_ENV = 'development'
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  describe('POST /api/database/seed', () => {
    it('seed la base de données avec succès', async () => {
      seedResult = { sellers: 3, products: 10 }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/database/seed.post')).default as any

      const res = await handler({})

      expect(res.success).toBe(true)
      expect(res.message).toBe('Base de données seedée avec succès')
      expect(res.result).toEqual({ sellers: 3, products: 10 })
    })

    it('throw 500 si erreur lors du seed', async () => {
      seedShouldThrow = true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/database/seed.post')).default as any

      await expect(handler({})).rejects.toMatchObject({
        statusCode: 500,
        message: "Une erreur interne s'est produite"
      })
    })

    it('throw 403 si NODE_ENV !== development', async () => {
      process.env.NODE_ENV = 'production'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handler = (await import('~/server/api/database/seed.post')).default as any

      await expect(handler({})).rejects.toMatchObject({
        statusCode: 403,
        message: 'Seed réservé au dev'
      })
    })
  })
})
