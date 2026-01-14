import type { H3Event } from 'h3'

/**
 * Utilitaire pour récupérer le tenantId
 * Utilisé dans toutes les API pour assurer le multi-tenancy
 */

/**
 * Récupère le tenant ID depuis la configuration runtime
 * @returns Le tenant ID par défaut
 */
export function getTenantId(): string {
  const config = useRuntimeConfig()
  const tenantId = config.public.defaultTenantId

  if (!tenantId) {
    throw createError({
      statusCode: 500,
      message: 'DEFAULT_TENANT_ID non configuré',
    })
  }

  return tenantId
}

/**
 * Récupère le tenant ID depuis l'événement (depuis le token JWT)
 * Lève une erreur si le tenant n'est pas disponible pour garantir l'isolation
 * @param event - L'événement H3
 * @returns Le tenant ID
 * @throws Error si le tenant n'est pas disponible dans le contexte
 */
export function getTenantIdFromEvent(event?: H3Event): string {
  const ctxTenant = event?.context?.auth?.tenantId

  if (!ctxTenant) {
    throw createError({
      statusCode: 401,
      message: 'Tenant ID manquant dans le contexte d\'authentification',
    })
  }

  return ctxTenant
}
