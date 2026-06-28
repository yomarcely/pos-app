import { storeToRefs } from 'pinia'
import { useLoyaltyForCustomerStore } from '@/stores/loyaltyForCustomer'

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

/**
 * Wrapper de compatibilité autour de `stores/loyaltyForCustomer.ts`.
 *
 * L'état (status fidélité du client courant en caisse) vit désormais dans un store Pinia
 * (plus de singleton module-level). Ce composable conserve l'API publique historique
 * (refs + fonctions) ainsi que les types publics (importés explicitement par
 * `LoyaltyVouchersDialog.vue` / `LoyaltyRewardDialog.vue`). `storeToRefs` expose l'état et
 * les getters sous forme de refs, à l'identique de l'ancienne API.
 *
 * Usage typique :
 *   const { status, fetchStatus, reset } = useLoyaltyForCustomer()
 *   watch(customerStore.client, (c) => {
 *     if (c) fetchStatus(c.id, establishmentId)
 *     else reset()
 *   })
 */
export function useLoyaltyForCustomer() {
  const store = useLoyaltyForCustomerStore()
  const { status, loading, isEligibleForReward, isRewardApplied } = storeToRefs(store)

  return {
    status,
    loading,
    fetchStatus: store.fetchStatus,
    reset: store.reset,
    consumePointsLocally: store.consumePointsLocally,
    restorePointsLocally: store.restorePointsLocally,
    isEligibleForReward,
    isRewardApplied,
    applyReward: store.applyReward,
    removeReward: store.removeReward,
    toggleReward: store.toggleReward,
  }
}
