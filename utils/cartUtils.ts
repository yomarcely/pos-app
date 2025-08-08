// cartUtils.ts
export type DiscountType = '%' | '€'
import type { ProductInCart } from '@/types/pos'

export interface GlobalDiscount {
  value: number
  type: DiscountType
}

export function round2(n: number) { return Math.round(n * 100) / 100 }
export function toCents(n: number) { return Math.round(n * 100) }
export function fromCents(c: number) { return c / 100 }

export function lineKey(it: ProductInCart) {
  return `${it.id}__${it.variation || ''}`
}

// Prix TTC unitaire après remise de ligne (%, €)
export function unitTtcAfterLineDiscount(it: ProductInCart): number {
  const dType = it.discountType ?? '%'
  const priceAfter =
    dType === '%'
      ? it.price * (1 - (it.discount || 0) / 100)
      : it.price - (it.discount || 0)

  return Math.max(0, round2(priceAfter))
}

// Allocation de la remise globale en € au prorata (centimes distribués)
export function globalEuroAllocationCents(
  items: ProductInCart[],
  global: GlobalDiscount
): Record<string, number> {
  if (global.type !== '€' || global.value <= 0 || items.length === 0) return {}

  const lines = items.map(it => {
    const key = lineKey(it)
    const lineTtcCents = toCents(unitTtcAfterLineDiscount(it) * it.quantity)
    return { key, it, lineTtcCents }
  })

  const basketTtcCents = lines.reduce((s, l) => s + l.lineTtcCents, 0)
  if (basketTtcCents <= 0) return {}

  const targetDiscountCents = Math.min(toCents(global.value), basketTtcCents)

  // Part brute
  const provisional = lines.map(l => {
    const exactShare = (l.lineTtcCents * targetDiscountCents) / basketTtcCents
    const floorCents = Math.floor(exactShare)
    const remainder = exactShare - floorCents
    return { ...l, floorCents, remainder }
  })

  // Distribution des centimes restants
  let allocated = provisional.reduce((s, p) => s + p.floorCents, 0)
  let residual = targetDiscountCents - allocated

  provisional.sort((a, b) =>
    b.remainder !== a.remainder
      ? b.remainder - a.remainder
      : (a.key < b.key ? -1 : 1)
  )

  const allocMap: Record<string, number> = {}
  for (const p of provisional) {
    let give = p.floorCents
    if (residual > 0) { give += 1; residual -= 1 }
    allocMap[p.key] = give
  }
  return allocMap
}

// Prix TTC unitaire final (applique remise ligne + globale)
export function getFinalPrice(
  it: ProductInCart,
  items: ProductInCart[],
  global: GlobalDiscount
): number {
  let unit = unitTtcAfterLineDiscount(it)

  if (global.type === '%') {
    unit = unit * (1 - (global.value || 0) / 100)
  } else if (global.type === '€') {
    const alloc = globalEuroAllocationCents(items, global)[lineKey(it)] || 0
    const perUnitEuro = fromCents(alloc) / (it.quantity || 1)
    unit = unit - perUnitEuro
  }
  return Math.max(0, round2(unit))
}

// TTC/HT/TVA calculés par ligne (centimes), TVA = TTC - HT
export function totalTTC(items: ProductInCart[], global: GlobalDiscount): number {
  const sumLines = items.reduce((s, it) => {
    const baseLineCents = toCents(unitTtcAfterLineDiscount(it) * it.quantity)
    let lineCents = baseLineCents

    if (global.type === '€') {
      const alloc = globalEuroAllocationCents(items, global)[lineKey(it)] || 0
      lineCents = Math.max(0, baseLineCents - alloc)
    } else if (global.type === '%') {
      const pct = Math.max(0, global.value || 0) / 100
      lineCents = Math.max(0, Math.round(lineCents * (1 - pct)))
    }
    return s + lineCents
  }, 0)

  return fromCents(sumLines)
}

export function totalHT(items: ProductInCart[], global: GlobalDiscount): number {
  const sumHtCents = items.reduce((s, it) => {
    const baseLineCents = toCents(unitTtcAfterLineDiscount(it) * it.quantity)
    let lineTtcCents = baseLineCents

    if (global.type === '€') {
      const alloc = globalEuroAllocationCents(items, global)[lineKey(it)] || 0
      lineTtcCents = Math.max(0, baseLineCents - alloc)
    } else if (global.type === '%') {
      const pct = Math.max(0, global.value || 0) / 100
      lineTtcCents = Math.max(0, Math.round(lineTtcCents * (1 - pct)))
    }

    const tvaRate = it.tva ?? 20
    const lineHt = fromCents(lineTtcCents) / (1 + tvaRate / 100)
    return s + toCents(round2(lineHt)) // arrondi par ligne
  }, 0)

  return fromCents(sumHtCents)
}

export function totalTVA(items: ProductInCart[], global: GlobalDiscount): number {
  return round2(totalTTC(items, global) - totalHT(items, global))
}
