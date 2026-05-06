import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Product, ProductInCart, SalePayload, SaleResponse } from '@/types'
import { useCustomerStore } from '@/stores/customer'
import { useProductsStore } from '@/stores/products'

import {
  getFinalPrice,
  totalTTC,
  totalHT,
  totalTVA
} from '@/utils/cartUtils'

export const useCartStore = defineStore('cart', () => {

  // --- ÉTAT ---
  const items = ref<ProductInCart[]>([])
  const selectedProduct = ref<Product | null>(null)
  const globalDiscount = ref(0)
  const globalDiscountType = ref<'%' | '€'>('%')

  // --- FIDÉLITÉ ---
  // Avantage en attente d'être consommé sur cette vente.
  // Modes :
  // - 'percent_discount' / 'euro_discount' : appliqué immédiatement sur les items via applyLoyaltyReward()
  // - 'voucher' : pas d'effet sur le panier, le serveur génère le bon à la création de la vente
  type LoyaltyRewardKind = 'percent_discount' | 'euro_discount' | 'voucher'
  interface LoyaltyReward {
    type: LoyaltyRewardKind
    value: number // % ou € selon type
    pointsToConsume: number // nb de points qui seront décrémentés à la validation
  }
  const loyaltyReward = ref<LoyaltyReward | null>(null)
  // Snapshot des items pris AVANT application d'un reward %/€, pour restauration au retrait.
  // Null pour reward type 'voucher' (le panier n'est pas modifié).
  const _itemsBackupBeforeLoyalty = ref<ProductInCart[] | null>(null)

  // Vouchers déjà existants (générés sur des ventes précédentes) que le client souhaite consommer
  // sur la vente courante. Chaque voucher applique son montant comme paiement (de mode "Bon d'achat").
  interface AppliedVoucher {
    id: number
    code: string
    amount: number
  }
  const appliedVouchers = ref<AppliedVoucher[]>([])

  // --- TICKETS EN ATTENTE ---
  // Persistés côté serveur (table pending_sales). Chargés via loadPendingCarts()
  // au montage de la caisse, rafraîchis à chaque add/recover/delete.
  interface PendingCartRow {
    id: number
    tenantId: string
    establishmentId: number
    registerId: number
    customerId: number | null
    items: ProductInCart[]
    globalDiscount: string // decimal côté DB
    globalDiscountType: '%' | '€'
    createdByEmail: string | null
    createdAt: string
  }

  const pendingCart = ref<PendingCartRow[]>([])
  const pendingSharedAcrossRegisters = ref(false)

  const zeroGlobal = { value: 0, type: '%' as '%' }

  async function loadPendingCarts(establishmentId: number, registerId: number): Promise<void> {
    const response = await $fetch<{
      success: boolean
      shared: boolean
      pendingSales: PendingCartRow[]
    }>('/api/pending-sales', {
      params: { establishmentId, registerId },
    })
    pendingCart.value = response.pendingSales
    pendingSharedAcrossRegisters.value = response.shared
  }

  async function addPendingCart(
    establishmentId: number,
    registerId: number,
    clientId: number | null = null
  ): Promise<void> {
    if (!items.value.length) return

    await $fetch('/api/pending-sales/create', {
      method: 'POST',
      body: {
        establishmentId,
        registerId,
        customerId: clientId,
        items: JSON.parse(JSON.stringify(items.value)),
        globalDiscount: globalDiscount.value,
        globalDiscountType: globalDiscountType.value,
      },
    })

    clearCart()
    await loadPendingCarts(establishmentId, registerId)
  }

  async function recoverPendingCart(id: number, establishmentId: number, registerId: number): Promise<void> {
    const cartData = pendingCart.value.find(c => c.id === id)
    if (!cartData) return

    // Appliquer les données du panier (sans vérification de stock car on permet les stocks négatifs)
    items.value = cartData.items
    globalDiscount.value = Number(cartData.globalDiscount) || 0
    globalDiscountType.value = cartData.globalDiscountType

    // Gérer le client
    const customerStore = useCustomerStore()
    if (cartData.customerId !== null) {
      const client = customerStore.clients.find(c => c.id === cartData.customerId)
      if (client) {
        customerStore.selectClient(client)
      } else {
        customerStore.clearClient()
      }
    } else {
      customerStore.clearClient()
    }

    // Supprimer côté serveur
    await $fetch(`/api/pending-sales/${id}/delete`, { method: 'DELETE' })
    await loadPendingCarts(establishmentId, registerId)
  }

  async function deletePendingCart(id: number, establishmentId: number, registerId: number): Promise<void> {
    await $fetch(`/api/pending-sales/${id}/delete`, { method: 'DELETE' })
    await loadPendingCarts(establishmentId, registerId)
  }

  // Totaux ne prennent pas la remise globale tant qu'elle n'est pas appliquée
  const totalTtcComputed = computed(() => totalTTC(items.value, zeroGlobal))
  const totalHtComputed = computed(() => totalHT(items.value, zeroGlobal))
  const totalTvaComputed = computed(() => totalTVA(items.value, zeroGlobal))

  const itemCount = computed(() =>
    items.value.reduce((sum, item) => sum + item.quantity, 0)
  )

  // --- REMISE CLIENT PERMANENTE ---
  function getClientDiscountPercent(): number {
    const customerStore = useCustomerStore()
    const discount = customerStore.client?.discount
    if (!discount) return 0
    const parsed = typeof discount === 'string' ? parseFloat(discount) : discount
    return parsed > 0 ? parsed : 0
  }

  // Appliquer la remise client sur les lignes existantes quand un client est sélectionné
  watch(() => useCustomerStore().client, (newClient) => {
    if (!newClient) return
    const clientDiscount = getClientDiscountPercent()
    if (clientDiscount <= 0) return

    items.value.forEach(item => {
      if (item.discountType === '%') {
        // Prendre la plus forte des deux remises
        item.discount = Math.max(item.discount, clientDiscount)
      } else if (item.discount === 0) {
        // Pas de remise existante : appliquer la remise client
        item.discount = clientDiscount
        item.discountType = '%'
      }
    })
  })

  // --- RÉACTIONS ---
  watch(selectedProduct, (product) => {
    if (product) {
      addToCart(product)
      selectedProduct.value = null
    }
  })

  // --- ACTIONS ---

  function toCartItem(product: Product, variation: string): ProductInCart {
    return {
      ...product,
      quantity: 1,
      discount: 0,
      discountType: '%',
      variation,
      restockOnReturn: false,
      _uniqueId: Date.now() + Math.random(),
    }
  }

  /**
   * Ajoute un produit au panier (permet les stocks négatifs)
   * @param product - Produit à ajouter
   * @param variation - Variation du produit (optionnel)
   * @returns true si l'ajout a réussi
   */
  function addToCart(product: Product, variation = ''): boolean {
    // Vérifier si le produit existe déjà dans le panier avec une quantité positive
    const existing = items.value.find(
      item => item.id === product.id && item.variation === variation && item.quantity > 0
    )

    // Ajouter ou incrémenter (sans vérification de stock)
    if (existing) {
      existing.quantity++
    } else {
      const cartItem = toCartItem(product, variation)
      // Appliquer la remise client permanente si plus forte
      const clientDiscount = getClientDiscountPercent()
      if (clientDiscount > 0 && cartItem.discount < clientDiscount) {
        cartItem.discount = clientDiscount
        cartItem.discountType = '%'
      }
      items.value.push(cartItem)
    }

    // Si une remise loyalty %/€ est active, la (ré)appliquer maintenant que les items ont changé.
    // Cas typique : l'utilisateur a sélectionné le client (et activé l'étoile) AVANT d'ajouter
    // les produits — la remise n'avait pas pu s'appliquer (panier vide) et doit l'être ici.
    if (loyaltyReward.value && loyaltyReward.value.type !== 'voucher') {
      _applyLoyaltyDiscountToItems(loyaltyReward.value)
    }

    return true
  }

  function removeFromCart(id: number, variation = ''): void {
    items.value = items.value.filter(
      item => !(item.id === id && item.variation === variation)
    )
  }

  function clearCart(): void {
    items.value = []
    globalDiscount.value = 0
    globalDiscountType.value = '%'
    loyaltyReward.value = null
    _itemsBackupBeforeLoyalty.value = null
    appliedVouchers.value = []
    const customerStore = useCustomerStore()
    customerStore.clearClient?.()
  }

  /** Active un voucher pour la vente courante. Idempotent. */
  function addAppliedVoucher(voucher: AppliedVoucher): void {
    if (appliedVouchers.value.some(v => v.id === voucher.id)) return
    appliedVouchers.value.push({ id: voucher.id, code: voucher.code, amount: voucher.amount })
  }

  /** Retire un voucher préalablement activé. */
  function removeAppliedVoucher(voucherId: number): void {
    appliedVouchers.value = appliedVouchers.value.filter(v => v.id !== voucherId)
  }

  /** Vide la liste des vouchers actifs (ex: désélection du client). */
  function clearAppliedVouchers(): void {
    appliedVouchers.value = []
  }

  /**
   * Helper interne : applique la remise loyalty %/€ sur les items du panier.
   * - Si un backup existe (re-application après ajout/modif) : restaure d'abord depuis le backup
   *   pour ne pas empiler les remises, puis prend un nouveau snapshot.
   * - Snapshot toujours pris AVANT modif → permet restauration propre au retrait.
   * - Pour reward type 'voucher' : noop (le panier n'est pas modifié).
   */
  function _applyLoyaltyDiscountToItems(reward: LoyaltyReward): void {
    if (reward.type === 'voucher') return
    if (items.value.length === 0) return

    // Si on avait déjà appliqué une fois : revenir à l'état "sans remise loyalty" depuis le backup,
    // tout en préservant les items qui auraient pu être ajoutés depuis (qui n'étaient pas dans le backup).
    if (_itemsBackupBeforeLoyalty.value !== null) {
      const backupIds = new Set(_itemsBackupBeforeLoyalty.value.map(i => `${i.id}|${i.variation}`))
      const newItemsAddedAfterApply = items.value
        .filter(i => !backupIds.has(`${i.id}|${i.variation}`))
        .map(i => JSON.parse(JSON.stringify(i)))
      items.value = [
        ...JSON.parse(JSON.stringify(_itemsBackupBeforeLoyalty.value)),
        ...newItemsAddedAfterApply,
      ]
    }

    // Nouveau snapshot deep-clone AVANT remise loyalty (= état actuel sans remise loyalty)
    _itemsBackupBeforeLoyalty.value = JSON.parse(JSON.stringify(items.value))

    // Application via globalDiscount (vecteur partagé)
    const previousValue = globalDiscount.value
    const previousType = globalDiscountType.value
    globalDiscount.value = reward.value
    globalDiscountType.value = reward.type === 'percent_discount' ? '%' : '€'
    applyGlobalDiscountToItems()
    globalDiscount.value = previousValue
    globalDiscountType.value = previousType
  }

  /**
   * Applique un avantage fidélité au panier.
   * - 'percent_discount' / 'euro_discount' : si items présents, applique immédiatement.
   *   Si panier vide, on garde `loyaltyReward` en attente — sera appliqué au prochain `addToCart`.
   * - 'voucher' : ne touche pas aux items. Le bon sera généré par le serveur à la validation.
   *
   * `loyaltyReward` est toujours stocké pour que useCheckout transmette `pointsToConsume` et
   * l'éventuelle demande de génération de voucher dans le payload de la vente.
   */
  function applyLoyaltyReward(reward: LoyaltyReward): void {
    loyaltyReward.value = reward
    if (reward.type === 'voucher') return
    _applyLoyaltyDiscountToItems(reward)
  }

  /**
   * Retire l'avantage fidélité.
   * Pour reward %/€ : restaure les items dans leur état d'avant application.
   * Pour reward voucher : juste reset (le panier n'avait pas été modifié).
   *
   * Items ajoutés APRÈS l'application sont préservés (sans remise loyalty bien sûr).
   */
  function clearLoyaltyReward(): void {
    if (_itemsBackupBeforeLoyalty.value) {
      const backupIds = new Set(_itemsBackupBeforeLoyalty.value.map(i => `${i.id}|${i.variation}`))
      const itemsAddedAfter = items.value
        .filter(i => !backupIds.has(`${i.id}|${i.variation}`))
        .map(i => JSON.parse(JSON.stringify(i)))
      items.value = [
        ...JSON.parse(JSON.stringify(_itemsBackupBeforeLoyalty.value)),
        ...itemsAddedAfter,
      ]
      _itemsBackupBeforeLoyalty.value = null
    }
    loyaltyReward.value = null
  }

  /**
   * Met à jour la quantité d'un produit dans le panier (permet les stocks négatifs)
   * @param productId - ID du produit
   * @param variation - Variation du produit
   * @param quantity - Nouvelle quantité
   * @returns true si la mise à jour a réussi
   */
  function updateQuantity(
    productId: number,
    variation: string,
    quantity: number
  ): boolean {
    const item = items.value.find(
      p => p.id === productId && p.variation === variation
    )
    if (!item) return false

    item.quantity = quantity
    return true
  }

  function updateDiscount(
    productId: number,
    variation: string,
    discount: number,
    type: '%' | '€'
  ): void {
    const item = items.value.find(
      p => p.id === productId && p.variation === variation
    )
    if (item) {
      // Cap : remise % ≤ 100, remise € ≤ prix unitaire TTC de la ligne
      const clampedDiscount = type === '%'
        ? Math.min(discount, 100)
        : Math.min(discount, item.price)
      item.discount = clampedDiscount
      item.discountType = type
    }
  }

  function updateGlobalDiscount(value: number, type: '%' | '€'): void {
    globalDiscount.value = value
    globalDiscountType.value = type
  }

  /**
   * Applique la remise globale sur chaque produit du panier
   * et réinitialise la remise globale à 0
   */
  function applyGlobalDiscountToItems(): void {
    if (items.value.length === 0 || globalDiscount.value === 0) return

    if (globalDiscountType.value === '%') {
      // Pour une remise en %, on applique le même pourcentage sur chaque produit
      items.value.forEach(item => {
        item.discount = globalDiscount.value
        item.discountType = '%'
      })
    } else {
      // Pour une remise en €, on répartit proportionnellement au prix de chaque ligne
      // 1. Calculer le total du panier (sans remise)
      const total = items.value.reduce((sum, item) => {
        const unitPrice = item.discountType === '%'
          ? item.price * (1 - item.discount / 100)
          : item.price - item.discount
        return sum + (unitPrice * item.quantity)
      }, 0)

      if (total <= 0) return

      // 2. Calculer la remise proportionnelle pour chaque produit
      items.value.forEach(item => {
        const unitPrice = item.discountType === '%'
          ? item.price * (1 - item.discount / 100)
          : item.price - item.discount
        const lineTotal = unitPrice * item.quantity
        const proportion = lineTotal / total
        const itemDiscount = Math.round(globalDiscount.value * proportion * 100) / 100

        // Appliquer la remise en € sur ce produit
        item.discount = itemDiscount
        item.discountType = '€'
      })
    }

    // Réinitialiser la remise globale
    globalDiscount.value = 0
    globalDiscountType.value = '%'
  }

  function updateVariation(
    productId: number,
    oldVariation: string,
    newVariation: string
  ): void {
    const item = items.value.find(
      p => p.id === productId && p.variation === oldVariation
    )
    if (!item) return

    const existing = items.value.find(
      p => p.id === productId && p.variation === newVariation
    )

    // Si la variation existe déjà, fusionner les quantités
    if (existing && existing !== item) {
      existing.quantity += item.quantity
      removeFromCart(productId, oldVariation)
    } else {
      item.variation = newVariation
    }
  }

  /**
   * Valide que tous les produits du panier ont assez de stock
   * @returns true si tout est OK, false sinon
   */
  function validateStock(): { valid: boolean; errors: string[] } {
    const productsStore = useProductsStore()
    const errors: string[] = []

    for (const item of items.value) {
      if (!productsStore.hasEnoughStock(item.id, item.variation, item.quantity)) {
        const availableStock = productsStore.getAvailableStock(item.id, item.variation)
        errors.push(
          `${item.name} ${item.variation ? `(${item.variation})` : ''}: ` +
          `demandé ${item.quantity}, disponible ${availableStock}`
        )
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  async function checkDayClosure(registerId: number): Promise<boolean> {
    const result = await $fetch<{ isClosed: boolean }>('/api/sales/check-closure', {
      params: { registerId },
    })
    return result.isClosed
  }

  async function submitSale(payload: SalePayload): Promise<SaleResponse> {
    return $fetch<SaleResponse>('/api/sales/create', {
      method: 'POST',
      body: payload,
    })
  }

  return {
    // état
    items,
    selectedProduct,
    globalDiscount,
    globalDiscountType,
    pendingCart,
    pendingSharedAcrossRegisters,
    loyaltyReward,
    appliedVouchers,

    // getters
    getFinalPrice: (product: ProductInCart) =>
      getFinalPrice(product, items.value, zeroGlobal),
    totalTTC: totalTtcComputed,
    totalHT: totalHtComputed,
    totalTVA: totalTvaComputed,
    itemCount,

    // actions
    addToCart,
    removeFromCart,
    clearCart,
    updateQuantity,
    updateDiscount,
    updateGlobalDiscount,
    applyGlobalDiscountToItems,
    applyLoyaltyReward,
    clearLoyaltyReward,
    addAppliedVoucher,
    removeAppliedVoucher,
    clearAppliedVouchers,
    updateVariation,
    addPendingCart,
    recoverPendingCart,
    deletePendingCart,
    loadPendingCarts,
    validateStock,
    checkDayClosure,
    submitSale,
  }
})
