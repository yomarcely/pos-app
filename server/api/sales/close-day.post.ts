import { db } from '~/server/database/connection'
import { sales, closures, auditLogs } from '~/server/database/schema'
import { desc, gte, lt, and, eq, inArray } from 'drizzle-orm'
import crypto from 'crypto'

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
  userId?: number
  userName?: string
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<CloseDayRequest>(event)

    if (!body.date) {
      throw createError({
        statusCode: 400,
        message: 'Date de clôture manquante',
      })
    }

    const targetDate = new Date(body.date)

    // Début et fin de la journée
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    // ==========================================
    // 1. VÉRIFIER SI LA JOURNÉE EST DÉJÀ CLÔTURÉE
    // ==========================================
    const existingClosure = await db
      .select()
      .from(closures)
      .where(eq(closures.closureDate, body.date))
      .limit(1)

    if (existingClosure.length > 0) {
      throw createError({
        statusCode: 400,
        message: 'Cette journée est déjà clôturée',
      })
    }

    // ==========================================
    // 2. RÉCUPÉRER TOUTES LES VENTES DU JOUR
    // ==========================================
    const dailySales = await db
      .select()
      .from(sales)
      .where(
        and(
          gte(sales.saleDate, startOfDay),
          lt(sales.saleDate, endOfDay)
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
    const paymentMethods: Record<string, number> = {}

    activeSales.forEach(sale => {
      const payments = sale.payments as any[]
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
      closureDate: body.date,
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
      closedBy: body.userName || 'System',
      closedById: body.userId || null,
    }).returning()

    console.log(`🔒 Clôture créée - ID: ${newClosure.id}, Hash: ${closureHash.substring(0, 16)}...`)

    // ==========================================
    // 6. ENREGISTRER LA CLÔTURE DANS L'AUDIT LOG (NF525)
    // ==========================================
    await db.insert(auditLogs).values({
      userId: body.userId || null,
      userName: body.userName || 'System',
      entityType: 'closure',
      entityId: newClosure.id,
      action: 'create',
      changes: {
        closureDate: body.date,
        ticketCount,
        cancelledCount,
        totalHT: totalHT.toFixed(2),
        totalTVA: totalTVA.toFixed(2),
        totalTTC: totalTTC.toFixed(2),
        closureHash,
      },
      metadata: {
        firstTicketNumber,
        lastTicketNumber,
        lastTicketHash,
        paymentMethods,
      },
      ipAddress: getRequestIP(event) || null,
    })

    console.log(`📝 Clôture enregistrée dans l'audit log`)

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
        .where(inArray(sales.id, saleIds))

      console.log(`📝 ${dailySales.length} vente(s) marquée(s) comme clôturées`)
    }

    console.log(`📊 ${ticketCount} ticket(s), Total: ${totalTTC.toFixed(2)} €`)

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
    console.error('Erreur lors de la clôture de journée:', error)

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Erreur interne du serveur',
    })
  }
})
