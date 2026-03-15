import { ref, type Ref } from 'vue'
import { extractFetchError } from '@/composables/useFetchError'
import { useToast } from '@/composables/useToast'
import type { Product as BaseProduct } from '@/types'

type ProductApi = Omit<BaseProduct, 'purchasePrice'> & {
  purchasePrice: number | null
  supplierCode?: string | null
  effectivePrice?: number
  effectivePurchasePrice?: number | null
  tvaId?: number | null
}

type ProductApiResponse = {
  success: boolean
  product: ProductApi
}

export function useProductEditor(
  productId: Ref<number>,
  selectedEstablishmentId: Ref<number | null>,
  goBack?: () => void
) {
  const toast = useToast()

  const originalProduct = ref<any>(null)
  const loading = ref(false)
  const loadingProduct = ref(true)

  const form = ref({
    name: '',
    description: '',
    supplierId: null as string | null,
    brandId: null as string | null,
    image: null as string | null,
    price: '',
    purchasePrice: '',
    tva: '20',
    tvaId: null as number | null,
    categoryId: null as string | null,
    hasVariations: false,
    variationGroupIds: [] as number[],
    minStock: 0,
    minStockByVariation: {} as Record<number, number>,
    supplierCode: '',
    barcode: '',
    barcodeByVariation: {} as Record<number, string>,
  })

  async function loadProduct() {
    try {
      loadingProduct.value = true
      const response = await $fetch<ProductApiResponse>(`/api/products/${productId.value}`, {
        params: selectedEstablishmentId.value ? { establishmentId: selectedEstablishmentId.value } : undefined,
      })

      if (response.success && response.product) {
        originalProduct.value = response.product
        const product = response.product

        form.value.name = product.name || ''
        form.value.description = product.description || ''
        form.value.supplierId = product.supplierId ? product.supplierId.toString() : null
        form.value.brandId = product.brandId ? product.brandId.toString() : null
        form.value.image = product.image || null
        const effectivePrice = product.effectivePrice ?? product.price
        const effectivePurchase = product.effectivePurchasePrice ?? product.purchasePrice
        form.value.price = effectivePrice?.toString() || ''
        form.value.purchasePrice = effectivePurchase?.toString() || ''
        form.value.tva = product.tva?.toString() || '20'
        form.value.tvaId = product.tvaId || null
        form.value.categoryId = product.categoryId ? product.categoryId.toString() : null
        form.value.hasVariations = !!product.variationGroupIds && product.variationGroupIds.length > 0
        form.value.variationGroupIds = (product.variationGroupIds || []).map((id) => Number(id))
        form.value.minStock = product.minStock || 0
        form.value.minStockByVariation = product.minStockByVariation || {}
        form.value.supplierCode = product.supplierCode || ''
        form.value.barcode = product.barcode || ''
        form.value.barcodeByVariation = product.barcodeByVariation || {}
      }
    } catch (error) {
      console.error('Erreur lors du chargement du produit:', error)
      toast.error('Erreur lors du chargement du produit')
      if (goBack) goBack()
    } finally {
      loadingProduct.value = false
    }
  }

  async function saveProduct(originalProductRef: Ref<any>) {
    if (!form.value.name.trim()) {
      toast.error('Le nom du produit est obligatoire')
      return
    }

    if (form.value.hasVariations && (!form.value.variationGroupIds || form.value.variationGroupIds.length === 0)) {
      toast.error('Sélectionnez au moins une variation')
      return
    }

    const selectedVariationIds = form.value.hasVariations ? form.value.variationGroupIds : []
    const stockByVariation = form.value.hasVariations
      ? Object.fromEntries(selectedVariationIds.map(id => [id, originalProductRef.value?.stockByVariation?.[id] ?? 0]))
      : null
    const minStockByVariation = form.value.hasVariations
      ? Object.fromEntries(selectedVariationIds.map(id => [id, form.value.minStockByVariation[id] ?? 0]))
      : null

    const targetEstablishmentId = selectedEstablishmentId.value
    const originalEffectivePrice = originalProductRef.value?.effectivePrice ?? originalProductRef.value?.price
    const originalEffectivePurchase = originalProductRef.value?.effectivePurchasePrice ?? originalProductRef.value?.purchasePrice
    const priceChanged = form.value.price !== (originalEffectivePrice?.toString() || '')
    const purchasePriceChanged = form.value.purchasePrice !== (originalEffectivePurchase?.toString() || '')

    if (!targetEstablishmentId && (priceChanged || purchasePriceChanged)) {
      toast.error('Sélectionnez un établissement pour modifier les prix locaux')
      return
    }

    loading.value = true
    try {
      const payload = {
        name: form.value.name,
        description: form.value.description || null,
        barcode: form.value.barcode || null,
        barcodeByVariation: form.value.hasVariations ? form.value.barcodeByVariation : null,
        supplierCode: form.value.supplierCode || null,
        price: parseFloat(form.value.price) || 0,
        purchasePrice: form.value.purchasePrice ? parseFloat(form.value.purchasePrice) : null,
        tva: parseFloat(form.value.tva),
        tvaId: form.value.tvaId,
        hasVariations: form.value.hasVariations,
        minStock: form.value.minStock,
        minStockByVariation,
        stockByVariation,
        variationGroupIds: form.value.hasVariations ? form.value.variationGroupIds : null,
        categoryId: form.value.categoryId ? parseInt(form.value.categoryId) : null,
        supplierId: form.value.supplierId ? parseInt(form.value.supplierId) : null,
        brandId: form.value.brandId ? parseInt(form.value.brandId) : null,
        image: form.value.image,
      }

      const response = await $fetch<{ success: boolean; product: ProductApi }>(`/api/products/${productId.value}`, {
        method: 'PUT',
        body: payload,
        params: targetEstablishmentId ? { establishmentId: targetEstablishmentId } : undefined,
      })

      if (response?.success) {
        toast.success('Produit mis à jour avec succès')
        if (goBack) goBack()
      }
    } catch (error: unknown) {
      console.error('Erreur lors de la mise à jour du produit:', error)
      toast.error(extractFetchError(error, 'Erreur lors de la mise à jour du produit'))
    } finally {
      loading.value = false
    }
  }

  function updateGeneralForm(updatedForm: any) {
    form.value.name = updatedForm.name
    form.value.description = updatedForm.description
    form.value.supplierId = updatedForm.supplierId
    form.value.brandId = updatedForm.brandId
    form.value.image = updatedForm.image
  }

  function updatePricingForm(updatedForm: any) {
    form.value.price = updatedForm.price
    form.value.purchasePrice = updatedForm.purchasePrice
    form.value.tva = updatedForm.tva
    form.value.tvaId = updatedForm.tvaId
    form.value.categoryId = updatedForm.categoryId
  }

  return {
    originalProduct,
    loading,
    loadingProduct,
    form,
    loadProduct,
    saveProduct,
    updateGeneralForm,
    updatePricingForm,
  }
}
