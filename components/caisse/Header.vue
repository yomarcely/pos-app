<script setup lang="ts">
import { GalleryVerticalEnd } from 'lucide-vue-next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import EstablishmentSelect from '@/components/shared/EstablishmentSelect.vue'
import RegisterSelect from '@/components/shared/RegisterSelect.vue'
import { useSellersStore } from '@/stores/sellers'

const sellersStore = useSellersStore()
</script>

<template>
    <header class="flex h-16 items-center px-4 border-b">
        <!-- Gauche : Logo + Vendeur -->
        <div class="flex items-center gap-4 flex-1">
            <NuxtLink to="/dashboard" class="flex items-center gap-2 font-medium">
                <div class="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <GalleryVerticalEnd class="size-4" />
                </div>
                FymPOS
            </NuxtLink>

            <Select v-model="sellersStore.selectedSeller">
                <SelectTrigger class="!w-fit min-w-0">
                    <SelectValue placeholder="Sélectionner un vendeur" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem v-for="seller in sellersStore.sellers" :key="seller.id" :value="String(seller.id)">
                        {{ seller.name }}
                    </SelectItem>
                </SelectContent>
            </Select>
        </div>

        <!-- Centre : Select caisse (Dropdown + Tooltip) -->
        <div class="flex items-center justify-center flex-1">
            <RegisterSelect :show-tooltip="true" />
        </div>

        <!-- Droite : Select magasin -->
        <div class="flex items-center gap-2 justify-end flex-1">
            <EstablishmentSelect :show-tooltip="true" />
        </div>
    </header>
</template>
