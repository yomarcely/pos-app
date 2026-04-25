import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
import ColRight from '@/components/caisse/ColRight.vue'

// Stubs UI
const InputStub = {
  props: ['modelValue'],
  template: `<input v-bind="$attrs" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />`
}
const ButtonStub = { template: `<button @click="$emit('click', $event)" :disabled="disabled"><slot /></button>`, props: ['disabled'] }
const IconStub = { template: '<span />' }
const SimpleStub = { template: '<div><slot /></div>' }

// Mocks stores
const cartStoreMock = {
  items: [] as any[],
  globalDiscount: 0,
  globalDiscountType: '%',
  getFinalPrice: vi.fn((item) => item.price),
  clearCart: vi.fn(),
  totalTTC: ref(0),
  totalHT: ref(0),
  totalTVA: ref(0),
  checkDayClosure: vi.fn().mockResolvedValue(false),
  applyGlobalDiscountToItems: vi.fn(),
  validateStock: vi.fn(() => ({ valid: true, errors: [] as string[] })),
  submitSale: vi.fn(async (_payload: unknown) => ({
    success: true,
    sale: {
      id: 1,
      ticketNumber: 'T-001',
      hash: 'abc123def456',
      signature: 'TEMP_SIG_xyz',
      saleDate: new Date('2026-04-25T10:00:00Z'),
    },
  })),
}

const productsStoreMock = {
  loaded: true,
  loadProducts: vi.fn()
}

const customerStoreMock = {
  client: null as any,
  clientName: '',
  clearClient: vi.fn()
}

const sellersStoreMock = {
  sellers: [{ id: 1, name: 'Seller 1' }],
  selectedSeller: '',
}

const selectedRegister = ref<{ id: number, name: string } | null>(null)
const selectedEstablishmentDetail = ref<{ id: number, name: string } | null>(null)

const toastMock = {
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  success: vi.fn()
}

const selectedRegisterId = ref<number | null>(null)

vi.mock('@/stores/cart', () => ({
  useCartStore: () => cartStoreMock
}))
vi.mock('@/stores/products', () => ({
  useProductsStore: () => productsStoreMock
}))
vi.mock('@/stores/customer', () => ({
  useCustomerStore: () => customerStoreMock
}))
vi.mock('@/stores/sellers', () => ({
  useSellersStore: () => sellersStoreMock
}))
vi.mock('@/stores/variationGroups', () => ({
  useVariationGroupsStore: () => ({ groups: [] })
}))
vi.mock('@/composables/useToast', () => ({
  useToast: () => toastMock
}))
vi.mock('@/composables/useFetchError', () => ({
  extractFetchError: (err: unknown, fallback: string) => fallback
}))
vi.mock('@/composables/useEstablishmentRegister', () => ({
  useEstablishmentRegister: () => ({
    selectedRegisterId,
    selectedRegister,
    selectedEstablishmentDetail,
    initialize: vi.fn().mockResolvedValue(undefined)
  })
}))

