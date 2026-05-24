import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

export interface OnboardingStatus {
  hasEstablishment: boolean
  hasRegister: boolean
  hasSeller: boolean
  hasTaxRate: boolean
  hasProduct: boolean
  isComplete: boolean
  progress: { done: number; total: number }
}

export interface SeedResult {
  success: boolean
  created: { seller: boolean; taxRates: number; sellerAttachments: number }
  alreadySeeded: boolean
  errors: string[]
}

const SKIP_KEY_PREFIX = 'onboarding_wizard_skipped'

function scopedSkipKey(tenantId: string | null): string | null {
  return tenantId ? `${SKIP_KEY_PREFIX}_${tenantId}` : null
}

export const useOnboardingStore = defineStore('onboarding', () => {
  const status = ref<OnboardingStatus | null>(null)
  const loading = ref(false)
  const seeding = ref(false)
  const error = ref<string | null>(null)
  const lastSeedResult = ref<SeedResult | null>(null)
  const wizardSkipped = ref(false)

  const isComplete = computed(() => status.value?.isComplete ?? false)
  const progress = computed(() => status.value?.progress ?? { done: 0, total: 5 })

  // Le wizard ne s'affiche que si onboarding incomplet ET non-skipped
  const shouldShowWizard = computed(() => {
    if (!status.value) return false
    return !status.value.isComplete && !wizardSkipped.value
  })

  function readSkipped(): void {
    if (!process.client) return
    const tenantId = useAuthStore().tenantId
    const key = scopedSkipKey(tenantId)
    if (!key) {
      wizardSkipped.value = false
      return
    }
    wizardSkipped.value = localStorage.getItem(key) === '1'
  }

  function setSkipped(value: boolean): void {
    wizardSkipped.value = value
    if (!process.client) return
    const tenantId = useAuthStore().tenantId
    const key = scopedSkipKey(tenantId)
    if (!key) return
    if (value) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  }

  async function fetchStatus(): Promise<OnboardingStatus | null> {
    if (loading.value) return status.value
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<OnboardingStatus>('/api/onboarding/status')
      status.value = res
      return res
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Erreur lors du chargement du statut onboarding'
      console.error('[Onboarding] fetchStatus error', err)
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Appelle l'endpoint seed (création vendeur + 3 TVA par défaut).
   * L'endpoint est idempotent : il ne re-crée pas les entités déjà présentes.
   * Re-fetch le statut après seed pour refléter le nouvel état.
   *
   * Retourne le résultat brut pour permettre à l'appelant de voir les erreurs
   * (par exemple un toast côté checklist en mode retry).
   */
  async function runSeed(): Promise<SeedResult | null> {
    if (seeding.value) return lastSeedResult.value
    seeding.value = true
    try {
      const res = await $fetch<SeedResult>('/api/onboarding/seed', { method: 'POST' })
      lastSeedResult.value = res
      if (!res.success) {
        console.error('[Onboarding] seed errors', res.errors)
      }
      await fetchStatus()
      return res
    } catch (err: unknown) {
      console.error('[Onboarding] runSeed error', err)
      const msg = err instanceof Error ? err.message : 'Erreur lors du seed'
      error.value = msg
      lastSeedResult.value = { success: false, created: { seller: false, taxRates: 0, sellerAttachments: 0 }, alreadySeeded: false, errors: [msg] }
      return lastSeedResult.value
    } finally {
      seeding.value = false
    }
  }

  /**
   * Garantit que vendeur + 3 TVA par défaut existent.
   * No-op si vendeur ET TVA déjà présents.
   */
  async function ensureSeeded(): Promise<void> {
    if (seeding.value) return
    if (!status.value) {
      await fetchStatus()
    }
    if (status.value?.hasSeller && status.value?.hasTaxRate) return
    await runSeed()
  }

  /**
   * Réinitialise l'état (appelé par signOut côté auth store).
   */
  function reset(): void {
    status.value = null
    loading.value = false
    seeding.value = false
    error.value = null
    lastSeedResult.value = null
    wizardSkipped.value = false
  }

  return {
    status,
    loading,
    seeding,
    error,
    lastSeedResult,
    wizardSkipped,
    isComplete,
    progress,
    shouldShowWizard,
    readSkipped,
    setSkipped,
    fetchStatus,
    runSeed,
    ensureSeeded,
    reset,
  }
})
