import { computed, ref } from 'vue'
import { useCartStore } from '@/stores/cart'
import { useToast } from '@/composables/useToast'

export type LoyaltyRewardType = 'percent_discount' | 'euro_discount' | 'voucher'

export interface LoyaltyVoucher {
  id: number
  code: string
  amount: number
  expiresAt: string | Date | null
  createdAt: string | Date
}

export interface LoyaltyStatus {
  enabled: boolean
  optedIn?: boolean
  pointsCurrent?: number
  pointsRequired?: number
  pointsRemaining?: number
  rewardType?: LoyaltyRewardType
  rewardValue?: number
  immediateRewardEligible?: boolean
  vouchers?: LoyaltyVoucher[]
}

// État au niveau module — singleton partagé entre tous les composants de la caisse
// (ColLeft affiche l'icône / déclenche le retrait ; ColRight gère la modale d'apply).
const status = ref<LoyaltyStatus | null>(null)
const loading = ref(false)

/**
 * Composable singleton pour l'état fidélité du client courant en caisse.
 * Tous les composants partagent la même instance via les refs au niveau module.
 *
 * Usage typique :
 *   const { status, fetchStatus, reset } = useLoyaltyForCustomer()
 *   watch(customerStore.client, (c) => {
 *     if (c) fetchStatus(c.id, establishmentId)
 *     else reset()
 *   })
 */
export function useLoyaltyForCustomer() {

  async function fetchStatus(customerId: number, establishmentId: number): Promise<LoyaltyStatus> {
    try {
      loading.value = true
      const response = await $fetch<LoyaltyStatus & { success: boolean }>(
        `/api/clients/${customerId}/loyalty-status`,
        { params: { establishmentId } },
      )
      status.value = response
      return response
    }
    finally {
      loading.value = false
    }
  }

  function reset(): void {
    status.value = null
  }

  /**
   * Décrémente localement les points après application d'un avantage.
   * Évite un re-fetch immédiat — le prochain fetchStatus repassera par le serveur.
   */
  function consumePointsLocally(amount: number): void {
    if (!status.value) return
    if (typeof status.value.pointsCurrent === 'number') {
      status.value.pointsCurrent = Math.max(0, status.value.pointsCurrent - amount)
    }
    if (typeof status.value.pointsRequired === 'number' && typeof status.value.pointsCurrent === 'number') {
      status.value.pointsRemaining = Math.max(0, status.value.pointsRequired - status.value.pointsCurrent)
      status.value.immediateRewardEligible = status.value.pointsCurrent >= status.value.pointsRequired
        && status.value.rewardType !== 'voucher'
    }
  }

  /**
   * Restaure les points localement après retrait d'un avantage.
   */
  function restorePointsLocally(amount: number): void {
    if (!status.value) return
    if (typeof status.value.pointsCurrent === 'number') {
      status.value.pointsCurrent += amount
    }
    if (typeof status.value.pointsRequired === 'number' && typeof status.value.pointsCurrent === 'number') {
      status.value.pointsRemaining = Math.max(0, status.value.pointsRequired - status.value.pointsCurrent)
      status.value.immediateRewardEligible = status.value.pointsCurrent >= status.value.pointsRequired
        && status.value.rewardType !== 'voucher'
    }
  }

  // ===========================================
  // Toggle apply/remove — utilisé par l'étoile dans ColLeft + la modale dans ColRight
  // ===========================================

  const cartStore = useCartStore()
  const toast = useToast()

  /** Le client a-t-il assez de points pour déclencher l'avantage ? */
  const isEligibleForReward = computed(() => {
    const s = status.value
    if (!s || !s.enabled || !s.optedIn) return false
    if (typeof s.pointsCurrent !== 'number' || typeof s.pointsRequired !== 'number') return false
    return s.pointsCurrent >= s.pointsRequired
  })

  /** Avantage actuellement appliqué au panier ? */
  const isRewardApplied = computed(() => cartStore.loyaltyReward !== null)

  function rewardLabel(type: LoyaltyRewardType, value: number): string {
    if (type === 'percent_discount') return `${value}% de remise`
    if (type === 'euro_discount') return `${value.toFixed(2)} € de rabais`
    return `Bon d'achat de ${value.toFixed(2)} €`
  }

  /**
   * Applique l'avantage : ajoute au panier + décrémente les points localement.
   * Aucun effet si le client n'est pas éligible ou si un avantage est déjà appliqué.
   */
  function applyReward(): void {
    const s = status.value
    if (!isEligibleForReward.value || !s || !s.rewardType || typeof s.rewardValue !== 'number'
      || typeof s.pointsRequired !== 'number') {
      return
    }
    if (cartStore.loyaltyReward) return

    cartStore.applyLoyaltyReward({
      type: s.rewardType,
      value: s.rewardValue,
      pointsToConsume: s.pointsRequired,
    })
    consumePointsLocally(s.pointsRequired)
    if (s.rewardType === 'voucher') {
      toast.success(`Bon d'achat de ${s.rewardValue.toFixed(2)} € sera généré à la validation`)
    }
    else {
      toast.success(`Avantage fidélité appliqué : ${rewardLabel(s.rewardType, s.rewardValue)}`)
    }
  }

  /** Retire l'avantage du panier + restitue les points localement. */
  function removeReward(): void {
    const previous = cartStore.loyaltyReward
    if (!previous) return
    cartStore.clearLoyaltyReward()
    restorePointsLocally(previous.pointsToConsume)
    toast.info('Avantage fidélité retiré')
  }

  /** Toggle pour l'étoile : applique si pas appliqué, retire si déjà appliqué. */
  function toggleReward(): void {
    if (isRewardApplied.value) removeReward()
    else applyReward()
  }

  return {
    status,
    loading,
    fetchStatus,
    reset,
    consumePointsLocally,
    restorePointsLocally,
    isEligibleForReward,
    isRewardApplied,
    applyReward,
    removeReward,
    toggleReward,
  }
}
