interface VariationPayloadInput {
  hasVariations?: unknown
  variationGroupIds?: unknown
  stockByVariation?: unknown
  minStockByVariation?: unknown
}

interface NormalizedVariationPayload {
  variationGroupIds: number[] | null
  stockByVariation: Record<string, number> | null
  minStockByVariation: Record<string, number> | null
}

function normalizeVariationMap(
  value: unknown,
  fieldName: 'stockByVariation' | 'minStockByVariation',
  expectedKeys: Set<string>,
  enforceKeys: boolean,
  errors: string[],
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${fieldName} doit être un objet non vide contenant les variations déclarées`)
    return null
  }

  const entries = Object.entries(value as Record<string, unknown>)
  if (!entries.length) {
    errors.push(`${fieldName} doit être un objet non vide contenant les variations déclarées`)
    return null
  }

  const normalized: Record<string, number> = {}

  for (const [key, raw] of entries) {
    if (enforceKeys && !expectedKeys.has(key)) {
      errors.push(`${fieldName} contient une clé inattendue (${key})`)
      continue
    }

    if (typeof raw !== 'number' && typeof raw !== 'string') {
      errors.push(`${fieldName}.${key} doit être un nombre`)
      continue
    }

    const parsed = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(parsed)) {
      errors.push(`${fieldName}.${key} doit être un nombre valide`)
      continue
    }

    normalized[key] = parsed
  }

  if (enforceKeys) {
    for (const key of expectedKeys) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(`${fieldName} doit contenir une entrée pour la variation ${key}`)
      }
    }
  }

  return normalized
}

function buildBadRequest(errors: string[]) {
  const error: any = new Error('Payload variations invalide')
  error.statusCode = 400
  error.statusMessage = 'Payload variations invalide'
  error.data = { errors }
  return error
}

export function validateVariationPayload(payload: VariationPayloadInput): NormalizedVariationPayload {
  if (!payload.hasVariations) {
    return {
      variationGroupIds: null,
      stockByVariation: null,
      minStockByVariation: null,
    }
  }

  const errors: string[] = []

  const variationIds = Array.isArray(payload.variationGroupIds)
    ? payload.variationGroupIds.map((id) => Number(id))
    : []

  const hasValidVariationIds =
    Array.isArray(payload.variationGroupIds) &&
    variationIds.length > 0 &&
    variationIds.every((id) => Number.isInteger(id) && id > 0)

  if (!hasValidVariationIds) {
    errors.push("variationGroupIds doit être un tableau non vide d'identifiants numériques")
  }

  const expectedKeys = new Set(variationIds.map((id) => id.toString()))
  const stockByVariation = normalizeVariationMap(
    payload.stockByVariation,
    'stockByVariation',
    expectedKeys,
    hasValidVariationIds,
    errors,
  )
  const minStockByVariation = normalizeVariationMap(
    payload.minStockByVariation,
    'minStockByVariation',
    expectedKeys,
    hasValidVariationIds,
    errors,
  )

  if (errors.length) {
    throw buildBadRequest(errors)
  }

  return {
    variationGroupIds: variationIds,
    stockByVariation,
    minStockByVariation,
  }
}
