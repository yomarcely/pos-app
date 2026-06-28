import { describe, it, expect, vi } from 'vitest'
import { createAuthRetryFetch } from '@/utils/authRetryFetch'

// Erreur façon ofetch FetchError (porte response.status).
const err401 = () => Object.assign(new Error('Unauthorized'), { response: { status: 401 }, status: 401 })
const err500 = () => Object.assign(new Error('Server error'), { response: { status: 500 }, status: 500 })

describe('createAuthRetryFetch — refresh + rejeu sur 401', () => {
  it('succès direct : ne refresh pas, ne déconnecte pas', async () => {
    const rawFetch = vi.fn(async () => ({ ok: true }))
    const refresh = vi.fn(async () => true)
    const onSessionExpired = vi.fn()

    const apiFetch = createAuthRetryFetch(rawFetch as any, { refresh, onSessionExpired })
    await expect(apiFetch('/api/x')).resolves.toEqual({ ok: true })

    expect(rawFetch).toHaveBeenCalledTimes(1)
    expect(refresh).not.toHaveBeenCalled()
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('401 + refresh OK → rejoue la requête et retourne le résultat', async () => {
    const rawFetch = vi.fn()
      .mockRejectedValueOnce(err401())
      .mockResolvedValueOnce({ ok: true, replayed: true })
    const refresh = vi.fn(async () => true)
    const onSessionExpired = vi.fn()

    const apiFetch = createAuthRetryFetch(rawFetch as any, { refresh, onSessionExpired })
    await expect(apiFetch('/api/x')).resolves.toEqual({ ok: true, replayed: true })

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(rawFetch).toHaveBeenCalledTimes(2) // original + rejeu
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('401 + refresh KO → onSessionExpired (logout), pas de rejeu', async () => {
    const original = err401()
    const rawFetch = vi.fn().mockRejectedValue(original)
    const refresh = vi.fn(async () => false)
    const onSessionExpired = vi.fn()

    const apiFetch = createAuthRetryFetch(rawFetch as any, { refresh, onSessionExpired })
    await expect(apiFetch('/api/x')).rejects.toBe(original)

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(rawFetch).toHaveBeenCalledTimes(1) // pas de rejeu
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('anti-boucle : 401 + refresh OK mais rejeu re-401 → logout, pas de 3e tentative', async () => {
    const rawFetch = vi.fn().mockRejectedValue(err401())
    const refresh = vi.fn(async () => true)
    const onSessionExpired = vi.fn()

    const apiFetch = createAuthRetryFetch(rawFetch as any, { refresh, onSessionExpired })
    await expect(apiFetch('/api/x')).rejects.toMatchObject({ status: 401 })

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(rawFetch).toHaveBeenCalledTimes(2) // original + 1 seul rejeu
    expect(onSessionExpired).toHaveBeenCalledTimes(1)
  })

  it('erreur non-401 : propagée telle quelle, sans refresh ni logout', async () => {
    const boom = err500()
    const rawFetch = vi.fn().mockRejectedValue(boom)
    const refresh = vi.fn(async () => true)
    const onSessionExpired = vi.fn()

    const apiFetch = createAuthRetryFetch(rawFetch as any, { refresh, onSessionExpired })
    await expect(apiFetch('/api/x')).rejects.toBe(boom)

    expect(refresh).not.toHaveBeenCalled()
    expect(onSessionExpired).not.toHaveBeenCalled()
  })

  it('mutex : deux 401 concurrents partagent un seul refresh', async () => {
    let resolveRefresh!: (v: boolean) => void
    const refresh = vi.fn(() => new Promise<boolean>((r) => { resolveRefresh = r }))

    const rawFetch = vi.fn()
      .mockRejectedValueOnce(err401())            // requête A, 1er appel
      .mockRejectedValueOnce(err401())            // requête B, 1er appel
      .mockResolvedValueOnce({ id: 'A' })         // rejeu A
      .mockResolvedValueOnce({ id: 'B' })         // rejeu B
    const onSessionExpired = vi.fn()

    const apiFetch = createAuthRetryFetch(rawFetch as any, { refresh, onSessionExpired })
    const pA = apiFetch('/api/a')
    const pB = apiFetch('/api/b')

    // Laisse les deux atteindre l'attente du refresh avant de le résoudre.
    await Promise.resolve()
    await Promise.resolve()
    resolveRefresh(true)

    const [rA, rB] = await Promise.all([pA, pB])
    expect(rA).toEqual({ id: 'A' })
    expect(rB).toEqual({ id: 'B' })
    expect(refresh).toHaveBeenCalledTimes(1) // un seul refresh pour les deux
    expect(onSessionExpired).not.toHaveBeenCalled()
  })
})
