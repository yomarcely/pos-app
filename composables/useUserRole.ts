import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

/**
 * RBAC côté client — aligné sur la hiérarchie serveur (server/utils/roles.ts).
 * Sert UNIQUEMENT à masquer ce qui est inaccessible ; la vraie barrière reste
 * le 403 serveur (assertRole). Défaut `admin` si le rôle est absent (rétro-compat,
 * cohérent avec resolveRole côté serveur).
 */
export type Role = 'admin' | 'manager' | 'cashier'

const ROLE_LEVELS: Record<Role, number> = {
  cashier: 0,
  manager: 1,
  admin: 2,
}

export function useUserRole() {
  const auth = useAuthStore()

  const role = computed<Role>(() => {
    const raw = auth.user?.app_metadata?.role
    if (raw === 'manager' || raw === 'cashier' || raw === 'admin') return raw
    return 'admin'
  })

  const isAdmin = computed(() => role.value === 'admin')
  const isManager = computed(() => ROLE_LEVELS[role.value] >= ROLE_LEVELS.manager)

  function canAccess(minRole: Role): boolean {
    return ROLE_LEVELS[role.value] >= ROLE_LEVELS[minRole]
  }

  return { role, isAdmin, isManager, canAccess }
}
