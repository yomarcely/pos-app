import { ref, watch, type Ref } from 'vue'
import type { Product, SelectedProduct, Variation, MovementType } from '@/types/mouvements'
import { normalizeProduct } from '@/utils/productHelpers'
import { extractFetchError } from '@/composables/useFetchError'
import { useToast } from '@/composables/useToast'

export function useMovementCart(
  movementType: Ref<MovementType>,
  allVariations: Ref<Variation[]>,
  onProductAdded?: () => void
) {
  const toast = useToast()
  const selectedProducts = ref<SelectedProduct[]>([])
  const comment = ref('')

  function hasVariations(product: Product): boolean {
    return !!(
      (product.variationGroupIds && product.variationGroupIds.length > 0) ||
      (product.stockByVariation && Object.keys(product.stockByVariation).length > 0)
    )
  }

  function getTotalStock(product: Product): number {
    if (product.stockByVariation && Object.keys(product.stockByVariation).length > 0) {
      return Object.values(product.stockByVariation).reduce((sum, qty) => sum + Number(qty || 0), 0)
    }
    return product.stock || 0
  }

  function getProductVariations(product: Product): Variation[] {
    const idsFromProduct = Array.isArray(product.variationGroupIds)
      ? product.variationGroupIds.map((id) => {
          const numericId = Number(id)
          return Number.isFinite(numericId) ? numericId : String(id)
        })
      : []
    const idsFromStock = product.stockByVariation
      ? Object.keys(product.stockByVariation).map((id) => {
          const numericId = Number(id)
          return Number.isFinite(numericId) ? numericId : id
        })
      : []
    const variationIds = idsFromProduct.length ? idsFromProduct : idsFromStock
    const uniqueIds = Array.from(new Set(variationIds))
    return uniqueIds.map((id) => {
      const numericId = typeof id === 'number' ? id : Number(id)
      const found = Number.isFinite(numericId)
        ? allVariations.value.find((v) => v.id === numericId)
        : undefined
      return found || { id, name: `Variation ${id}` }
    })
  }

  function addProductFromCatalog(product: Product) {
    const normalizedProduct = normalizeProduct(product)
    const exists = selectedProducts.value.find(p => p.product.id === normalizedProduct.id)
    if (exists) {
      toast.error('Ce produit est déjà dans la liste')
      return
    }
    if (hasVariations(normalizedProduct)) {
      const quantitiesByVariation: Record<string, number> = {}
      const variations = getProductVariations(normalizedProduct)
      variations.forEach(v => {
        const currentStock = normalizedProduct.stockByVariation?.[v.id.toString()] || 0
        quantitiesByVariation[v.id.toString()] = movementType.value === 'adjustment' ? currentStock : 0
      })
      selectedProducts.value.push({
        product: normalizedProduct,
        currentStock: getTotalStock(normalizedProduct),
        quantity: 0,
        quantitiesByVariation,
      })
    } else {
      selectedProducts.value.push({
        product: normalizedProduct,
        currentStock: normalizedProduct.stock || 0,
        quantity: movementType.value === 'adjustment' ? normalizedProduct.stock || 0 : 0,
      })
    }
    toast.success('Produit ajouté')
    onProductAdded?.()
  }

  function updateProductQuantity(productId: number, variationId: string | null, quantity: number) {
    const item = selectedProducts.value.find(p => p.product.id === productId)
    if (!item) return
    if (variationId && item.quantitiesByVariation) {
      item.quantitiesByVariation[variationId] = quantity
    } else {
      item.quantity = quantity
    }
  }

  function removeProduct(productId: number) {
    selectedProducts.value = selectedProducts.value.filter(item => item.product.id !== productId)
  }

  function clearAll() {
    selectedProducts.value = []
    comment.value = ''
  }

  async function validateMovement() {
    if (selectedProducts.value.length === 0) {
      toast.error('Aucun produit sélectionné')
      return
    }
    try {
      let type: 'reception' | 'adjustment' | 'loss' | 'transfer'
      let adjustmentType: 'add' | 'set' = 'add'
      if (movementType.value === 'entry') {
        type = 'reception'
        adjustmentType = 'add'
      } else if (movementType.value === 'adjustment') {
        type = 'adjustment'
        adjustmentType = 'set'
      } else {
        type = 'loss'
        adjustmentType = 'add'
      }
      const items: any[] = []
      for (const item of selectedProducts.value) {
        if (hasVariations(item.product) && item.quantitiesByVariation) {
          for (const [varId, quantity] of Object.entries(item.quantitiesByVariation)) {
            if (quantity === null || quantity === undefined) continue
            if (movementType.value !== 'adjustment' && quantity === 0) continue
            let finalQuantity = quantity
            if (movementType.value === 'loss') finalQuantity = -Math.abs(quantity)
            items.push({ productId: item.product.id, variation: varId, quantity: finalQuantity, adjustmentType })
          }
        } else {
          if (!item.quantity && item.quantity !== 0) continue
          if (movementType.value !== 'adjustment' && item.quantity === 0) continue
          let finalQuantity = item.quantity
          if (movementType.value === 'loss') finalQuantity = -Math.abs(finalQuantity)
          items.push({ productId: item.product.id, quantity: finalQuantity, adjustmentType })
        }
      }
      if (items.length === 0) {
        toast.error('Aucune quantité à traiter')
        return
      }
      const response = await $fetch<{ success: boolean; movement: { id: number; movementNumber: string } }>('/api/movements/create', {
        method: 'POST',
        body: { type, comment: comment.value || undefined, items },
      })
      toast.success(`Mouvement ${response.movement.movementNumber} créé avec succès`)
      clearAll()
    } catch (error: unknown) {
      console.error("Erreur lors de l'enregistrement:", error)
      toast.error(extractFetchError(error, "Erreur lors de l'enregistrement"))
    }
  }

  watch(movementType, (newType) => {
    selectedProducts.value = selectedProducts.value.map((item) => {
      if (hasVariations(item.product) && item.quantitiesByVariation) {
        const updatedQuantities: Record<string, number> = { ...item.quantitiesByVariation }
        const variations = getProductVariations(item.product)
        variations.forEach((variation) => {
          const key = variation.id.toString()
          if (newType === 'adjustment') {
            updatedQuantities[key] = item.product.stockByVariation?.[key] ?? 0
          } else {
            updatedQuantities[key] = 0
          }
        })
        return { ...item, quantity: 0, currentStock: getTotalStock(item.product), quantitiesByVariation: updatedQuantities }
      }
      return { ...item, quantity: newType === 'adjustment' ? item.currentStock : 0 }
    })
  })

  return { selectedProducts, comment, addProductFromCatalog, updateProductQuantity, removeProduct, clearAll, validateMovement }
}
