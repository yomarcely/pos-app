import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useMovementCatalog } from '@/composables/useMovementCatalog'
import { useMovementCart } from '@/composables/useMovementCart'
import { useMovementProductSearch } from '@/composables/useMovementProductSearch'

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() })
}))

const fetchMock = vi.fn()

describe('useMovementCatalog', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockReset()
  })

  it('loadCatalogProducts() appelle GET /api/products', async () => {
    fetchMock.mockResolvedValueOnce({ products: [], count: 0 })
    const { loadCatalogProducts } = useMovementCatalog(ref(null))
    await loadCatalogProducts()
    expect(fetchMock).toHaveBeenCalledWith('/api/products', expect.anything())
  })

  it('loadCategories() appelle GET /api/categories', async () => {
    fetchMock.mockResolvedValueOnce({ categories: [] })
    const { loadCategories } = useMovementCatalog(ref(null))
    await loadCategories()
    expect(fetchMock).toHaveBeenCalledWith('/api/categories', expect.anything())
  })
})

describe('useMovementCart', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockReset()
  })

  it('validateMovement() appelle POST /api/movements/create', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, movement: { id: 1, movementNumber: 'MOV001' } })
    const movementType = ref<any>('entry')
    const allVariations = ref<any[]>([])
    const { selectedProducts, addProductFromCatalog, validateMovement } = useMovementCart(movementType, allVariations)
    // Add a simple product without variations
    selectedProducts.value = [{
      product: { id: 1, name: 'Test', stock: 5, variationGroupIds: [], stockByVariation: {}, price: 10, tva: 20, image: null },
      currentStock: 5,
      quantity: 3,
    }]
    await validateMovement()
    expect(fetchMock).toHaveBeenCalledWith('/api/movements/create', expect.objectContaining({ method: 'POST' }))
  })

  it('removeProduct() retire le produit de selectedProducts', () => {
    const movementType = ref<any>('entry')
    const allVariations = ref<any[]>([])
    const { selectedProducts, removeProduct } = useMovementCart(movementType, allVariations)
    selectedProducts.value = [{
      product: { id: 1, name: 'Test', stock: 5, variationGroupIds: [], stockByVariation: {}, price: 10, tva: 20, image: null },
      currentStock: 5,
      quantity: 1,
    }]
    removeProduct(1)
    expect(selectedProducts.value).toHaveLength(0)
  })

  it('clearAll() vide selectedProducts et remet comment à vide', () => {
    const movementType = ref<any>('entry')
    const allVariations = ref<any[]>([])
    const { selectedProducts, comment, clearAll } = useMovementCart(movementType, allVariations)
    selectedProducts.value = [{ product: { id: 1, name: 'Test', stock: 5, variationGroupIds: [], stockByVariation: {}, price: 10, tva: 20, image: null }, currentStock: 5, quantity: 1 }]
    comment.value = 'Test comment'
    clearAll()
    expect(selectedProducts.value).toHaveLength(0)
    expect(comment.value).toBe('')
  })
})

describe('useMovementProductSearch', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockReset()
  })

  it('searchProduct() appelle GET /api/products avec search=', async () => {
    fetchMock.mockResolvedValueOnce({ products: [], count: 0 })
    const onProductSelected = vi.fn()
    const onOpenCatalog = vi.fn()
    const { searchQuery, searchProduct } = useMovementProductSearch(ref(null), onProductSelected, onOpenCatalog)
    searchQuery.value = 'test produit'
    await searchProduct()
    expect(fetchMock).toHaveBeenCalledWith('/api/products', expect.objectContaining({ params: expect.objectContaining({ search: 'test produit' }) }))
  })
})
