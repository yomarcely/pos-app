import { db, type DbExecutor } from '~/server/database/connection'
import { auditLogs } from '~/server/database/schema'
import { logger } from '~/server/utils/logger'

// ⚠️ Tout log d'audit émis DEPUIS une transaction doit recevoir `tx` en second
// paramètre (deadlock en mode pooler sinon — voir DbExecutor dans connection.ts).
export type { DbExecutor }

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
  TICKET_REPRINT = 'ticket_reprint',

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

  // Événements génériques CRUD (Q6/Q12)
  ENTITY_CREATE = 'entity_create',
  ENTITY_UPDATE = 'entity_update',
  ENTITY_DELETE = 'entity_delete',
  ENTITY_DEACTIVATE = 'entity_deactivate',

  // Événements RGPD (Q9)
  CUSTOMER_ANONYMIZE = 'customer_anonymize',

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
  // Q12 — typage élargi : accepte les diffs `{ old, new }` pour ENTITY_UPDATE
  // tout en restant rétrocompatible avec les valeurs scalaires.
  changes?: Record<string, unknown>
  metadata?: AuditMetadata
  ipAddress?: string | null
}, executor?: DbExecutor): Promise<void> {
  try {
    // Résolu DANS le try : l'accès à `db` fait partie du contrat « l'audit ne
    // bloque jamais l'opération principale » (un défaut de paramètre serait
    // évalué avant le try et propagerait l'erreur à l'appelant).
    await (executor ?? db).insert(auditLogs).values({
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
}, executor?: DbExecutor): Promise<void> {
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
  }, executor)
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
}): Promise<void> {
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
 * Log spécifique pour la réimpression manuelle d'un ticket / facture (NF525).
 *
 * Traçabilité exigée : toute réédition d'un document de vente doit être
 * journalisée (qui, quand, quel ticket, quel format). N'altère pas la chaîne
 * de hash — c'est un événement d'audit, pas une nouvelle vente.
 */
export async function logTicketReprint(params: {
  tenantId: string
  userId: number | null
  userName: string | null
  saleId: number | null
  ticketNumber: string
  documentType: 'receipt' | 'invoice'
  establishmentId?: number
  registerId?: number
  ipAddress?: string | null
}): Promise<void> {
  await logAuditEvent({
    tenantId: params.tenantId,
    userId: params.userId,
    userName: params.userName,
    entityType: 'sale',
    entityId: params.saleId,
    action: AuditEventType.TICKET_REPRINT,
    changes: {
      ticketNumber: params.ticketNumber,
      documentType: params.documentType,
    },
    metadata: {
      ticketNumber: params.ticketNumber,
      establishmentId: params.establishmentId,
      registerId: params.registerId,
    },
    ipAddress: params.ipAddress,
  })
}

/**
 * Anomalies tracées lors d'une clôture forcée (NF525).
 *
 * Quand l'opérateur force une clôture malgré une anomalie bloquante, la
 * traçabilité exige de consigner précisément ce qui a été contourné :
 *  - `totalsDiscrepancy` : incohérence HT+TVA≠TTC (écart > 1 centime)
 *  - `pendingSales` : tickets restés en attente sur la caisse au moment
 *    de la clôture (paniers abandonnés non encaissés)
 */
export interface ClosureAnomalies {
  totalsDiscrepancy?: {
    totalHT: number
    totalTVA: number
    totalTTC: number
    diffCents: number
  }
  pendingSales?: Array<{
    id: number
    createdAt: string | null
    createdByEmail: string | null
    itemCount: number
  }>
}

/**
 * Log spécifique pour la clôture de journée.
 *
 * `forced`/`anomalies` : renseignés uniquement lors d'une clôture forcée
 * (force=true) — l'anomalie contournée est alors consignée dans `changes`
 * pour la traçabilité NF525.
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
  forced?: boolean
  anomalies?: ClosureAnomalies | null
  ipAddress?: string | null
}): Promise<void> {
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
      ...(params.forced
        ? { forced: true, anomalies: params.anomalies ?? {} }
        : {}),
    },
    metadata: {
      hash: params.closureHash,
      registerId: params.registerId,
      establishmentId: params.establishmentId,
      ...(params.forced ? { forced: true } : {}),
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
}): Promise<void> {
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
 * Log spécifique pour la création d'une entité (Q12).
 * Capture l'entité créée dans `changes` pour pouvoir la reconstituer.
 */
export async function logEntityCreation(params: {
  tenantId: string
  userId: number | null
  userName: string | null
  entityType: string
  entityId: number
  snapshot?: Record<string, unknown>
  ipAddress?: string | null
}): Promise<void> {
  await logAuditEvent({
    tenantId: params.tenantId,
    userId: params.userId,
    userName: params.userName,
    entityType: params.entityType,
    entityId: params.entityId,
    action: AuditEventType.ENTITY_CREATE,
    changes: params.snapshot,
    ipAddress: params.ipAddress,
  })
}

/**
 * Log spécifique pour la modification d'une entité (Q12).
 *
 * `changes` : snapshot des valeurs APRÈS modification. Pas de diff
 * automatique — l'historique se reconstitue en lisant les logs
 * successifs pour une même `entityId`. Un diff structuré avec
 * `{ field: { old, new } }` sera ajouté ultérieurement (nécessite
 * un SELECT before + adaptation des mocks de tests).
 */
export async function logEntityUpdate(params: {
  tenantId: string
  userId: number | null
  userName: string | null
  entityType: string
  entityId: number
  changes: Record<string, unknown>
  ipAddress?: string | null
}): Promise<void> {
  await logAuditEvent({
    tenantId: params.tenantId,
    userId: params.userId,
    userName: params.userName,
    entityType: params.entityType,
    entityId: params.entityId,
    action: AuditEventType.ENTITY_UPDATE,
    changes: params.changes,
    ipAddress: params.ipAddress,
  })
}

/**
 * Log spécifique pour la suppression d'une entité (Q6).
 *
 * Capture un snapshot de l'entité avant suppression dans `changes`
 * pour pouvoir reconstituer en cas de litige/enquête. Le helper est
 * générique : à appeler depuis n'importe quel endpoint *.delete.ts.
 *
 * Échec d'audit n'est PAS bloquant (logAuditEvent capture l'erreur
 * en interne) — la suppression métier reste prioritaire.
 */
export async function logEntityDeletion(params: {
  tenantId: string
  userId: number | null
  userName: string | null
  entityType: string
  entityId: number
  snapshot?: Record<string, string | number | boolean | null | undefined>
  ipAddress?: string | null
}): Promise<void> {
  await logAuditEvent({
    tenantId: params.tenantId,
    userId: params.userId,
    userName: params.userName,
    entityType: params.entityType,
    entityId: params.entityId,
    action: AuditEventType.ENTITY_DELETE,
    changes: params.snapshot,
    ipAddress: params.ipAddress,
  })
}

/**
 * Log spécifique pour la désactivation (soft-delete) d'une entité (Q6).
 *
 * Convention FymPOS : establishments/registers/sellers ne sont pas
 * supprimés en base mais désactivés (`isActive = false`) pour préserver
 * l'intégrité des références historiques (ventes/clôtures NF525).
 */
export async function logEntityDeactivation(params: {
  tenantId: string
  userId: number | null
  userName: string | null
  entityType: string
  entityId: number
  snapshot?: Record<string, string | number | boolean | null | undefined>
  ipAddress?: string | null
}): Promise<void> {
  await logAuditEvent({
    tenantId: params.tenantId,
    userId: params.userId,
    userName: params.userName,
    entityType: params.entityType,
    entityId: params.entityId,
    action: AuditEventType.ENTITY_DEACTIVATE,
    changes: params.snapshot,
    ipAddress: params.ipAddress,
  })
}

/**
 * Log spécifique pour l'anonymisation d'un client (RGPD - Q9).
 *
 * Trace exigence légale (CNIL). `snapshot` contient les valeurs avant
 * anonymisation pour preuve. Ne JAMAIS retirer ce log même si performance.
 */
export async function logCustomerAnonymization(params: {
  tenantId: string
  userId: number | null
  userName: string | null
  customerId: number
  snapshot: {
    firstName?: string | null
    lastName?: string | null
    email?: string | null
    phone?: string | null
    address?: string | null
  }
  reason?: string
  ipAddress?: string | null
}): Promise<void> {
  await logAuditEvent({
    tenantId: params.tenantId,
    userId: params.userId,
    userName: params.userName,
    entityType: 'customer',
    entityId: params.customerId,
    action: AuditEventType.CUSTOMER_ANONYMIZE,
    changes: {
      firstName: params.snapshot.firstName ?? undefined,
      lastName: params.snapshot.lastName ?? undefined,
      email: params.snapshot.email ?? undefined,
      phone: params.snapshot.phone ?? undefined,
      address: params.snapshot.address ?? undefined,
    },
    metadata: {
      anonymizedAt: new Date().toISOString(),
      reason: params.reason || 'RGPD - droit à l\'oubli',
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
}): Promise<void> {
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
