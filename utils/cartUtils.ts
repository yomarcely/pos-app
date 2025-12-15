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

function buildLines(items: ProductInCart[]) {
  return items.map(it => {
    const lineCents = toCents(unitTtcAfterLineDiscount(it) * it.quantity)
    return {
      key: lineKey(it),
      lineCents,
      tvaRate: it.tva ?? 20,
      quantity: it.quantity,
    }
  })
}

// Allocation de la remise globale (%, €) au prorata (centimes distribués)
function globalDiscountAllocationCents(
  items: ProductInCart[],
  global: GlobalDiscount
): Record<string, number> {
  if (global.value <= 0 || items.length === 0) return {}

  const lines = buildLines(items)
  const basketTtcCents = lines.reduce((s, l) => s + l.lineCents, 0)
  if (basketTtcCents <= 0) return {}

  const targetDiscountCents = Math.min(
    global.type === '€'
      ? toCents(global.value)
      : Math.round((basketTtcCents * global.value) / 100),
    basketTtcCents
  )

  if (targetDiscountCents <= 0) return {}

  const provisional = lines.map(l => {
    const exactShare = (l.lineCents * targetDiscountCents) / basketTtcCents
    const floorCents = Math.floor(exactShare)
    const remainder = exactShare - floorCents
    return { ...l, floorCents, remainder }
  })

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

// Allocation spécifique € (conserve l'API existante)
export function globalEuroAllocationCents(
  items: ProductInCart[],
  global: GlobalDiscount
): Record<string, number> {
  if (global.type !== '€') return {}
  return globalDiscountAllocationCents(items, global)
}

// Prix TTC unitaire final (applique remise de ligne + remise globale)
export function getFinalPrice(
  it: ProductInCart,
  items: ProductInCart[],
  global: GlobalDiscount
): number {
  const allocation = globalDiscountAllocationCents(items, global)
  const key = lineKey(it)
  const lineCents = toCents(unitTtcAfterLineDiscount(it) * it.quantity)
  const netLineCents = lineCents - (allocation[key] ?? 0)

  const unit = fromCents(netLineCents) / it.quantity
  return round2(unit)
}

// TTC/HT/TVA calculés par ligne (centimes), TVA = TTC - HT
export function totalTTC(items: ProductInCart[], global: GlobalDiscount): number {
  const allocation = globalDiscountAllocationCents(items, global)

  const sumLines = items.reduce((s, it) => {
    const key = lineKey(it)
    const lineCents = toCents(unitTtcAfterLineDiscount(it) * it.quantity)
    const netLineCents = lineCents - (allocation[key] ?? 0)
    return s + netLineCents
  }, 0)

  return fromCents(sumLines)
}

export function totalHT(items: ProductInCart[], global: GlobalDiscount): number {
  const allocation = globalDiscountAllocationCents(items, global)

  const sumHtCents = items.reduce((s, it) => {
    const key = lineKey(it)
    const lineTtcCents = toCents(unitTtcAfterLineDiscount(it) * it.quantity)
    const netLineCents = lineTtcCents - (allocation[key] ?? 0)

    const tvaRate = it.tva ?? 20
    const lineHt = fromCents(netLineCents) / (1 + tvaRate / 100)
    return s + toCents(round2(lineHt)) // arrondi par ligne
  }, 0)

  return fromCents(sumHtCents)
}

export function totalTVA(items: ProductInCart[], global: GlobalDiscount): number {
  return round2(totalTTC(items, global) - totalHT(items, global))
}
