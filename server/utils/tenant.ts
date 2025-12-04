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
 * Récupère le tenant ID depuis l'événement (futur: depuis le token JWT)
 * Pour l'instant, utilise le tenant ID par défaut
 * @param event - L'événement H3
 * @returns Le tenant ID
 */
export function getTenantIdFromEvent(event?: any): string {
  const ctxTenant = event?.context?.auth?.tenantId
  if (ctxTenant) return ctxTenant
  return getTenantId()
}
