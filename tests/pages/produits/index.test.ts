import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductsPage from '@/pages/produits/index.vue'
import { ref as vueRef, onMounted as vueOnMounted } from 'vue'

// Stubs minimalistes
const ButtonStub = { template: '<button @click="$emit(\'click\')"><slot /></button>' }
const SimpleStub = { template: '<div><slot /></div>' }
const ProductsSearchBarStub = { template: '<div class="search-bar"></div>' }
const ProductsTableViewStub = { template: '<div class="table-view"></div>' }
const ProductsGridViewStub = { template: '<div class="grid-view"></div>' }
const ProductsEmptyStateStub = { template: '<div class="empty-state"></div>' }
const LoadingSpinnerStub = { template: '<div class="loading"></div>' }
const PlusStub = { template: '<span />' }
const ClientOnlyStub = { template: '<div><slot /></div>' }

const toastMock = {
  error: vi.fn(),
  success: vi.fn()
}

vi.mock('@/composables/useToast', () => ({
  useToast: () => toastMock
}))

const navigateToMock = vi.fn()
vi.stubGlobal('navigateTo', navigateToMock)

describe('Page produits', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.stubGlobal('navigateTo', navigateToMock)
    vi.stubGlobal('definePageMeta', vi.fn())
    vi.stubGlobal('ref', vueRef)
    vi.stubGlobal('onMounted', vueOnMounted)
    toastMock.error.mockClear()
    toastMock.success.mockClear()
  })

  it('charge produits et catégories au montage, affiche la grille', async () => {
    vi.stubGlobal('$fetch', vi.fn()
      .mockResolvedValueOnce({ categories: [{ id: 1, name: 'Cat 1', children: [] }] }) // loadCategories
      .mockResolvedValueOnce({ products: [{ id: 1, name: 'P1', price: 10, tva: 20, stock: 1, image: null, description: '', categoryName: null, barcode: '' }], count: 1 }) // loadProducts
    )

    const wrapper = mount(ProductsPage, {
      global: {
        config: {
          globalProperties: { navigateTo: navigateToMock }
        },
        stubs: {
          Button: ButtonStub,
          ProductsSearchBar: ProductsSearchBarStub,
          ProductsTableView: ProductsTableViewStub,
          ProductsGridView: ProductsGridViewStub,
          ProductsEmptyState: ProductsEmptyStateStub,
          LoadingSpinner: LoadingSpinnerStub,
          Plus: PlusStub,
          clientOnly: ClientOnlyStub
        }
      }
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Catalogue produits')
      expect(wrapper.find('.grid-view').exists()).toBe(true)
    })
  })

  it('navigate vers création lors du clic bouton', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ categories: [], products: [], count: 0 }))
    const wrapper = mount(ProductsPage, {
      global: {
        config: {
          globalProperties: { navigateTo: navigateToMock }
        },
        stubs: {
          Button: ButtonStub,
          ProductsSearchBar: ProductsSearchBarStub,
          ProductsTableView: ProductsTableViewStub,
          ProductsGridView: ProductsGridViewStub,
          ProductsEmptyState: ProductsEmptyStateStub,
          LoadingSpinner: LoadingSpinnerStub,
          Plus: PlusStub,
          clientOnly: ClientOnlyStub
        }
      }
    })

    await wrapper.find('button').trigger('click')
    expect(navigateToMock).toHaveBeenCalledWith('/produits/create')
  })
})
