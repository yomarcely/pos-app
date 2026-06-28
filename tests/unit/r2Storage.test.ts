import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHash } from 'crypto'

// Logger stubé (le module réel importe ~/server/utils/logger)
vi.mock('~/server/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// useRuntimeConfig est auto-importé par Nitro → stub global pilotable
let runtimeR2: Record<string, string | undefined> = {}
;(globalThis as Record<string, unknown>).useRuntimeConfig = () => ({ r2: runtimeR2 })

const FULL_CONFIG = {
  accessKeyId: 'AKID',
  secretAccessKey: 'SECRET',
  bucket: 'pos-app-backups',
  endpoint: 'https://acct.r2.cloudflarestorage.com',
}

describe('r2Storage', () => {
  beforeEach(() => {
    vi.resetModules()
    runtimeR2 = {}
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getR2Config / isR2Configured', () => {
    it('retourne null quand une variable manque', async () => {
      runtimeR2 = { ...FULL_CONFIG, secretAccessKey: undefined }
      const { getR2Config, isR2Configured } = await import('~/server/utils/r2Storage')
      expect(getR2Config()).toBeNull()
      expect(isR2Configured()).toBe(false)
    })

    it('retourne la config et normalise l\'endpoint (trailing slash)', async () => {
      runtimeR2 = { ...FULL_CONFIG, endpoint: 'https://acct.r2.cloudflarestorage.com/' }
      const { getR2Config, isR2Configured } = await import('~/server/utils/r2Storage')
      expect(isR2Configured()).toBe(true)
      expect(getR2Config()?.endpoint).toBe('https://acct.r2.cloudflarestorage.com')
    })
  })

  describe('uploadArchiveToR2', () => {
    it('lève si R2 non configuré', async () => {
      const { uploadArchiveToR2 } = await import('~/server/utils/r2Storage')
      await expect(
        uploadArchiveToR2({ key: 'k', body: '{}', contentHash: 'h' }),
      ).rejects.toThrow(/non configuré/)
    })

    it('émet un PUT signé SigV4 avec le hash en métadonnée d\'objet', async () => {
      runtimeR2 = { ...FULL_CONFIG }
      const body = '{"a":1}'
      const contentHash = createHash('sha256').update(body).digest('hex')

      const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => '' }))
      vi.stubGlobal('fetch', fetchMock)

      const { uploadArchiveToR2 } = await import('~/server/utils/r2Storage')
      const res = await uploadArchiveToR2({
        key: 'archives/tenant-1/archive-2024-01.json',
        body,
        contentHash,
        metadata: { 'archive-hash': contentHash, 'tenant-id': 'tenant-1', period: '2024-01' },
      })

      expect(res.url).toContain('/pos-app-backups/archives/tenant-1/archive-2024-01.json')
      expect(fetchMock).toHaveBeenCalledOnce()

      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect(url).toContain('acct.r2.cloudflarestorage.com')
      expect(init.method).toBe('PUT')

      const headers = init.headers as Record<string, string>
      expect(headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKID\//)
      expect(headers.Authorization).toContain('SignedHeaders=')
      expect(headers.Authorization).toMatch(/Signature=[0-9a-f]{64}$/)
      expect(headers['x-amz-content-sha256']).toBe(contentHash)
      expect(headers['x-amz-meta-archive-hash']).toBe(contentHash)
      expect(headers['x-amz-meta-tenant-id']).toBe('tenant-1')
      expect(headers['x-amz-date']).toMatch(/^\d{8}T\d{6}Z$/)
    })

    it('lève sur réponse non-2xx', async () => {
      runtimeR2 = { ...FULL_CONFIG }
      const fetchMock = vi.fn(async () => ({ ok: false, status: 403, text: async () => 'AccessDenied' }))
      vi.stubGlobal('fetch', fetchMock)

      const { uploadArchiveToR2 } = await import('~/server/utils/r2Storage')
      await expect(
        uploadArchiveToR2({ key: 'k', body: '{}', contentHash: 'h' }),
      ).rejects.toThrow(/HTTP 403/)
    })
  })
})
