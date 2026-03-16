import { ref, watch, type Ref } from 'vue'
import type { Product } from '@/types/mouvements'
import { normalizeProduct } from '@/utils/productHelpers'
import { useToast } from '@/composables/useToast'

export function useMovementProductSearch(
  establishmentId: Ref<number | null>,
  onProductSelected: (product: Product) => void,
  onOpenCatalog: (products?: Product[]) => void
) {
  const toast = useToast()
  const searchQuery = ref('')
  const searchSuggestions = ref<Product[]>([])

  let searchTimeout: ReturnType<typeof setTimeout>

  watch(searchQuery, () => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(async () => {
      if (searchQuery.value.trim().length < 2) {
        searchSuggestions.value = []
        return
      }
      try {
        const response = await $fetch<{ products: Product[]; count: number }>('/api/products', {
          params: {
            search: searchQuery.value.trim(),
            ...(establishmentId.value ? { establishmentId: establishmentId.value } : {})
          }
        })
        searchSuggestions.value = response.products.map(normalizeProduct)
      } catch (error) {
        console.error('Erreur lors de la recherche:', error)
      }
    }, 300)
  })

  function handleSearchFocus() {
    if (searchQuery.value.trim().length >= 2 && searchSuggestions.value.length > 0) {
      // Keep suggestions visible
    }
  }

  function selectFirstSuggestion() {
    if (searchSuggestions.value.length > 0) {
      const product = searchSuggestions.value[0]
      if (product) selectProductFromSuggestion(product)
    }
  }

  function selectProductFromSuggestion(product: any) {
    onProductSelected(normalizeProduct(product))
    searchQuery.value = ''
    searchSuggestions.value = []
  }

  async function searchProduct() {
    if (!searchQuery.value.trim()) return
    try {
      const response = await $fetch<{ products: Product[]; count: number }>('/api/products', {
        params: { search: searchQuery.value.trim() }
      })
      const products = response.products.map(normalizeProduct)
      if (products.length === 0) {
        toast.error('Aucun produit trouvé')
        return
      }
      if (products.length === 1 && products[0]) {
        onProductSelected(products[0])
        searchQuery.value = ''
      } else {
        onOpenCatalog(products)
      }
    } catch (error) {
      console.error('Erreur lors de la recherche:', error)
      toast.error('Erreur lors de la recherche')
    }
  }

  return { searchQuery, searchSuggestions, handleSearchFocus, selectFirstSuggestion, selectProductFromSuggestion, searchProduct }
}
