import type { User } from '@supabase/supabase-js'

// `createError` est auto-importé par Nuxt côté server/. Type H3Event inline (érasé par TS)
// pour éviter l'import explicite depuis 'h3' (dep transitive non hoistée par pnpm en CI).
type H3Event = import('h3').H3Event

/**
 * RBAC minimal — 3 rôles hiérarchiques. PAS de système de permissions générique.
 * Source unique de la logique de rôle ; ne JAMAIS importer server/utils/supabase.ts ici
 * (fuite SUPABASE_SERVICE_ROLE_KEY — cf. règle 10 du CLAUDE.md).
 */
export type Role = 'admin' | 'manager' | 'cashier'

// Hiérarchie : un niveau supérieur englobe les niveaux inférieurs.
export const ROLE_LEVELS: Record<Role, number> = {
  cashier: 0,
  manager: 1,
  admin: 2,
}

const VALID_ROLES = new Set<string>(Object.keys(ROLE_LEVELS))

/**
 * Détermine le rôle d'un utilisateur depuis ses métadonnées de confiance Supabase.
 * Défaut `admin` si absent ou invalide : rétro-compat, les comptes existants (sans rôle)
 * conservent l'accès complet.
 */
export function resolveRole(user: User | null): Role {
  const raw = user?.app_metadata?.role
  if (typeof raw === 'string' && VALID_ROLES.has(raw)) {
    return raw as Role
  }
  return 'admin'
}

/**
 * Lit le rôle posé par le middleware dans `event.context.auth`.
 * Défaut `admin` si manquant (même logique de rétro-compat / fail-open contrôlé).
 */
export function getRoleFromEvent(event: H3Event): Role {
  const role = event?.context?.auth?.role
  if (typeof role === 'string' && VALID_ROLES.has(role)) {
    return role as Role
  }
  return 'admin'
}

/**
 * Lève 403 si le rôle de l'appelant est strictement inférieur au rôle minimum requis.
 * `assertRole(event, 'manager')` passe pour manager et admin ;
 * `assertRole(event, 'admin')` passe pour admin seul.
 * Message générique : ne révèle pas le rôle requis ni l'existence de la ressource.
 */
export function assertRole(event: H3Event, minRole: Role): void {
  const role = getRoleFromEvent(event)
  if (ROLE_LEVELS[role] < ROLE_LEVELS[minRole]) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Accès refusé : privilèges insuffisants',
    })
  }
}
