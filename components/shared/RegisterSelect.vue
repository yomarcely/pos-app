<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-vue-next'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import { onMounted } from 'vue'

const props = defineProps<{
  showTooltip?: boolean
}>()

const {
  selectedRegisterId,
  selectedRegister,
  availableRegisters,
  loading,
  initialize,
} = useEstablishmentRegister()

onMounted(async () => {
  await initialize()
})
</script>

<template>
  <client-only>
    <TooltipProvider v-if="showTooltip">
      <Tooltip>
        <TooltipTrigger>
          <DropdownMenu>
            <DropdownMenuTrigger class="flex items-center gap-1 font-medium">
              <span v-if="loading">Chargement...</span>
              <span v-else-if="selectedRegister">{{ selectedRegister.name }}</span>
              <span v-else class="text-muted-foreground">Aucune caisse</span>
              <ChevronDown class="h-4 w-4" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="center">
              <DropdownMenuItem
                v-for="register in availableRegisters"
                :key="register.id"
                @click="selectedRegisterId = register.id"
              >
                {{ register.name }}
              </DropdownMenuItem>
              <DropdownMenuItem v-if="availableRegisters.length === 0" disabled>
                Aucune caisse disponible
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipTrigger>
        <TooltipContent>
          <p>Sélection de la caisse</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>

    <DropdownMenu v-else>
      <DropdownMenuTrigger class="flex items-center gap-1 font-medium">
        <span v-if="loading">Chargement...</span>
        <span v-else-if="selectedRegister">{{ selectedRegister.name }}</span>
        <span v-else class="text-muted-foreground">Aucune caisse</span>
        <ChevronDown class="h-4 w-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="center">
        <DropdownMenuItem
          v-for="register in availableRegisters"
          :key="register.id"
          @click="selectedRegisterId = register.id"
        >
          {{ register.name }}
        </DropdownMenuItem>
        <DropdownMenuItem v-if="availableRegisters.length === 0" disabled>
          Aucune caisse disponible
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <template #placeholder>
      <div class="flex items-center gap-1 font-medium text-muted-foreground border rounded-md px-3 py-2 bg-transparent">
        Sélection caisse
      </div>
    </template>
  </client-only>
</template>
