import { db, type DbExecutor } from '~/server/database/connection'
import { sales, closures } from '~/server/database/schema'
import { and, eq, lt, desc } from 'drizzle-orm'
import { getBusinessDayString, getBusinessDayBounds } from '~/server/utils/businessDay'

/**
 * Renvoie le dernier jour métier AVANT aujourd'hui ayant de l'activité (au
 * moins une vente ou un avoir) mais PAS de clôture pour cette caisse — ou
 * null si tout est en ordre.
 *
 * Sert de garde : aucune nouvelle vente ne doit être enregistrée tant que la
 * dernière journée active n'est pas clôturée (oubli de clôture la veille →
 * blocage, même si des jours sans aucune activité se sont écoulés entre-temps
 * — un jour sans vente n'exige pas de clôture et ne débloque rien).
 */
export async function findLastUnclosedBusinessDay(
  tenantId: string,
  registerId: number,
  // ⚠️ Appelé depuis une transaction ? Passer `tx`, sinon deadlock en mode
  // pooler max=1 (voir DbExecutor dans server/database/connection.ts).
  executor: DbExecutor = db
): Promise<string | null> {
  const { start: todayStart } = getBusinessDayBounds(getBusinessDayString())

  const [lastSale] = await executor
    .select({ saleDate: sales.saleDate })
    .from(sales)
    .where(and(
      eq(sales.tenantId, tenantId),
      eq(sales.registerId, registerId),
      lt(sales.saleDate, todayStart),
    ))
    .orderBy(desc(sales.saleDate))
    .limit(1)

  if (!lastSale) return null

  const day = getBusinessDayString(lastSale.saleDate)

  const [closure] = await executor
    .select({ id: closures.id })
    .from(closures)
    .where(and(
      eq(closures.tenantId, tenantId),
      eq(closures.registerId, registerId),
      eq(closures.closureDate, day),
    ))
    .limit(1)

  return closure ? null : day
}
