import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'

// storeToRefs est court-circuité : le mock du cart store expose déjà des refs.
vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, storeToRefs: (store: unknown) => store }
})

const cartMock = {
  items: [] as Array<Record<string, unknown>>,
  appliedVouchers: [] as Array<{ id: number; code: string; amount: number }>,
  globalDiscount: 0,
  globalDiscountType: '%',
  loyaltyReward: null,
  clientSaleId: 'uuid-test',
  totalTTC: ref(10),
  totalHT: ref(8.33),
  totalTVA: ref(1.67),
  getFinalPrice: vi.fn(() => 10),
  submitSale: vi.fn(),
  clearCart: vi.fn(),
  checkDayClosure: vi.fn().mockResolvedValue(false),
}
vi.mock('@/stores/cart', () => ({ useCartStore: () => cartMock }))

const productsMock = { loaded: true, loadProducts: vi.fn().mockResolvedValue(undefined) }
vi.mock('@/stores/products', () => ({ useProductsStore: () => productsMock }))

const customerMock = { client: null, clientName: '', clearClient: vi.fn() }
vi.mock('@/stores/customer', () => ({ useCustomerStore: () => customerMock }))

const sellersMock = { selectedSeller: 1, sellers: [{ id: 1, name: 'Vendeur Test' }] }
vi.mock('@/stores/sellers', () => ({ useSellersStore: () => sellersMock }))

vi.mock('@/stores/variationGroups', () => ({ useVariationGroupsStore: () => ({ groups: [], resolveVariationId: () => null }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ tenantId: 'tenant-test' }) }))

vi.mock('@/composables/useEstablishmentRegister', () => ({
  useEstablishmentRegister: () => ({
    selectedRegisterId: ref(1),
    selectedRegister: ref({ id: 1, name: 'Caisse 1' }),
    selectedEstablishmentDetail: ref({ id: 1, name: 'Établissement Test' }),
  }),
}))

const toastMock = { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() }
vi.mock('@/composables/useToast', () => ({ useToast: () => toastMock }))

vi.mock('@/utils/cartPersistence', () => ({
  paymentsStorageKey: () => 'k',
  readPersisted: () => null,
  writePersisted: vi.fn(),
  purgePersisted: vi.fn(),
}))

import { useCheckout } from '@/composables/useCheckout'

function saleSuccessResponse() {
  return {
    success: true,
    stockWarnings: [],
    sale: {
      ticketNumber: 'T-001',
      saleDate: '2026-06-13T10:00:00Z',
      hash: 'hash',
      signature: 'sig',
      loyalty: null,
    },
  }
}

function setupCheckout() {
  const checkout = useCheckout()
  checkout.payments.value = [{ mode: 'Espèces', amount: 10 }]
  return checkout
}

describe('useCheckout — validerVente', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    cartMock.items = [{ id: 1, name: 'Produit', quantity: 1, price: 10, tva: 20 }]
    cartMock.totalTTC.value = 10
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('double-clic : ne soumet la vente qu\'une seule fois', async () => {
    let resolveSale!: (v: unknown) => void
    cartMock.submitSale.mockReturnValue(new Promise(r => (resolveSale = r)))

    const checkout = setupCheckout()
    const p1 = checkout.validerVente()
    const p2 = checkout.validerVente() // double-clic pendant isSubmitting

    expect(checkout.isSubmitting.value).toBe(true)
    resolveSale(saleSuccessResponse())
    await Promise.all([p1, p2])

    expect(cartMock.submitSale).toHaveBeenCalledTimes(1)
    expect(checkout.isSubmitting.value).toBe(false)
  })

  it('échec 500 persistant : retry 3 fois (1s/2s/4s) puis modal, panier intact', async () => {
    cartMock.submitSale.mockRejectedValue({ statusCode: 500, message: 'Erreur serveur' })

    const checkout = setupCheckout()
    const promise = checkout.validerVente()
    await vi.advanceTimersByTimeAsync(7000) // 1s + 2s + 4s de backoff
    await promise

    // 1 tentative initiale + 3 retries
    expect(cartMock.submitSale).toHaveBeenCalledTimes(4)
    expect(checkout.showErrorDialog.value).toBe(true)
    expect(checkout.errorDialogMessage.value).toBe('Erreur serveur')
    expect(checkout.errorDialogTotal.value).toBe(10)
    // Panier et paiements intacts : aucun reset en cas d'échec
    expect(cartMock.clearCart).not.toHaveBeenCalled()
    expect(customerMock.clearClient).not.toHaveBeenCalled()
    expect(checkout.payments.value).toEqual([{ mode: 'Espèces', amount: 10 }])
    expect(checkout.showSuccessDialog.value).toBe(false)
  })

  it('échec 4xx : pas de retry, modal immédiat', async () => {
    cartMock.submitSale.mockRejectedValue({ statusCode: 400, message: 'Paiement invalide' })

    const checkout = setupCheckout()
    await checkout.validerVente()

    expect(cartMock.submitSale).toHaveBeenCalledTimes(1)
    expect(checkout.showErrorDialog.value).toBe(true)
    expect(cartMock.clearCart).not.toHaveBeenCalled()
  })

  it('succès après retry sur erreur réseau : vente validée, panier vidé', async () => {
    cartMock.submitSale
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // erreur réseau, sans statusCode
      .mockResolvedValueOnce(saleSuccessResponse())

    const checkout = setupCheckout()
    const promise = checkout.validerVente()
    await vi.advanceTimersByTimeAsync(0) // flush de la première tentative (rejetée)
    expect(checkout.isRetrying.value).toBe(true)
    await vi.advanceTimersByTimeAsync(1000)
    await promise

    expect(cartMock.submitSale).toHaveBeenCalledTimes(2)
    expect(checkout.showErrorDialog.value).toBe(false)
    expect(checkout.showSuccessDialog.value).toBe(true)
    expect(cartMock.clearCart).toHaveBeenCalledTimes(1)
    expect(checkout.payments.value).toEqual([])
    expect(checkout.isRetrying.value).toBe(false)
  })

  it('verrou pendant soumission : addPayment et removePayment sont ignorés', async () => {
    let resolveSale!: (v: unknown) => void
    cartMock.submitSale.mockReturnValue(new Promise(r => (resolveSale = r)))

    const checkout = setupCheckout()
    const promise = checkout.validerVente()

    checkout.removePayment('Espèces')
    checkout.addPayment('Carte')
    expect(checkout.payments.value).toEqual([{ mode: 'Espèces', amount: 10 }])

    resolveSale(saleSuccessResponse())
    await promise
  })
})
