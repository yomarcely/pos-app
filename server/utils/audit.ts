import { db } from '~/server/database/connection'
import { auditLogs } from '~/server/database/schema'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * UTILITAIRES POUR LES LOGS D'AUDIT NF525
 * ==========================================
 *
 * Les logs d'audit sont essentiels pour la conformité NF525.
 * Ils doivent enregistrer TOUS les événements techniques et fonctionnels.
 */

/**
 * Types d'événements pour l'audit NF525
 */
export enum AuditEventType {
  // Événements de vente
  SALE_CREATE = 'sale_create',
  SALE_CANCEL = 'sale_cancel',

  // Événements de clôture
  CLOSURE_CREATE = 'closure_create',
  CLOSURE_ATTEMPT_FAILED = 'closure_attempt_failed',

  // Événements système
  SYSTEM_START = 'system_start',
  SYSTEM_STOP = 'system_stop',
  SYSTEM_ERROR = 'system_error',

  // Événements de configuration
  CONFIG_CHANGE = 'config_change',
  REGISTER_CREATED = 'register_created',
  REGISTER_UPDATED = 'register_updated',
  REGISTER_DELETED = 'register_deleted',

  // Événements de sécurité
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILED = 'auth_failed',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',

  // Événements d'intégrité
  CHAIN_VERIFICATION = 'chain_verification',
  CHAIN_INTEGRITY_FAILED = 'chain_integrity_failed',

  // Événements d'archivage
  ARCHIVE_CREATE = 'archive_create',
  ARCHIVE_EXPORT = 'archive_export',
}

/**
 * Interface pour les métadonnées d'audit
 */
export interface AuditMetadata {
  hash?: string
  signature?: string
  ticketNumber?: string
  registerId?: number
  establishmentId?: number
  errorMessage?: string
  errorStack?: string
  integrityStatus?: 'valid' | 'invalid'
  [key: string]: string | number | boolean | undefined
}

/**
 * Enregistre un événement d'audit dans la base de données
 *
 * @param params - Paramètres de l'événement d'audit
 */
export async function logAuditEvent(params: {
  tenantId: string
  userId: number | null
  userName: string | null
  entityType: string
  entityId: number | null
  action: string
  changes?: Record<string, string | number | boolean | undefined>
  metadata?: AuditMetadata
  ipAddress?: string | null
}) {
  try {
    await db.insert(auditLogs).values({
      tenantId: params.tenantId,
      userId: params.userId,
      userName: params.userName || 'System',
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      changes: params.changes || {},
      metadata: params.metadata || {},
      ipAddress: params.ipAddress || null,
    })

    logger.info({
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
    }, '[AUDIT] Événement enregistré')
  } catch (error) {
    // Ne pas bloquer l'opération principale en cas d'erreur d'audit
    logger.error({ err: error }, 'Erreur lors de l\'enregistrement de l\'audit')
  }
}

/**
 * Log spécifique pour la création de vente
 */
export async function logSaleCreation(params: {
  tenantId: string
  userId: number
  userName: string
  saleId: number
  ticketNumber: string
  totalTTC: number
  itemsCount: number
  hash: string
  signature: string
  establishmentId: number
  registerId: number
  ipAddress?: string | null
}) {
  await logAuditEvent({
    tenantId: params.tenantId,
    userId: params.userId,
    userName: params.userName,
    entityType: 'sale',
    entityId: params.saleId,
    action: AuditEventType.SALE_CREATE,
    changes: {
      ticketNumber: params.ticketNumber,
      totalTTC: params.totalTTC,
      items: params.itemsCount,
    },
    metadata: {
      hash: params.hash,
      signature: params.signature,
      establishmentId: params.establishmentId,
      registerId: params.registerId,
    },
    ipAddress: params.ipAddress,
  })
}

/**
 * Log spécifique pour l'annulation de vente
 */
export async function logSaleCancellation(params: {
  tenantId: string
  userId: number
  userName: string
  saleId: number
  ticketNumber: string
  reason: string
  ipAddress?: string | null
}) {
  await logAuditEvent({
    tenantId: params.tenantId,
    userId: params.userId,
    userName: params.userName,
    entityType: 'sale',
    entityId: params.saleId,
    action: AuditEventType.SALE_CANCEL,
    changes: {
      status: 'cancelled',
      reason: params.reason,
    },
    metadata: {
      ticketNumber: params.ticketNumber,
    },
    ipAddress: params.ipAddress,
  })
}

/**
 * Log spécifique pour la clôture de journée
 */
export async function logClosure(params: {
  tenantId: string
  userId: number | null
  userName: string | null
  closureId: number
  closureDate: string
  registerId: number
  establishmentId: number
  ticketCount: number
  totalTTC: number
  closureHash: string
  ipAddress?: string | null
}) {
  await logAuditEvent({
    tenantId: params.tenantId,
    userId: params.userId,
    userName: params.userName,
    entityType: 'closure',
    entityId: params.closureId,
    action: AuditEventType.CLOSURE_CREATE,
    changes: {
      closureDate: params.closureDate,
      ticketCount: params.ticketCount,
      totalTTC: params.totalTTC,
    },
    metadata: {
      hash: params.closureHash,
      registerId: params.registerId,
      establishmentId: params.establishmentId,
    },
    ipAddress: params.ipAddress,
  })
}

/**
 * Log spécifique pour la vérification de chaîne
 */
export async function logChainVerification(params: {
  tenantId: string
  userId: number | null
  userName: string | null
  isValid: boolean
  ticketCount: number
  brokenLinksCount: number
  registerId?: number | null
  ipAddress?: string | null
}) {
  await logAuditEvent({
    tenantId: params.tenantId,
    userId: params.userId,
    userName: params.userName,
    entityType: 'system',
    entityId: null,
    action: params.isValid ? AuditEventType.CHAIN_VERIFICATION : AuditEventType.CHAIN_INTEGRITY_FAILED,
    changes: {
      ticketCount: params.ticketCount,
      brokenLinksCount: params.brokenLinksCount,
    },
    metadata: {
      integrityStatus: params.isValid ? 'valid' : 'invalid',
      registerId: params.registerId || undefined,
    },
    ipAddress: params.ipAddress,
  })
}

/**
 * Log spécifique pour les erreurs système
 */
export async function logSystemError(params: {
  tenantId: string
  errorMessage: string
  errorStack?: string
  context?: string
  ipAddress?: string | null
}) {
  await logAuditEvent({
    tenantId: params.tenantId,
    userId: null,
    userName: 'System',
    entityType: 'system',
    entityId: null,
    action: AuditEventType.SYSTEM_ERROR,
    changes: {
      errorMessage: params.errorMessage,
      context: params.context,
    },
    metadata: {
      errorStack: params.errorStack,
    },
    ipAddress: params.ipAddress,
  })
}