describe('ColRight (caisse)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    cartStoreMock.items = []
    cartStoreMock.globalDiscount = 0
    cartStoreMock.globalDiscountType = '%'
    cartStoreMock.totalTTC = ref(20)
    cartStoreMock.totalHT = ref(16.67)
    cartStoreMock.totalTVA = ref(3.33)
    sellersStoreMock.selectedSeller = ''
    customerStoreMock.client = null
    toastMock.error.mockClear()
    toastMock.warning.mockClear()
    toastMock.info.mockClear()
    toastMock.success.mockClear()
    productsStoreMock.loaded = true
    productsStoreMock.loadProducts.mockClear()
    cartStoreMock.clearCart.mockClear()
    cartStoreMock.checkDayClosure.mockClear()
    cartStoreMock.checkDayClosure.mockResolvedValue(false)
    cartStoreMock.submitSale.mockClear()
    cartStoreMock.validateStock.mockClear()
    cartStoreMock.validateStock.mockReturnValue({ valid: true, errors: [] })
    customerStoreMock.clearClient.mockClear()
    selectedRegisterId.value = null
    selectedRegister.value = null
    selectedEstablishmentDetail.value = null
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function mountComponent() {
    return mount(ColRight, {
      global: {
        stubs: {
          Input: InputStub,
          Button: ButtonStub,
          X: IconStub,
          Banknote: IconStub,
          CreditCard: IconStub,
          Printer: IconStub,
          Lock: IconStub,
          Spinner: SimpleStub
        }
      }
    })
  }

  it('ajoute un paiement et calcule le solde', async () => {
    const wrapper = mountComponent()
    const buttons = wrapper.findAll('button')
    await buttons[0]!.trigger('click') // ajoute Espèces
    expect(wrapper.text()).toContain('Espèces')
  })

  it('bloque la validation si panier vide ou pas de paiement', async () => {
    const wrapper = mountComponent()
    await (wrapper.vm as any).validerVente()
    expect(toastMock.error).toHaveBeenCalledWith('Le panier est vide')
  })

  it('affiche journée clôturée si checkDayClosure retourne true', async () => {
    // Set a register so checkClosure actually fires
    selectedRegisterId.value = 1
    cartStoreMock.checkDayClosure.mockResolvedValue(true)

    const wrapper = mountComponent()
    // Wait for onMounted async check
    await new Promise(resolve => setTimeout(resolve, 50))
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Journée clôturée')
  })

  // ===========================================
  // Tests caractérisation — flow validerVente
  // ===========================================

  /**
   * Helper : prépare un état "happy path" complet pour validerVente.
   */
  function setupHappyPath() {
    cartStoreMock.items = [
      { id: 10, name: 'Produit A', price: 20, quantity: 1, discount: 0, discountType: '%', tva: 20, variation: null, restockOnReturn: false },
    ]
    sellersStoreMock.selectedSeller = '1'
    selectedEstablishmentDetail.value = { id: 5, name: 'Boutique principale' }
    selectedRegister.value = { id: 7, name: 'Caisse 1' }
  }

  it('addPayment refuse un mode déjà sélectionné', async () => {
    const wrapper = mountComponent()
    await (wrapper.vm as any).addPayment('Espèces')
    await (wrapper.vm as any).addPayment('Espèces')
    expect((wrapper.vm as any).payments).toHaveLength(1)
  })

  it('addPayment refuse si totalTTC=0 (échange)', async () => {
    cartStoreMock.totalTTC = ref(0)
    const wrapper = mountComponent()
    await (wrapper.vm as any).addPayment('Espèces')
    expect((wrapper.vm as any).payments).toHaveLength(0)
  })

  it('addPayment calcule le montant initial = balance restante', async () => {
    cartStoreMock.totalTTC = ref(50)
    const wrapper = mountComponent()
    await (wrapper.vm as any).addPayment('Espèces')
    expect((wrapper.vm as any).payments[0]).toEqual({ mode: 'Espèces', amount: 50 })
  })

  it('addPayment d\'un 2e mode utilise la balance restante', async () => {
    cartStoreMock.totalTTC = ref(50)
    const wrapper = mountComponent()
    await (wrapper.vm as any).addPayment('Espèces')
    ;(wrapper.vm as any).payments[0].amount = 30
    await wrapper.vm.$nextTick()
    await (wrapper.vm as any).addPayment('Carte')
    expect((wrapper.vm as any).payments[1]).toEqual({ mode: 'Carte', amount: 20 })
  })

  it('removePayment retire le paiement spécifié', async () => {
    cartStoreMock.totalTTC = ref(50)
    const wrapper = mountComponent()
    await (wrapper.vm as any).addPayment('Espèces')
    ;(wrapper.vm as any).payments[0].amount = 30
    await wrapper.vm.$nextTick()
    await (wrapper.vm as any).addPayment('Carte')
    await (wrapper.vm as any).removePayment('Espèces')
    expect((wrapper.vm as any).payments).toHaveLength(1)
    expect((wrapper.vm as any).payments[0].mode).toBe('Carte')
  })

  it('validerVente — erreur si journée clôturée', async () => {
    setupHappyPath()
    selectedRegisterId.value = 7
    cartStoreMock.checkDayClosure.mockResolvedValue(true)

    const wrapper = mountComponent()
    await new Promise(r => setTimeout(r, 50))
    await wrapper.vm.$nextTick()

    await (wrapper.vm as any).validerVente()
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining('clôturée'))
    expect(cartStoreMock.submitSale).not.toHaveBeenCalled()
  })

  it('validerVente — erreur si pas de paiement et totalTTC>0', async () => {
    setupHappyPath()
    const wrapper = mountComponent()
    await (wrapper.vm as any).validerVente()
    expect(toastMock.error).toHaveBeenCalledWith('Aucun mode de paiement sélectionné')
    expect(cartStoreMock.submitSale).not.toHaveBeenCalled()
  })

  it('validerVente — erreur si balance positive (sous-payé)', async () => {
    setupHappyPath()
    cartStoreMock.totalTTC = ref(50)
    const wrapper = mountComponent()
    await (wrapper.vm as any).addPayment('Espèces')
    ;(wrapper.vm as any).payments[0].amount = 30
    await wrapper.vm.$nextTick()
    await (wrapper.vm as any).validerVente()
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining('reste'))
    expect(cartStoreMock.submitSale).not.toHaveBeenCalled()
  })

  it('validerVente — erreur si remboursement insuffisant (totalTTC<0, balance<0)', async () => {
    setupHappyPath()
    cartStoreMock.totalTTC = ref(-50)
    const wrapper = mountComponent()
    await (wrapper.vm as any).addPayment('Espèces')
    ;(wrapper.vm as any).payments[0].amount = -30
    await wrapper.vm.$nextTick()
    await (wrapper.vm as any).validerVente()
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining('rembourser'))
    expect(cartStoreMock.submitSale).not.toHaveBeenCalled()
  })

  it('validerVente — warning si pas de vendeur sélectionné', async () => {
    setupHappyPath()
    sellersStoreMock.selectedSeller = ''
    const wrapper = mountComponent()
    await (wrapper.vm as any).addPayment('Espèces')
    await (wrapper.vm as any).validerVente()
    expect(toastMock.warning).toHaveBeenCalledWith(expect.stringContaining('vendeur'))
    expect(cartStoreMock.submitSale).not.toHaveBeenCalled()
  })

  it('validerVente — erreur si pas d\'établissement', async () => {
    setupHappyPath()
    selectedEstablishmentDetail.value = null
    const wrapper = mountComponent()
    await (wrapper.vm as any).addPayment('Espèces')
    await (wrapper.vm as any).validerVente()
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining('établissement'))
    expect(cartStoreMock.submitSale).not.toHaveBeenCalled()
  })

  it('validerVente — erreur si pas de caisse', async () => {
    setupHappyPath()
    selectedRegister.value = null
    const wrapper = mountComponent()
    await (wrapper.vm as any).addPayment('Espèces')
    await (wrapper.vm as any).validerVente()
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining('caisse'))
    expect(cartStoreMock.submitSale).not.toHaveBeenCalled()
  })

  it('validerVente — succès : appelle submitSale avec le bon payload', async () => {
    setupHappyPath()
    const wrapper = mountComponent()
    await (wrapper.vm as any).addPayment('Espèces')
    await (wrapper.vm as any).validerVente()

    expect(cartStoreMock.submitSale).toHaveBeenCalledTimes(1)
    const payload = cartStoreMock.submitSale.mock.calls[0]![0] as Record<string, unknown>
    expect(payload).toMatchObject({
      establishmentId: 5,
      registerId: 7,
      seller: { id: 1, name: 'Seller 1' },
      payments: [{ mode: 'Espèces', amount: 20 }],
      totals: { totalHT: 16.67, totalTVA: 3.33, totalTTC: 20 },
      customer: null,
    })
    expect((payload.items as Array<Record<string, unknown>>)[0]).toMatchObject({
      productId: 10,
      productName: 'Produit A',
      quantity: 1,
      tva: 20,
    })
  })

  it('validerVente — succès : reset cart, customer, payments + recharge produits', async () => {
    setupHappyPath()
    const wrapper = mountComponent()
    await (wrapper.vm as any).addPayment('Espèces')
    await (wrapper.vm as any).validerVente()

    expect(cartStoreMock.clearCart).toHaveBeenCalledTimes(1)
    expect(customerStoreMock.clearClient).toHaveBeenCalledTimes(1)
    expect((wrapper.vm as any).payments).toEqual([])
    expect(productsStoreMock.loadProducts).toHaveBeenCalledTimes(1)
    expect(productsStoreMock.loaded).toBe(false)
    expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining('Vente'))
  })

  it('validerVente — stock insuffisant déclenche un warning mais continue', async () => {
    setupHappyPath()
    cartStoreMock.validateStock.mockReturnValue({ valid: false, errors: ['Produit A: 2/1'] })
    const wrapper = mountComponent()
    await (wrapper.vm as any).addPayment('Espèces')
    await (wrapper.vm as any).validerVente()

    expect(toastMock.warning).toHaveBeenCalledWith(expect.stringContaining('Stock'))
    expect(cartStoreMock.submitSale).toHaveBeenCalledTimes(1)
  })

  it('validerVente — double-soumission bloquée par isSubmitting', async () => {
    setupHappyPath()
    let resolve!: (v: unknown) => void
    cartStoreMock.submitSale.mockImplementation(
      () => new Promise(r => { resolve = r as (v: unknown) => void }),
    )
    const wrapper = mountComponent()
    await (wrapper.vm as any).addPayment('Espèces')
    const p1 = (wrapper.vm as any).validerVente()
    const p2 = (wrapper.vm as any).validerVente()
    resolve({ success: true, sale: { id: 1, ticketNumber: 'T-001', hash: 'x', signature: 'y', saleDate: new Date() } })
    await Promise.all([p1, p2])
    expect(cartStoreMock.submitSale).toHaveBeenCalledTimes(1)
  })

  it('validerVente — erreur API : toast erreur sans clear cart', async () => {
    setupHappyPath()
    cartStoreMock.submitSale.mockRejectedValue(new Error('API down'))
    const wrapper = mountComponent()
    await (wrapper.vm as any).addPayment('Espèces')
    await (wrapper.vm as any).validerVente()

    expect(toastMock.error).toHaveBeenCalled()
    expect(cartStoreMock.clearCart).not.toHaveBeenCalled()
  })

  it('validerVente — totalTTC=0 (échange) : pas de paiement requis, submitSale appelé', async () => {
    setupHappyPath()
    cartStoreMock.totalTTC = ref(0)
    const wrapper = mountComponent()
    await (wrapper.vm as any).validerVente()

    expect(cartStoreMock.submitSale).toHaveBeenCalledTimes(1)
    const payload = cartStoreMock.submitSale.mock.calls[0]![0] as Record<string, unknown>
    expect(payload.payments).toEqual([])
  })
})
