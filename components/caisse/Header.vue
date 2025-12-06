<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { GalleryVerticalEnd, ChevronDown, Settings2 } from 'lucide-vue-next'
import { ref, onMounted, computed, watch } from 'vue'

interface Establishment {
  id: number
  name: string
  city: string | null
  isActive: boolean
}

interface Register {
  id: number
  establishmentId: number
  name: string
  isActive: boolean
}

// État
const establishments = ref<Establishment[]>([])
const allRegisters = ref<Register[]>([])
const selectedEstablishmentId = ref<number | null>(null)
const selectedRegisterId = ref<number | null>(null)
const loading = ref(true)

// Computed
const selectedEstablishment = computed(() => {
  if (!selectedEstablishmentId.value) return null
  return establishments.value.find(e => e.id === selectedEstablishmentId.value) || null
})

const selectedRegister = computed(() => {
  if (!selectedRegisterId.value) return null
  return allRegisters.value.find(r => r.id === selectedRegisterId.value) || null
})

const availableRegisters = computed(() => {
  if (!selectedEstablishmentId.value) return []
  return allRegisters.value.filter(r => r.establishmentId === selectedEstablishmentId.value)
})

// Charger les données
async function loadEstablishments() {
  try {
    const response = await $fetch<{ establishments: any[] }>('/api/establishments')
    establishments.value = response.establishments.map((e): Establishment => ({
      id: e.id,
      name: e.name,
      city: e.city,
      isActive: e.isActive ?? true,
    }))
  } catch (error) {
    console.error('Erreur lors du chargement des établissements:', error)
  }
}

async function loadRegisters() {
  try {
    const response = await $fetch<{ registers: any[] }>('/api/registers')
    allRegisters.value = response.registers.map((r): Register => ({
      id: r.id,
      establishmentId: r.establishmentId,
      name: r.name,
      isActive: r.isActive ?? true,
    }))
  } catch (error) {
    console.error('Erreur lors du chargement des caisses:', error)
  }
}

// Sauvegarder les sélections dans localStorage
function saveSelections() {
  if (selectedEstablishmentId.value) {
    localStorage.setItem('pos_selected_establishment', String(selectedEstablishmentId.value))
  }
  if (selectedRegisterId.value) {
    localStorage.setItem('pos_selected_register', String(selectedRegisterId.value))
  }
}

// Restaurer les sélections depuis localStorage
function restoreSelections() {
  const savedEstablishmentId = localStorage.getItem('pos_selected_establishment')
  const savedRegisterId = localStorage.getItem('pos_selected_register')

  if (savedEstablishmentId) {
    const id = Number(savedEstablishmentId)
    if (establishments.value.find(e => e.id === id)) {
      selectedEstablishmentId.value = id
    }
  }

  if (savedRegisterId) {
    const id = Number(savedRegisterId)
    if (allRegisters.value.find(r => r.id === id)) {
      selectedRegisterId.value = id
    }
  }

  // Si rien n'est sélectionné, sélectionner le premier disponible
  if (!selectedEstablishmentId.value && establishments.value.length > 0) {
    const firstEstablishment = establishments.value[0]
    if (firstEstablishment) {
      selectedEstablishmentId.value = firstEstablishment.id
    }
  }

  if (!selectedRegisterId.value && availableRegisters.value.length > 0) {
    const firstRegister = availableRegisters.value[0]
    if (firstRegister) {
      selectedRegisterId.value = firstRegister.id
    }
  }
}

// Watcher pour sauvegarder les changements
watch([selectedEstablishmentId, selectedRegisterId], () => {
  saveSelections()
})

// Watcher pour réinitialiser la caisse si l'établissement change
watch(selectedEstablishmentId, (newEstablishmentId) => {
  if (!newEstablishmentId) return

  // Si la caisse sélectionnée n'appartient pas au nouvel établissement, la réinitialiser
  if (selectedRegisterId.value) {
    const currentRegister = allRegisters.value.find(r => r.id === selectedRegisterId.value)
    if (currentRegister && currentRegister.establishmentId !== newEstablishmentId) {
      // Sélectionner la première caisse disponible du nouvel établissement
      const newAvailableRegisters = allRegisters.value.filter(r => r.establishmentId === newEstablishmentId)
      const firstAvailableRegister = newAvailableRegisters[0]
      selectedRegisterId.value = firstAvailableRegister ? firstAvailableRegister.id : null
    }
  } else {
    // Sélectionner la première caisse disponible
    const newAvailableRegisters = allRegisters.value.filter(r => r.establishmentId === newEstablishmentId)
    const firstAvailableRegister = newAvailableRegisters[0]
    selectedRegisterId.value = firstAvailableRegister ? firstAvailableRegister.id : null
  }
})

// Charger au montage
onMounted(async () => {
  loading.value = true
  await Promise.all([
    loadEstablishments(),
    loadRegisters(),
  ])
  restoreSelections()
  loading.value = false
})
</script>

<template>
    <header class="flex h-16 items-center px-4 border-b">
        <!-- Gauche : Logo -->
        <div class="flex items-center gap-2 flex-1">
            <a href="/dashboard" class="flex items-center gap-2 font-medium">
                <div class="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <GalleryVerticalEnd class="size-4" />
                </div>
                FymPOS
            </a>
        </div>

        <!-- Centre : Select caisse (Dropdown + Tooltip) -->
        <div class="flex items-center justify-center flex-1">
            <client-only>
                <TooltipProvider>
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
            </client-only>
        </div>

        <!-- Droite : Select magasin + settings -->
        <div class="flex items-center gap-2 justify-end flex-1">
            <client-only>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>
                            <Select
                                :model-value="selectedEstablishmentId?.toString()"
                                @update:model-value="(value) => selectedEstablishmentId = value ? Number(value) : null"
                            >
                                <SelectTrigger class="px-3 min-w-[180px]">
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
            </client-only>

            <client-only>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>
                            <Button variant="ghost" size="icon">
                                <Settings2 />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Paramètres Caisse</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </client-only>
        </div>
    </header>
</template>
