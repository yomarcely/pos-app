<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import { onMounted } from 'vue'

const props = defineProps<{
  showTooltip?: boolean
  minWidth?: string
}>()

const {
  establishments,
  selectedEstablishmentId,
  selectedEstablishment,
  loading,
  initialize,
} = useEstablishmentRegister()

onMounted(async () => {
  await initialize()
})

const minWidthClass = props.minWidth || 'min-w-[180px]'
</script>

<template>
  <client-only>
    <TooltipProvider v-if="showTooltip">
      <Tooltip>
        <TooltipTrigger>
          <Select
            :model-value="selectedEstablishmentId?.toString()"
            @update:model-value="(value) => selectedEstablishmentId = value ? Number(value) : null"
          >
            <SelectTrigger :class="`px-3 ${minWidthClass}`">
              <SelectValue>
                <span v-if="loading">Chargement...</span>
                <span v-else-if="selectedEstablishment">
                  {{ selectedEstablishment.name }}
                  <span v-if="selectedEstablishment.city" class="text-muted-foreground text-xs">
                    - {{ selectedEstablishment.city }}
                  </span>
                </span>
                <span v-else class="text-muted-foreground">Aucun établissement</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="establishment in establishments"
                  :key="establishment.id"
                  :value="establishment.id.toString()"
                >
                  {{ establishment.name }}
                  <span v-if="establishment.city" class="text-muted-foreground text-xs ml-1">
                    - {{ establishment.city }}
                  </span>
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </TooltipTrigger>
        <TooltipContent>
          <p>Sélection du point de vente</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <Select
      v-else
      :model-value="selectedEstablishmentId?.toString()"
      @update:model-value="(value) => selectedEstablishmentId = value ? Number(value) : null"
    >
      <SelectTrigger :class="`px-3 ${minWidthClass}`">
        <SelectValue>
          <span v-if="loading">Chargement...</span>
          <span v-else-if="selectedEstablishment">
            {{ selectedEstablishment.name }}
            <span v-if="selectedEstablishment.city" class="text-muted-foreground text-xs">
              - {{ selectedEstablishment.city }}
            </span>
          </span>
          <span v-else class="text-muted-foreground">Aucun établissement</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem
            v-for="establishment in establishments"
            :key="establishment.id"
            :value="establishment.id.toString()"
          >
            {{ establishment.name }}
            <span v-if="establishment.city" class="text-muted-foreground text-xs ml-1">
              - {{ establishment.city }}
            </span>
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  </client-only>
</template>
