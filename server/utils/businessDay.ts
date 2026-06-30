/**
 * ==========================================
 * JOUR MÉTIER (« business day »)
 * ==========================================
 *
 * Source unique de vérité pour le « jour » du commerçant : numérotation des
 * tickets, date de clôture, bornes des synthèses/clôtures.
 *
 * Pourquoi ce module : le jour civil d'un commerçant est défini dans SON fuseau,
 * pas dans celui — variable — du process Node (Europe/Paris en dev sur le poste,
 * souvent UTC en production cloud). Sans point d'ancrage commun, une vente faite
 * entre minuit local et le décalage UTC est rattachée au mauvais jour, et la
 * numérotation NF525 (calculée en local) diverge des bornes de clôture
 * (calculées via setHours, donc dans le fuseau du process).
 *
 * Invariant : toute logique de « jour » côté serveur DOIT dériver d'ici.
 * Ne PAS confondre avec la `saleDate` NF525 stockée — qui reste l'instant exact
 * (UTC) hashé dans la chaîne et n'est jamais altérée par ce module.
 *
 * Fuseau surchargrable via la variable d'environnement `BUSINESS_TIMEZONE`.
 */

export const BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE?.trim() || 'Europe/Paris'

/**
 * Décalage (ms) entre l'heure murale du fuseau métier et UTC à un instant donné.
 * Gère automatiquement l'heure d'été/hiver.
 */
function timezoneOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)

  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - instant.getTime()
}

/**
 * Instant UTC correspondant à une heure murale du fuseau métier.
 * Minuit n'étant jamais sur une bascule DST en Europe/Paris (transitions à
 * 02h/03h), une seule correction de décalage suffit pour les bornes de journée.
 */
function wallClockToUtc(year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second, ms)
  const offset = timezoneOffsetMs(new Date(naiveUtc))
  return new Date(naiveUtc - offset)
}

/**
 * Jour métier d'un instant, au format `YYYY-MM-DD`.
 * @param instant - Instant à évaluer (défaut : maintenant)
 */
export function getBusinessDayString(instant: Date = new Date()): string {
  // en-CA produit nativement le format ISO `YYYY-MM-DD`.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

/**
 * Bornes UTC d'un jour métier `YYYY-MM-DD`, en intervalle semi-ouvert :
 * minuit local du jour (inclus) → minuit local du lendemain (exclu).
 * À utiliser avec `gte(start)` + `lt(end)`.
 *
 * @param dayStr - Jour au format `YYYY-MM-DD`
 */
export function getBusinessDayBounds(dayStr: string): { start: Date; end: Date } {
  const [y, m, d] = dayStr.split('-')
  const year = Number(y)
  const month = Number(m)
  const day = Number(d)
  const start = wallClockToUtc(year, month, day)
  // Date.UTC gère le débordement de mois/année (ex: 32 juin → 2 juillet).
  const end = wallClockToUtc(year, month, day + 1)
  return { start, end }
}
