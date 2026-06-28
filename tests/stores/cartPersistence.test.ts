import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { useCartStore } from '@/stores/cart'
import { cartStorageKey, purgeAllPersistedCarts } from '@/utils/cartPersistence'

// --- Mocks scope tenant/caisse ---
const authMock = vi.hoisted(() => ({ tenantId: 'tenant-a' as string | null }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => authMock }))

const registerMock = vi.hoisted(() => ({ selectedRegisterId: { value: 1 as number | null } }))
vi.mock('@/composables/useEstablishmentRegister', () => ({
  useEstablishmentRegister: () => registerMock,
}))

const toastInfo = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ info: toastInfo, success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}))

const customerMock = vi.hoisted(() => {
  const mock = {
    clients: [] as Array<{ id: number; firstName: string }>,
    client: null as { id: number; firstName: string } | null,
    selectClient: (c: { id: number; firstName: string }) => { mock.client = c },
    clearClient: () => { mock.client = null },
  }
  return mock
})
vi.mock('@/stores/customer', () => ({ useCustomerStore: () => customerMock }))

const product = { id: 1, name: 'Produit test', image: null, price: 10, tva: 20, stock: 5 }
const KEY = cartStorageKey('tenant-a', 1)

async function flushSave() {
  await nextTick()
  vi.advanceTimersByTime(300)
}

describe('cart store — persistance localStorage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    authMock.tenantId = 'tenant-a'
    registerMock.selectedRegisterId.value = 1
    customerMock.clients = []
    customerMock.client = null
    toastInfo.mockClear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('persiste items/remise/vouchers/client sous la clé scopée (débounce 300ms)', async () => {
    const cart = useCartStore()
    customerMock.client = { id: 42, firstName: 'Alice' }
    cart.addToCart(product as any)
    cart.updateGlobalDiscount(5, '€')
    cart.addAppliedVoucher({ id: 7, code: 'BON7', amount: 3 })

    await nextTick()
    // Avant les 300ms : rien d'écrit
    vi.advanceTimersByTime(200)
    expect(localStorage.getItem(KEY)).toBeNull()

    vi.advanceTimersByTime(100)
    const saved = JSON.parse(localStorage.getItem(KEY)!)
    expect(saved.v).toBe(1)
    expect(saved.items).toHaveLength(1)
    expect(saved.items[0].id).toBe(1)
    expect(saved.globalDiscount).toBe(5)
    expect(saved.globalDiscountType).toBe('€')
    expect(saved.customerId).toBe(42)
    expect(saved.appliedVouchers).toEqual([{ id: 7, code: 'BON7', amount: 3 }])
  })

  it('ne persiste rien si tenant ou caisse indisponibles', async () => {
    authMock.tenantId = null
    const cart = useCartStore()
    cart.addToCart(product as any)
    await flushSave()
    expect(localStorage.length).toBe(0)
  })

  it('restaure le panier persisté du tenant/caisse courants avec toast', () => {
    localStorage.setItem(KEY, JSON.stringify({
      v: 1,
      items: [{ ...product, quantity: 2, discount: 0, discountType: '%', variation: '', _uniqueId: 1 }],
      globalDiscount: 10,
      globalDiscountType: '%',
      customerId: 42,
      appliedVouchers: [{ id: 7, code: 'BON7', amount: 3 }],
    }))
    customerMock.clients = [{ id: 42, firstName: 'Alice' }]

    const cart = useCartStore()
    expect(cart.restorePersistedCart()).toBe(true)
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0]!.quantity).toBe(2)
    expect(cart.globalDiscount).toBe(10)
    expect(cart.appliedVouchers).toEqual([{ id: 7, code: 'BON7', amount: 3 }])
    expect(customerMock.client?.id).toBe(42)
    expect(toastInfo).toHaveBeenCalledWith('Panier restauré')
  })

  it('ne restaure pas un panier d\'un autre tenant ou d\'une autre caisse', () => {
    localStorage.setItem(cartStorageKey('tenant-b', 1), JSON.stringify({
      v: 1, items: [{ ...product, quantity: 1 }], globalDiscount: 0, globalDiscountType: '%', customerId: null, appliedVouchers: [],
    }))
    localStorage.setItem(cartStorageKey('tenant-a', 2), JSON.stringify({
      v: 1, items: [{ ...product, quantity: 1 }], globalDiscount: 0, globalDiscountType: '%', customerId: null, appliedVouchers: [],
    }))

    const cart = useCartStore()
    expect(cart.restorePersistedCart()).toBe(false)
    expect(cart.items).toHaveLength(0)
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('purge silencieusement un JSON corrompu', () => {
    localStorage.setItem(KEY, '{corrompu!!!')
    const cart = useCartStore()
    expect(cart.restorePersistedCart()).toBe(false)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('purge silencieusement un snapshot > 500 Ko', () => {
    localStorage.setItem(KEY, '"' + 'x'.repeat(501 * 1024) + '"')
    const cart = useCartStore()
    expect(cart.restorePersistedCart()).toBe(false)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('purge la clé quand le panier est vidé (clearCart)', async () => {
    const cart = useCartStore()
    cart.addToCart(product as any)
    await flushSave()
    expect(localStorage.getItem(KEY)).not.toBeNull()

    cart.clearCart()
    expect(localStorage.getItem(KEY)).toBeNull()
    // Le débounce en attente ne doit pas ré-écrire après la purge
    await flushSave()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('purgeAllPersistedCarts supprime toutes les clés fympos-cart-* (signOut)', () => {
    localStorage.setItem(cartStorageKey('tenant-a', 1), '{}')
    localStorage.setItem(cartStorageKey('tenant-b', 9), '{}')
    localStorage.setItem('fympos-cart-payments-tenant-a-1', '[]')
    localStorage.setItem('fympos-shortcut-board-1', '[]') // étranger : conservé

    purgeAllPersistedCarts()

    expect(localStorage.getItem(cartStorageKey('tenant-a', 1))).toBeNull()
    expect(localStorage.getItem(cartStorageKey('tenant-b', 9))).toBeNull()
    expect(localStorage.getItem('fympos-cart-payments-tenant-a-1')).toBeNull()
    expect(localStorage.getItem('fympos-shortcut-board-1')).toBe('[]')
  })
})
