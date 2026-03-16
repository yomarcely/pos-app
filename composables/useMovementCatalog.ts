import { ref, watch, type Ref } from 'vue'
import type { Product, Category, Supplier, Brand, Variation } from '@/types/mouvements'
import { normalizeProduct } from '@/utils/productHelpers'

export function useMovementCatalog(establishmentId: Ref<number | null>) {
  const isProductSelectorOpen = ref(false)
  const catalogSearchQuery = ref('')
  const selectedCategoryFilter = ref<number | null>(null)
  const selectedSupplierFilter = ref<number | null>(null)
  const selectedBrandFilter = ref<number | null>(null)
  const catalogProducts = ref<Product[]>([])
  const loadingCatalog = ref(false)
  const categories = ref<Category[]>([])
  const suppliers = ref<Supplier[]>([])
  const brands = ref<Brand[]>([])
  const allVariations = ref<Variation[]>([])

  let searchTimeout: ReturnType<typeof setTimeout>

  function openProductSelector() {
    isProductSelectorOpen.value = true
    loadCatalogProducts()
  }

  async function loadCatalogProducts() {
    try {
      loadingCatalog.value = true
      const params: Record<string, string | number> = {}
      if (catalogSearchQuery.value) params.search = catalogSearchQuery.value
      if (selectedCategoryFilter.value) params.categoryId = selectedCategoryFilter.value
      if (selectedSupplierFilter.value) params.supplierId = selectedSupplierFilter.value
      if (selectedBrandFilter.value) params.brandId = selectedBrandFilter.value
      if (establishmentId.value) params.establishmentId = establishmentId.value
      const response = await $fetch<{ products: Product[]; count: number }>('/api/products', { params })
      catalogProducts.value = response.products.map(normalizeProduct)
    } catch (error) {
      console.error('Erreur lors du chargement du catalogue:', error)
    } finally {
      loadingCatalog.value = false
    }
  }

  async function loadCategories() {
    try {
      const response = await $fetch<{ categories: any[] }>('/api/categories', {
        params: establishmentId.value ? { establishmentId: establishmentId.value } : undefined,
      })
      const flattenCategories = (cats: any[], level = 0): Category[] => {
        let result: Category[] = []
        for (const cat of cats) {
          result.push({ id: cat.id, name: '  '.repeat(level) + cat.name })
          if (cat.children && cat.children.length > 0) {
            result = result.concat(flattenCategories(cat.children, level + 1))
          }
        }
        return result
      }
      categories.value = flattenCategories(response.categories)
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error)
    }
  }

  async function loadSuppliers() {
    try {
      const response = await $fetch<Supplier[]>('/api/suppliers')
      suppliers.value = response
    } catch (error) {
      console.error('Erreur lors du chargement des fournisseurs:', error)
    }
  }

  async function loadBrands() {
    try {
      const response = await $fetch<any>('/api/brands')
      brands.value = Array.isArray(response) ? response : []
    } catch (error) {
      console.error('Erreur lors du chargement des marques:', error)
    }
  }

  async function loadVariations() {
    try {
      const response = await $fetch<{ success: boolean; groups: Array<{ id: number; name: string; variations: Variation[] }> }>('/api/variations/groups', {
        params: establishmentId.value ? { establishmentId: establishmentId.value } : undefined,
      })
      const flatVariations: Variation[] = []
      for (const group of response.groups) {
        for (const variation of group.variations) {
          flatVariations.push({ id: variation.id, name: variation.name })
        }
      }
      allVariations.value = flatVariations
    } catch (error) {
      console.error('Erreur lors du chargement des variations:', error)
    }
  }

  watch(catalogSearchQuery, () => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      loadCatalogProducts()
    }, 300)
  })

  watch([selectedCategoryFilter, selectedSupplierFilter, selectedBrandFilter], () => {
    loadCatalogProducts()
  })

  return {
    isProductSelectorOpen,
    catalogSearchQuery,
    selectedCategoryFilter,
    selectedSupplierFilter,
    selectedBrandFilter,
    catalogProducts,
    loadingCatalog,
    categories,
    suppliers,
    brands,
    allVariations,
    openProductSelector,
    loadCatalogProducts,
    loadCategories,
    loadSuppliers,
    loadBrands,
    loadVariations,
  }
}
