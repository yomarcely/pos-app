<script setup lang="ts">
import { computed, ref } from 'vue'
import { useElementBounding } from '@vueuse/core'
import { CheckCircle2, Circle, Sparkles, X, RefreshCw, AlertCircle, ChevronRight } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { useOnboardingStore } from '@/stores/onboarding'
import { useToast } from '@/composables/useToast'

const onboarding = useOnboardingStore()
const router = useRouter()
const toast = useToast()

const expanded = ref(false)

// Ancre le panneau sur le trigger (à droite, aligné en bas).
// useElementBounding reste à jour sur scroll, resize et collapse de la sidebar.
const triggerWrapperRef = ref<HTMLElement | null>(null)
const triggerBounds = useElementBounding(() => triggerWrapperRef.value as HTMLElement | null)

const panelStyle = computed(() => {
  const right = triggerBounds.right.value
  const bottom = triggerBounds.bottom.value
  if (!right || !bottom) return { display: 'none' }
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0
  return {
    left: `${right + 8}px`,
    bottom: `${viewportHeight - bottom}px`,
  }
})

interface Step {
  key: 'establishment' | 'register' | 'seller' | 'taxRate' | 'product'
  label: string
  done: boolean
  to: string
}

const steps = computed<Step[]>(() => {
  const s = onboarding.status
  return [
    { key: 'establishment', label: 'Établissement', done: !!s?.hasEstablishment, to: '/etablissements' },
    { key: 'register', label: 'Caisse', done: !!s?.hasRegister, to: '/etablissements' },
    { key: 'seller', label: 'Vendeur', done: !!s?.hasSeller, to: '/vendeurs' },
    { key: 'taxRate', label: 'Taux de TVA', done: !!s?.hasTaxRate, to: '/tva' },
    { key: 'product', label: 'Premier produit', done: !!s?.hasProduct, to: '/produits/create' },
  ]
})

const progressPercent = computed(() => {
  const { done, total } = onboarding.progress
  return total > 0 ? Math.round((done / total) * 100) : 0
})

const nextStep = computed(() => steps.value.find(s => !s.done))

const showSeedRetry = computed(() => {
  const s = onboarding.status
  return s && (!s.hasSeller || !s.hasTaxRate)
})

function openWizard() {
  onboarding.setSkipped(false)
  expanded.value = false
  router.push('/onboarding')
}

function goTo(path: string) {
  expanded.value = false
  router.push(path)
}

async function retrySeed() {
  const res = await onboarding.runSeed()
  if (res?.success) {
    toast.success('Configuration créée', 'Vendeur et taux de TVA initialisés.')
  } else {
    const msg = res?.errors?.length ? res.errors.join(' · ') : 'Erreur inconnue'
    toast.error('Échec de la configuration', msg)
  }
}
</script>

<template>
  <!-- Trigger : intégré à la sidebar -->
  <div v-if="onboarding.status && !onboarding.isComplete" ref="triggerWrapperRef">
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          :tooltip="`Configuration (${onboarding.progress.done}/${onboarding.progress.total})`"
          :is-active="expanded"
          @click="expanded = !expanded"
        >
          <Sparkles class="text-primary" />
          <span>Configuration</span>
          <span
            class="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground"
          >
            {{ onboarding.progress.done }}/{{ onboarding.progress.total }}
          </span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </div>

  <!-- Panneau étendu : overlay teleporté sur body -->
  <Teleport to="body">
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 translate-y-2 scale-95"
    >
      <div
        v-if="expanded && onboarding.status && !onboarding.isComplete"
        class="fixed z-50 w-[340px] origin-bottom-left rounded-xl border bg-popover text-popover-foreground shadow-2xl"
        :style="panelStyle"
      >
        <div class="flex items-start justify-between gap-2 border-b p-4 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles class="size-4" />
            </div>
            <div>
              <p class="text-sm font-semibold leading-none">Configuration</p>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ onboarding.progress.done }}/{{ onboarding.progress.total }} étapes
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="size-7 shrink-0 -mr-1 -mt-1"
            aria-label="Fermer"
            @click="expanded = false"
          >
            <X class="size-4" />
          </Button>
        </div>

        <div class="px-4 pt-3">
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              class="h-full bg-primary transition-all duration-500"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>
        </div>

        <div
          v-if="showSeedRetry"
          class="mx-4 mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs dark:border-amber-900/50 dark:bg-amber-950/30"
        >
          <AlertCircle class="size-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <span class="flex-1 text-amber-900 dark:text-amber-200">Configuration de base incomplète</span>
          <Button
            size="sm"
            variant="ghost"
            class="h-6 shrink-0 px-2 text-xs"
            :disabled="onboarding.seeding"
            @click="retrySeed"
          >
            <RefreshCw class="mr-1 size-3" :class="{ 'animate-spin': onboarding.seeding }" />
            Réessayer
          </Button>
        </div>

        <ul class="space-y-0.5 p-2">
          <li v-for="step in steps" :key="step.key">
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors"
              :class="step.done ? 'cursor-default' : 'hover:bg-accent'"
              :disabled="step.done"
              @click="goTo(step.to)"
            >
              <CheckCircle2 v-if="step.done" class="size-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
              <Circle v-else class="size-4 shrink-0 text-muted-foreground" />
              <span
                class="flex-1 text-sm"
                :class="step.done ? 'text-muted-foreground line-through' : 'text-foreground'"
              >
                {{ step.label }}
              </span>
              <ChevronRight v-if="!step.done" class="size-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        </ul>

        <div v-if="onboarding.wizardSkipped && nextStep" class="border-t p-3">
          <Button class="w-full" size="sm" @click="openWizard">
            Reprendre le guide pas-à-pas
          </Button>
        </div>
      </div>
    </transition>
  </Teleport>
</template>
