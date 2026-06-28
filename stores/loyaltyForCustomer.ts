import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useCartStore } from '@/stores/cart'
import { useToast } from '@/composables/useToast'
import type { LoyaltyRewardType, LoyaltyStatus } from '@/composables/useLoyaltyForCustomer'

/**
 * Store de l'état fidélité du client courant en caisse.
 *
 * Remplace l'ancien singleton module-level (`composables/useLoyaltyForCustomer.ts`,
 * qui reste comme wrapper d'API). Tous les composants caisse (ColLeft = étoile / retrait,
 * ColRight = modale d'apply) partagent la même instance via le store Pinia.
 *
 * Les types publics (`LoyaltyStatus`, `LoyaltyRewardType`, `LoyaltyVoucher`) restent définis
 * dans le composable wrapper (deux composants les importent explicitement) ; on les réutilise
 * ici en import de type uniquement (effacé à la compilation, donc pas de cycle runtime).
 */
export const useLoyaltyForCustomerStore = defineStore('loyaltyForCustomer', () => {
  const status = ref<LoyaltyStatus | null>(null)
  const loading = ref(false)

  const cartStore = useCartStore()
  const toast = useToast()

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
})
