import { ref, type Ref } from 'vue'
import type { Product, Variation } from '@/types/mouvements'
import { extractFetchError } from '@/composables/useFetchError'
import { useToast } from '@/composables/useToast'
import { hasVariations as productHasVariations, normalizeProduct } from '@/utils/productHelpers'

export interface InventoryPreparationLine {
  productId: number
  productName: string
  productImage?: string | null
  variation: string | null
  variationName: string | null
  currentStock: number
  countedStock: number
}

function lineKey(productId: number, variation: string | null): string {
  return `${productId}|${variation ?? ''}`
}

function variationNameFor(variationId: string, allVariations: Variation[]): string | null {
  const numericId = Number(variationId)
  const v = allVariations.find((x) => Number(x.id) === numericId)
  return v?.name ?? variationId
}

export function useInventoryPreparation(
  allVariations: Ref<Variation[]>,
  establishmentId: Ref<number | null>,
) {
  const toast = useToast()
  const name = ref('')
  const comment = ref('')
  const lines = ref<Map<string, InventoryPreparationLine>>(new Map())

  function _addProduct(product: Product) {
    const normalized = normalizeProduct(product)
    const productHasVar = productHasVariations(normalized)

    if (productHasVar && normalized.stockByVariation) {
      // Une ligne par variation déclarée dans stockByVariation
      // (couvre les cas où certaines variations ont stock=0 mais existent)
      const variationIds = Array.isArray(normalized.variationGroupIds)
        ? normalized.variationGroupIds.map((id) => String(id))
        : Object.keys(normalized.stockByVariation)

      for (const varId of variationIds) {
        const key = lineKey(normalized.id, varId)
        if (lines.value.has(key)) continue
        const currentStock = normalized.stockByVariation[varId] ?? 0
        lines.value.set(key, {
          productId: normalized.id,
          productName: normalized.name,
          productImage: normalized.image ?? null,
          variation: varId,
          variationName: variationNameFor(varId, allVariations.value),
          currentStock,
          countedStock: currentStock,
        })
      }
    } else {
      const key = lineKey(normalized.id, null)
      if (lines.value.has(key)) return
      const currentStock = normalized.stock || 0
      lines.value.set(key, {
        productId: normalized.id,
        productName: normalized.name,
        productImage: normalized.image ?? null,
        variation: null,
        variationName: null,
        currentStock,
        countedStock: currentStock,
      })
    }
  }

  function addProductFromCatalog(product: Product) {
    const before = lines.value.size
    _addProduct(product)
    if (lines.value.size === before) {
      toast.error('Ce produit est déjà dans la préparation')
      return
    }
    toast.success('Produit ajouté')
  }

  async function addAllFromCategory(categoryId: number): Promise<number> {
    try {
      const params: Record<string, string | number> = { categoryId, limit: 500 }
      if (establishmentId.value) params.establishmentId = establishmentId.value
      const response = await $fetch<{ products: Product[]; count: number }>('/api/products', { params })
      const beforeCount = lines.value.size
      for (const p of response.products) _addProduct(p)
      const added = lines.value.size - beforeCount
      if (added === 0) {
        toast.error('Aucun nouveau produit ajouté pour cette catégorie')
      } else {
        toast.success(`${added} ligne(s) ajoutée(s)`)
      }
      return added
    } catch (error) {
      toast.error(extractFetchError(error, 'Erreur lors du chargement de la catégorie'))
      return 0
    }
  }

  function updateCountedStock(key: string, value: number) {
    const line = lines.value.get(key)
    if (!line) return
    line.countedStock = value
  }

  function removeLine(key: string) {
    lines.value.delete(key)
    // Trigger reactivity (Map mutations ne sont pas réactives en deep mode)
    lines.value = new Map(lines.value)
  }

  function clearAll() {
    name.value = ''
    comment.value = ''
    lines.value = new Map()
  }

  async function validate(): Promise<boolean> {
    if (lines.value.size === 0) {
      toast.error('Aucun produit à inventorier')
      return false
    }
    try {
      const items = Array.from(lines.value.values()).map((l) => ({
        productId: l.productId,
        variation: l.variation,
        countedStock: Number(l.countedStock) || 0,
      }))
      const response = await $fetch<{
        success: boolean
        preparation: { id: number; preparationNumber: string }
        itemCount: number
      }>('/api/inventory-preparations', {
        method: 'POST',
        body: {
          name: name.value.trim() || null,
          comment: comment.value.trim() || null,
          establishmentId: establishmentId.value ?? null,
          items,
        },
      })
      toast.success(`Préparation ${response.preparation.preparationNumber} créée`)
      clearAll()
      return true
    } catch (error) {
      toast.error(extractFetchError(error, 'Erreur lors de la validation de la préparation'))
      return false
    }
  }

  return {
    name,
    comment,
    lines,
    addProductFromCatalog,
    addAllFromCategory,
    updateCountedStock,
    removeLine,
    clearAll,
    validate,
  }
}
