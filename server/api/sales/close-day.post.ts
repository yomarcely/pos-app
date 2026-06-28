import { db } from '~/server/database/connection'
import { sales, closures, registers, pendingSales } from '~/server/database/schema'
import { desc, gte, lt, and, eq, inArray, sql } from 'drizzle-orm'
import crypto from 'crypto'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { validateBody } from '~/server/utils/validation'
import { closeDaySchema, type CloseDayInput } from '~/server/validators/sale.schema'
import { logClosure, logSystemError } from '~/server/utils/audit'
import { logger } from '~/server/utils/logger'
import { assertHTplusTVAequalsTTC, htPlusTVADiffCents } from '~/server/utils/financialValidation'

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
    assertRole(event, 'manager')
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
    // 1b. VÉRIFIER QU'AUCUN TICKET N'EST EN ATTENTE SUR CETTE CAISSE
    // ==========================================
    // Bloquant (409) sauf si force=true. En cas de force, les tickets en attente
    // restants sont journalisés dans l'audit log de clôture (traçabilité NF525
    // des paniers abandonnés) — cf. étape 6.
    const pendingRows = await db
      .select({
        id: pendingSales.id,
        items: pendingSales.items,
        createdAt: pendingSales.createdAt,
        createdByEmail: pendingSales.createdByEmail,
      })
      .from(pendingSales)
      .where(
        and(
          eq(pendingSales.tenantId, tenantId),
          eq(pendingSales.registerId, body.registerId),
        )
      )

    const pendingSummary = pendingRows.map(p => ({
      id: p.id,
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
      createdByEmail: p.createdByEmail ?? null,
      itemCount: Array.isArray(p.items) ? p.items.length : 0,
    }))

    if (pendingSummary.length > 0 && !body.force) {
      throw createError({
        statusCode: 409,
        message: `Impossible de clôturer : ${pendingSummary.length} ticket(s) en attente sur cette caisse. Reprenez ou supprimez-les, ou forcez la clôture.`,
        data: {
          reason: 'pending_sales',
          pendingCount: pendingSummary.length,
          pendingSales: pendingSummary,
        },
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

    // ==========================================
    // REGISTRE IMMUABLE (NF525) — quelles ventes comptent dans les totaux
    // ==========================================
    // Une annulation NF525 ne retire PAS la vente des totaux : elle émet un avoir
    // (type='credit_note', négatif) qui la compense. Les totaux somment donc :
    //  - les ventes normales 'completed',
    //  - les avoirs (négatifs),
    //  - les ventes annulées AYANT un avoir lié (creditNoteId) → restent comptées
    //    pour que l'avoir les annule (net 0 si l'avoir tombe le même jour).
    // Les anciennes ventes annulées SANS avoir (legacy) restent exclues.
    const completedSales = dailySales.filter(s => s.status === 'completed' && s.type !== 'credit_note')
    const creditNotes = dailySales.filter(s => s.type === 'credit_note')
    const offsetCancelledSales = dailySales.filter(s => s.status === 'cancelled' && s.creditNoteId != null)
    const cancelledSales = dailySales.filter(s => s.status === 'cancelled')

    const salesForTotals = [...completedSales, ...creditNotes, ...offsetCancelledSales]

    // ==========================================
    // 3. CALCULER LES TOTAUX
    // ==========================================
    const totalTTCCents = salesForTotals.reduce(
      (sum, s) => sum + Math.round(Number(s.totalTTC) * 100), 0
    )
    const totalHtCents = salesForTotals.reduce(
      (sum, s) => sum + Math.round(Number(s.totalHT) * 100), 0
    )
    const totalTVACents = salesForTotals.reduce(
      (sum, s) => sum + Math.round(Number(s.totalTVA) * 100), 0
    )
    const totalTTC = totalTTCCents / 100
    const totalHT = totalHtCents / 100
    const totalTVA = totalTVACents / 100
    const ticketCount = completedSales.length
    const creditNoteCount = creditNotes.length

    // ==========================================
    // 3a. CONTRÔLE TRANSITOIRE — TOTAUX VIA AGRÉGAT SQL
    // ==========================================
    // Aujourd'hui les totaux sont sommés en JS sur TOUTES les ventes du jour
    // chargées en mémoire (sans LIMIT) → ne passe pas à l'échelle. On calcule les
    // mêmes totaux via un agrégat SQL (SUM en centimes) sur le MÊME périmètre que
    // `salesForTotals`. Pendant la période de transition, le JS reste la source de
    // vérité ; tout écart JS↔SQL est remonté (logger.warn) pour investigation avant
    // de basculer définitivement sur le calcul SQL (et d'abandonner le chargement
    // intégral pour les totaux).
    const [sqlTotals] = await db
      .select({
        totalTTCCents: sql<string>`COALESCE(SUM(ROUND(${sales.totalTTC} * 100)), 0)`,
        totalHTCents: sql<string>`COALESCE(SUM(ROUND(${sales.totalHT} * 100)), 0)`,
        totalTVACents: sql<string>`COALESCE(SUM(ROUND(${sales.totalTVA} * 100)), 0)`,
      })
      .from(sales)
      .where(
        and(
          gte(sales.saleDate, startOfDay),
          lt(sales.saleDate, endOfDay),
          eq(sales.tenantId, tenantId),
          eq(sales.registerId, body.registerId),
          // Miroir exact de `salesForTotals` : ventes 'completed' hors avoir,
          // avoirs (négatifs), et ventes annulées compensées par un avoir.
          // `IS DISTINCT FROM` reproduit le `!==` JS même si `type` était NULL.
          sql`(
            (${sales.status} = 'completed' AND ${sales.type} IS DISTINCT FROM 'credit_note')
            OR ${sales.type} = 'credit_note'
            OR (${sales.status} = 'cancelled' AND ${sales.creditNoteId} IS NOT NULL)
          )`,
        )
      )

    const sqlTotalTTCCents = Number(sqlTotals?.totalTTCCents ?? 0)
    const sqlTotalHtCents = Number(sqlTotals?.totalHTCents ?? 0)
    const sqlTotalTVACents = Number(sqlTotals?.totalTVACents ?? 0)

    if (
      sqlTotalTTCCents !== totalTTCCents ||
      sqlTotalHtCents !== totalHtCents ||
      sqlTotalTVACents !== totalTVACents
    ) {
      logger.warn(
        {
          registerId: body.registerId,
          date: body.date,
          js: { totalTTCCents, totalHtCents, totalTVACents },
          sql: { totalTTCCents: sqlTotalTTCCents, totalHtCents: sqlTotalHtCents, totalTVACents: sqlTotalTVACents },
        },
        'Écart totaux clôture JS vs agrégat SQL (période de transition)'
      )
    }

    // ==========================================
    // 3b. CONTRÔLE DE COHÉRENCE HT + TVA = TTC (NF525)
    // ==========================================
    // Bloquant (409) si l'écart dépasse 1 centime, sauf si force=true. En cas
    // de force, l'incohérence est journalisée dans l'audit log de clôture.
    assertHTplusTVAequalsTTC(totalHT, totalTVA, totalTTC, 'close-day')
    const totalsDiffCents = htPlusTVADiffCents(totalHT, totalTVA, totalTTC)
    const totalsDiscrepancy =
      Math.abs(totalsDiffCents) > 1
        ? { totalHT, totalTVA, totalTTC, diffCents: totalsDiffCents }
        : null

    if (totalsDiscrepancy && !body.force) {
      throw createError({
        statusCode: 409,
        message: `Impossible de clôturer : incohérence comptable HT + TVA ≠ TTC (écart de ${(totalsDiffCents / 100).toFixed(2)} €). Vérifiez les ventes ou forcez la clôture.`,
        data: {
          reason: 'totals_mismatch',
          totalHT,
          totalTVA,
          totalTTC,
          diffCents: totalsDiffCents,
          diff: totalsDiffCents / 100,
        },
      })
    }

    const cancelledCount = cancelledSales.length

    // Totaux par mode de paiement (sur le même ensemble → l'avoir négatif compense l'origine)
    interface PaymentEntry {
      mode: string
      amount: number
    }

    const paymentMethods: Record<string, number> = {}

    salesForTotals.forEach(sale => {
      const payments = sale.payments as PaymentEntry[]
      payments.forEach(payment => {
        paymentMethods[payment.mode] = (paymentMethods[payment.mode] ?? 0) + payment.amount
      })
    })

    // ==========================================
    // 4. GÉNÉRER LE HASH DE CLÔTURE (NF525)
    // ==========================================
    // dailySales est trié desc(saleDate) ; on restreint aux documents fiscaux comptés.
    const fiscalDocs = dailySales.filter(s => s.status === 'completed' || s.type === 'credit_note')
    const lastTicketHash = fiscalDocs.length > 0 ? (fiscalDocs[0]?.currentHash ?? 'INITIAL') : 'INITIAL'
    const firstTicketNumber = fiscalDocs.length > 0 ? (fiscalDocs[fiscalDocs.length - 1]?.ticketNumber ?? null) : null
    const lastTicketNumber = fiscalDocs.length > 0 ? (fiscalDocs[0]?.ticketNumber ?? null) : null

    const closureData = {
      date: body.date,
      ticketCount,
      creditNoteCount,
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
      closedById: null,
    }).returning()

    if (!newClosure) {
      throw createError({ statusCode: 500, message: 'Échec de la création de la clôture' })
    }

    logger.info({
      closureId: newClosure.id,
      closureHash: closureHash.substring(0, 16),
      registerId: body.registerId,
      date: body.date
    }, 'Clôture créée')

    // ==========================================
    // 6. ENREGISTRER LA CLÔTURE DANS L'AUDIT LOG (NF525)
    // ==========================================
    // Anomalies contournées par une clôture forcée (force=true) — consignées
    // pour la traçabilité NF525 (cf. étapes 1b et 3b).
    const forcedPending = body.force && pendingSummary.length > 0 ? pendingSummary : undefined
    const forcedDiscrepancy = body.force && totalsDiscrepancy ? totalsDiscrepancy : undefined
    const wasForced = Boolean(forcedPending || forcedDiscrepancy)

    await logClosure({
      tenantId,
      userId: null,
      userName,
      closureId: newClosure.id,
      closureDate: body.date,
      registerId: body.registerId,
      establishmentId: register.establishmentId,
      ticketCount,
      totalTTC,
      closureHash,
      forced: wasForced,
      anomalies: wasForced
        ? {
            ...(forcedDiscrepancy ? { totalsDiscrepancy: forcedDiscrepancy } : {}),
            ...(forcedPending ? { pendingSales: forcedPending } : {}),
          }
        : null,
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
      message: wasForced
        ? 'Journée clôturée (forcée — anomalie consignée dans l\'audit log)'
        : 'Journée clôturée avec succès',
      forced: wasForced,
      closure: {
        id: newClosure.id,
        date: body.date,
        closureHash,
        ticketCount,
        creditNoteCount,
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

    await logSystemError({
      tenantId: getTenantIdFromEvent(event),
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      context: 'sales/close-day',
      ipAddress: getRequestIP(event) || null,
    })

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
