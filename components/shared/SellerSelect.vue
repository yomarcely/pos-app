<script setup lang="ts">
import { computed, onMounted, watch, ref } from 'vue'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSellersStore } from '@/stores/sellers'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'

const props = defineProps<{
  showTooltip?: boolean
  minWidth?: string
}>()

const sellersStore = useSellersStore()
const { selectedEstablishmentId, initialize: initializeEstablishment } = useEstablishmentRegister()
const hasInitialized = ref(false)

const minWidthClass = props.minWidth || '!w-fit min-w-0'

const selectedSeller = computed(() => sellersStore.sellers.find(s => s.id === Number(sellersStore.selectedSeller)) || null)

const updateSelectedSeller = (value: unknown) => {
  // Reka Select peut renvoyer string | number | bigint | null selon AcceptableValue
  if (value === null || value === undefined) {
    sellersStore.selectSellerById(null)
    return
  }
  sellersStore.selectSellerById(String(value))
}

async function loadForEstablishment(establishmentId: number | null, resetSelection = false) {
  await sellersStore.loadSellers(establishmentId ?? undefined)
  if (resetSelection) {
    sellersStore.selectSellerById(null)
  }
}

onMounted(async () => {
  await initializeEstablishment()
  await sellersStore.initialize(selectedEstablishmentId.value ?? undefined)
  hasInitialized.value = true
})

// Réinitialise la sélection vendeur quand l'établissement change (même logique que la caisse)
watch(selectedEstablishmentId, async (id, previous) => {
  if (!hasInitialized.value) return
  if (id === previous) return
  await loadForEstablishment(id ?? null, true)
})
</script>

<template>
  <client-only>
    <TooltipProvider v-if="showTooltip">
      <Tooltip>
        <TooltipTrigger>
          <Select
            :model-value="sellersStore.selectedSeller"
            @update:model-value="updateSelectedSeller"
          >
            <SelectTrigger :class="`px-3 ${minWidthClass}`">
              <SelectValue>
                <span v-if="sellersStore.loading">Chargement...</span>
                <span v-else-if="selectedSeller">
                  {{ selectedSeller.name }}
                </span>
                <span v-else class="text-muted-foreground">Sélectionner un vendeur</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="seller in sellersStore.sellers"
                :key="seller.id"
                :value="seller.id.toString()"
              >
                {{ seller.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </TooltipTrigger>
        <TooltipContent>
          <p>Sélection du vendeur</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <Select
      v-else
      :model-value="sellersStore.selectedSeller"
      @update:model-value="updateSelectedSeller"
    >
      <SelectTrigger :class="`px-3 ${minWidthClass}`">
        <SelectValue>
          <span v-if="sellersStore.loading">Chargement...</span>
          <span v-else-if="selectedSeller">
            {{ selectedSeller.name }}
          </span>
          <span v-else class="text-muted-foreground">Sélectionner un vendeur</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="seller in sellersStore.sellers"
          :key="seller.id"
          :value="seller.id.toString()"
        >
          {{ seller.name }}
        </SelectItem>
      </SelectContent>
    </Select>

    <template #placeholder>
      <div :class="`px-3 py-2 text-sm text-muted-foreground border rounded-md bg-transparent ${minWidthClass}`">
        Sélection vendeur
      </div>
    </template>
  </client-only>
</template>
