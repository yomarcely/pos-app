import { db } from '~/server/database/connection'
import { sales, closures, registers } from '~/server/database/schema'
import { desc, gte, lt, and, eq, inArray } from 'drizzle-orm'
import crypto from 'crypto'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { validateBody } from '~/server/utils/validation'
import { closeDaySchema, type CloseDayInput } from '~/server/validators/sale.schema'
import { logClosure } from '~/server/utils/audit'
import { logger } from '~/server/utils/logger'

/**
 * ==========================================
 * API: Clôturer une journée (NF525)
 * ==========================================
 *
 * POST /api/sales/close-day
 *
 * Clôture une journée de caisse selon les exigences NF525 :
 * - Calcul des totaux de la journée
 * - Génération d'un hash de clôture cryptographique
 * - Enregistrement dans la table closures
 * - Mise à jour des ventes avec closureId et closedAt
 * - Blocage des nouvelles ventes pour cette journée
 */

interface CloseDayRequest {
  date: string // Format YYYY-MM-DD
  registerId?: number
}

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    const auth = event.context.auth
    const userId = auth?.user?.id || null
    const userName = auth?.user?.email || auth?.user?.user_metadata?.name || 'Utilisateur'
    const body = await validateBody<CloseDayInput>(event, closeDaySchema)

    const targetDate = new Date(body.date)

    // Début et fin de la journée
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    // ==========================================
    // 0. RÉCUPÉRER LES INFOS DE LA CAISSE
    // ==========================================
    const [register] = await db
      .select()
      .from(registers)
      .where(
        and(
          eq(registers.id, body.registerId),
          eq(registers.tenantId, tenantId)
        )
      )
      .limit(1)

    if (!register) {
      throw createError({
        statusCode: 404,
        message: 'Caisse non trouvée',
      })
    }

    // ==========================================
    // 1. VÉRIFIER SI LA JOURNÉE EST DÉJÀ CLÔTURÉE POUR CETTE CAISSE
    // ==========================================
    const existingClosure = await db
      .select()
      .from(closures)
      .where(
        and(
          eq(closures.closureDate, body.date),
          eq(closures.tenantId, tenantId),
          eq(closures.registerId, body.registerId),
        )
      )
      .limit(1)

    if (existingClosure.length > 0) {
      throw createError({
        statusCode: 400,
        message: 'Cette journée est déjà clôturée pour cette caisse',
      })
    }

    // ==========================================
    // 2. RÉCUPÉRER TOUTES LES VENTES DU JOUR POUR CETTE CAISSE
    // ==========================================
    const dailySales = await db
      .select()
      .from(sales)
      .where(
        and(
          gte(sales.saleDate, startOfDay),
          lt(sales.saleDate, endOfDay),
          eq(sales.tenantId, tenantId),
          eq(sales.registerId, body.registerId)
        )
      )
      .orderBy(desc(sales.saleDate))

    // Ventes actives uniquement
    const activeSales = dailySales.filter(s => s.status === 'completed')
    const cancelledSales = dailySales.filter(s => s.status === 'cancelled')

    // ==========================================
    // 3. CALCULER LES TOTAUX
    // ==========================================
    const totalTTC = activeSales.reduce((sum, s) => sum + Number(s.totalTTC), 0)
    const totalHT = activeSales.reduce((sum, s) => sum + Number(s.totalHT), 0)
    const totalTVA = activeSales.reduce((sum, s) => sum + Number(s.totalTVA), 0)
    const ticketCount = activeSales.length
    const cancelledCount = cancelledSales.length

    // Totaux par mode de paiement
    interface PaymentEntry {
      mode: string
      amount: number
    }

    const paymentMethods: Record<string, number> = {}

    activeSales.forEach(sale => {
      const payments = sale.payments as PaymentEntry[]
      payments.forEach(payment => {
        if (!paymentMethods[payment.mode]) {
          paymentMethods[payment.mode] = 0
        }
        paymentMethods[payment.mode] += payment.amount
      })
    })

    // ==========================================
    // 4. GÉNÉRER LE HASH DE CLÔTURE (NF525)
    // ==========================================
    const lastTicketHash = activeSales.length > 0 ? activeSales[0].currentHash : 'INITIAL'
    const firstTicketNumber = activeSales.length > 0 ? activeSales[activeSales.length - 1].ticketNumber : null
    const lastTicketNumber = activeSales.length > 0 ? activeSales[0].ticketNumber : null

    const closureData = {
      date: body.date,
      ticketCount,
      cancelledCount,
      totalHT: totalHT.toFixed(2),
      totalTVA: totalTVA.toFixed(2),
      totalTTC: totalTTC.toFixed(2),
      paymentMethods,
      lastTicketHash,
      timestamp: new Date().toISOString(),
    }

    // Générer le hash SHA-256
    const closureHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(closureData))
      .digest('hex')

    // ==========================================
    // 5. CRÉER L'ENREGISTREMENT DE CLÔTURE
    // ==========================================
    const [newClosure] = await db.insert(closures).values({
      tenantId,
      closureDate: body.date,
      registerId: body.registerId,
      establishmentId: register.establishmentId,
      ticketCount,
      cancelledCount,
      totalHT: totalHT.toFixed(2),
      totalTVA: totalTVA.toFixed(2),
      totalTTC: totalTTC.toFixed(2),
      paymentMethods,
      closureHash,
      firstTicketNumber,
      lastTicketNumber,
      lastTicketHash,
      closedBy: userName,
      closedById: userId,
    }).returning()

    logger.info({
      closureId: newClosure.id,
      closureHash: closureHash.substring(0, 16),
      registerId: body.registerId,
      date: body.date
    }, 'Clôture créée')

    // ==========================================
    // 6. ENREGISTRER LA CLÔTURE DANS L'AUDIT LOG (NF525)
    // ==========================================
    await logClosure({
      tenantId,
      userId,
      userName,
      closureId: newClosure.id,
      closureDate: body.date,
      registerId: body.registerId,
      establishmentId: register.establishmentId,
      ticketCount,
      totalTTC,
      closureHash,
      ipAddress: getRequestIP(event) || null,
    })

    logger.debug({ closureId: newClosure.id }, 'Clôture enregistrée dans l\'audit log')

    // ==========================================
    // 7. METTRE À JOUR TOUTES LES VENTES DU JOUR
    // ==========================================
    if (dailySales.length > 0) {
      const saleIds = dailySales.map(s => s.id)

      await db
        .update(sales)
        .set({
          closureId: newClosure.id,
          closedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            inArray(sales.id, saleIds),
            eq(sales.tenantId, tenantId),
          )
        )

      logger.debug({ salesCount: dailySales.length, closureId: newClosure.id }, 'Ventes marquées comme clôturées')
    }

    logger.info({
      ticketCount,
      totalTTC: totalTTC.toFixed(2),
      registerId: body.registerId
    }, 'Journée clôturée avec succès')

    // ==========================================
    // 8. RETOURNER LA SYNTHÈSE DE CLÔTURE
    // ==========================================
    return {
      success: true,
      message: 'Journée clôturée avec succès',
      closure: {
        id: newClosure.id,
        date: body.date,
        closureHash,
        ticketCount,
        cancelledCount,
        totalHT,
        totalTVA,
        totalTTC,
        paymentMethods,
        closedAt: newClosure.createdAt,
        closedBy: newClosure.closedBy,
      },
    }
  } catch (error) {
    logger.error({ err: error }, 'Erreur lors de la clôture de journée')

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
