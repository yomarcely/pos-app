import { db } from '~/server/database/connection'
import { sales } from '~/server/database/schema'
import { eq, and } from 'drizzle-orm'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { reprintTicketSchema, type ReprintTicketInput } from '~/server/validators/sale.schema'
import { logTicketReprint } from '~/server/utils/audit'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Tracer une réimpression de ticket / facture (NF525)
 * ==========================================
 *
 * POST /api/sales/reprint
 *
 * N'imprime rien côté serveur : l'impression a lieu côté client. Cet endpoint
 * journalise l'événement d'audit `ticket_reprint` pour la traçabilité NF525
 * (toute réédition d'un document de vente doit être enregistrée).
 */
export default defineEventHandler(async (event) => {
  const tenantId = getTenantIdFromEvent(event)
  const auth = event.context.auth
  const userName = auth?.user?.email || auth?.user?.user_metadata?.name || 'Utilisateur'

  const body = await validateBody<ReprintTicketInput>(event, reprintTicketSchema)

  // Retrouver la vente pour rattacher l'audit à l'entité (entityId)
  const [sale] = await db
    .select({ id: sales.id })
    .from(sales)
    .where(
      and(
        eq(sales.ticketNumber, body.ticketNumber),
        eq(sales.tenantId, tenantId),
      ),
    )
    .limit(1)

  await logTicketReprint({
    tenantId,
    userId: null,
    userName,
    saleId: sale?.id ?? null,
    ticketNumber: body.ticketNumber,
    documentType: body.documentType,
    establishmentId: body.establishmentId,
    registerId: body.registerId,
    ipAddress: getRequestIP(event) || null,
  })

  logger.info({ ticketNumber: body.ticketNumber, documentType: body.documentType }, 'Réimpression de ticket tracée')

  return { success: true }
})
