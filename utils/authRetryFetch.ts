// Logique de rejeu-sur-401 du client HTTP unique (plugins/01.api-fetch.client.ts).
// Extraite ici (sans dépendance Nuxt) pour rester testable. Ne crée PAS de client
// $fetch alternatif (invariant CLAUDE.md n°3) : enveloppe le rawFetch fourni.

export function is401(err: unknown): boolean {
  const e = err as { response?: { status?: number }; status?: number; statusCode?: number } | null
  return e?.response?.status === 401 || e?.status === 401 || e?.statusCode === 401
}

export interface AuthRetryDeps {
  /** Tente un refresh du token. Résout à true si une session valide est obtenue. */
  refresh: () => Promise<boolean>
  /** Appelé quand le refresh échoue ou que la requête rejouée reprend un 401. */
  onSessionExpired: () => void | Promise<void>
}

/**
 * Enveloppe un $fetch pour gérer les 401 sans déconnecter brutalement :
 *  - sur 401, tente UN refresh (mutex : les 401 concurrents partagent la même
 *    promesse, pas de refresh parallèle) ;
 *  - si succès, rejoue la requête UNE fois (le nouveau token est réinjecté par
 *    l'onRequest du $fetch sous-jacent) ;
 *  - si le refresh échoue OU si le rejeu reprend un 401 : onSessionExpired
 *    (signOut + redirect). Pas de seconde re-tentative → pas de boucle.
 */
export function createAuthRetryFetch<F extends (...args: never[]) => Promise<unknown>>(
  rawFetch: F,
  deps: AuthRetryDeps,
): F {
  // Mutex de refresh, scoped à cette instance (test-isolé).
  let refreshPromise: Promise<boolean> | null = null
  const refreshOnce = () => {
    if (!refreshPromise) {
      refreshPromise = Promise.resolve()
        .then(deps.refresh)
        .finally(() => { refreshPromise = null })
    }
    return refreshPromise
  }

  const wrapped = async (...args: Parameters<F>): Promise<Awaited<ReturnType<F>>> => {
    try {
      return await rawFetch(...args) as Awaited<ReturnType<F>>
    } catch (err) {
      if (!is401(err)) throw err

      const refreshed = await refreshOnce()
      if (!refreshed) {
        await deps.onSessionExpired()
        throw err
      }

      try {
        // Rejeu unique. Tout 401 ici est définitif : pas de nouvelle tentative.
        return await rawFetch(...args) as Awaited<ReturnType<F>>
      } catch (retryErr) {
        if (is401(retryErr)) await deps.onSessionExpired()
        throw retryErr
      }
    }
  }

  return wrapped as F
}
