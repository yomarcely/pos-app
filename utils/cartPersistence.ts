// Persistance localStorage du panier en cours (et des paiements en cours côté useCheckout).
// Clés scopées par tenant + caisse pour éviter toute fuite cross-tenant / cross-caisse.
// Garde-fous : JSON corrompu ou > 500 Ko → purge silencieuse.

const CART_STORAGE_PREFIX = 'fympos-cart'
// Préférences UI persistées (NON purgées au signOut : ce sont des réglages caisse/poste).
const PREF_STORAGE_PREFIX = 'fympos-pref'
const MAX_PERSISTED_SIZE = 500 * 1024 // 500 Ko

export function cartStorageKey(tenantId: string, registerId: number): string {
  return `${CART_STORAGE_PREFIX}-${tenantId}-${registerId}`
}

export function paymentsStorageKey(tenantId: string, registerId: number): string {
  return `${CART_STORAGE_PREFIX}-payments-${tenantId}-${registerId}`
}

/** Clé de la préférence « impression automatique du ticket », scopée par caisse. */
export function autoPrintStorageKey(tenantId: string, registerId: number): string {
  return `${PREF_STORAGE_PREFIX}-autoprint-${tenantId}-${registerId}`
}

/**
 * Lit et parse une entrée persistée. Retourne null si absente.
 * Purge silencieusement si le JSON est corrompu ou dépasse 500 Ko.
 */
export function readPersisted<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    if (raw.length > MAX_PERSISTED_SIZE) {
      localStorage.removeItem(key)
      return null
    }
    return JSON.parse(raw) as T
  } catch {
    try { localStorage.removeItem(key) } catch { /* quota/sécurité : ignorer */ }
    return null
  }
}

export function writePersisted(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota plein ou storage indisponible : la persistance est best-effort
  }
}

export function purgePersisted(key: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(key) } catch { /* ignorer */ }
}

/** Purge tous les paniers/paiements persistés, tous tenants confondus (appelé au signOut). */
export function purgeAllPersistedCarts(): void {
  if (typeof window === 'undefined') return
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(`${CART_STORAGE_PREFIX}-`)) toRemove.push(key)
    }
    toRemove.forEach(key => localStorage.removeItem(key))
  } catch { /* ignorer */ }
}
