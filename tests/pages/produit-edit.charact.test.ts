import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useProductEditor } from '@/composables/useProductEditor'
import { useProductCatalogData } from '@/composables/useProductCatalogData'
import { useProductStockMovement } from '@/composables/useProductStockMovement'

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() })
}))

vi.mock('@/composables/useEstablishmentRegister', () => ({
  useEstablishmentRegister: () => ({
    selectedEstablishmentId: ref(null),
    initialize: vi.fn(),
  })
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const fetchMock = vi.fn()

describe('useProductEditor', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockReset()
  })

  it('loadProduct() appelle GET /api/products/:id', async () => {
    fetchMock.mockResolvedValue({ success: true, product: { id: 1, name: 'Test', price: 10, tva: 20, variationGroupIds: [] } })
    const productId = ref(1)
    const selectedEstablishmentId = ref<number | null>(null)
    const { loadProduct } = useProductEditor(productId, selectedEstablishmentId)
    await loadProduct()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/products/1',
      expect.anything()
    )
  })
})

describe('useProductCatalogData', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockReset()
  })

  it('saveNewSupplier() appelle POST /api/suppliers/create', async () => {
    fetchMock.mockResolvedValue({ id: 1, name: 'Mon fournisseur' })
    const selectedEstablishmentId = ref<number | null>(null)
    const form = ref({ supplierId: null as string | null, brandId: null as string | null })
    const { saveNewSupplier } = useProductCatalogData(selectedEstablishmentId, form)
    await saveNewSupplier('Mon fournisseur')
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/suppliers/create',
      expect.objectContaining({ method: 'POST' })
    )
  })
})

describe('useProductStockMovement', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', fetchMock)
    fetchMock.mockReset()
  })

  it('submitStockMovement() appelle POST /api/movements/create', async () => {
    fetchMock.mockResolvedValue({})
    const productId = ref(1)
    const form = ref({ hasVariations: false })
    const selectedVariationsList = ref<any[]>([])
    const originalProduct = ref<any>({ stock: 5 })
    const loadProduct = vi.fn()
    const { submitStockMovement, movementQuantities } = useProductStockMovement(productId, form, selectedVariationsList, originalProduct, loadProduct)
    movementQuantities.value = { base: 10 }
    await submitStockMovement()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/movements/create',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('getStockByVariation(id) retourne la bonne valeur', () => {
    const productId = ref(1)
    const form = ref({ hasVariations: true })
    const selectedVariationsList = ref<any[]>([])
    const originalProduct = ref<any>({ stockByVariation: { 5: 42 } })
    const loadProduct = vi.fn()
    const { getStockByVariation } = useProductStockMovement(productId, form, selectedVariationsList, originalProduct, loadProduct)
    expect(getStockByVariation(5)).toBe(42)
    expect(getStockByVariation(99)).toBe(0)
  })
})
