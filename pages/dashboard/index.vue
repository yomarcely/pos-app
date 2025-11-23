<script setup lang="ts">
definePageMeta({
    layout: 'dashboard'
})

import { ref, onMounted, computed } from 'vue'
import { useProductsStore } from '@/stores/products'
import { useVariationGroupsStore } from '@/stores/variationGroups'

const productsStore = useProductsStore()
const variationStore = useVariationGroupsStore()

const date = ref('')
const time = ref('')

function updateDateTime() {
    const now = new Date()
    const dateOptions: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric' // retire-le si tu ne veux pas l'année
    }

    // .toUpperCase() pour tout mettre en majuscule
    date.value = now.toLocaleDateString('fr-FR', dateOptions).toUpperCase()

    time.value = now.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
    })
}

onMounted(() => {
    updateDateTime()
    setInterval(updateDateTime, 60000)
    productsStore.loadProducts()
    variationStore.loadGroups()
})

import {
    ShoppingCart,
    Package,
    Users,
    BarChart,
    MoveRight,
    ClipboardList
} from 'lucide-vue-next'

const buttons = [
    { label: 'Caisse', icon: ShoppingCart, path: '/caisse', color: 'bg-blue-500 hover:bg-blue-600' },
    { label: 'Catalogue', icon: Package, path: '/produits', color: 'bg-green-500 hover:bg-green-600' },
    { label: 'Clients', icon: Users, path: '/clients', color: 'bg-purple-500 hover:bg-purple-600' },
    { label: 'Synthèse', icon: ClipboardList, path: '/synthese', color: 'bg-yellow-500 hover:bg-yellow-600 text-black' },
    { label: 'Etat du Stock', icon: MoveRight, path: '/stocks', color: 'bg-orange-500 hover:bg-orange-600' },
    { label: 'Statistiques', icon: BarChart, path: '/stats', color: 'bg-red-500 hover:bg-red-600' },
]

// Fonction pour obtenir le nom d'une variation par son ID
function getVariationNameById(variationId: string): string {
    const id = parseInt(variationId)
    for (const group of variationStore.groups) {
        const variation = group.variations.find((v: { id: number, name: string }) => v.id === id)
        if (variation) {
            return variation.name
        }
    }
    return `Variation ${variationId}`
}

const hasStockAlerts = computed(() =>
    productsStore.outOfStockAlerts.length > 0 || productsStore.lowStockAlerts.length > 0
)
</script>

<template>
    <div class="flex flex-1 flex-col gap-4 p-4 pt-0">
        <!-- Haut : Agenda | Date & Heure | Notifications -->
        <div class="grid auto-rows-min gap-4 md:grid-cols-3">
            <!-- Agenda -->
            <div class="aspect-video rounded-xl bg-white dark:bg-gray-900 p-4 shadow">
                <h2 class="font-semibold mb-2">Agenda</h2>
                <p class="text-sm text-muted-foreground">Aucun événement prévu</p>
            </div>

            <!-- Date & Heure -->
            <div
                class="aspect-video rounded-xl bg-white dark:bg-gray-900 p-4 flex flex-col justify-center items-center shadow">
                <p class="text-2xl md:text-3xl font-semibold uppercase tracking-wide">{{ date }}</p>
                <p class="text-4xl md:text-5xl font-bold mt-2">{{ time }}</p>
            </div>

            <!-- Notifications -->
            <div class="aspect-video rounded-xl bg-white dark:bg-gray-900 p-4 shadow flex flex-col">
                <h2 class="font-semibold mb-3 flex-shrink-0">Notifications Stock</h2>
                <div v-if="!hasStockAlerts" class="text-sm text-muted-foreground">
                    Aucune notification
                </div>
                <div v-else class="flex-1 overflow-y-auto pr-2 space-y-4">
                    <!-- Rupture de stock -->
                    <div v-if="productsStore.outOfStockAlerts.length > 0" class="space-y-2">
                        <div class="flex items-center gap-2 text-xs font-semibold text-red-600 sticky top-0 bg-white dark:bg-gray-900 py-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/></svg>
                            Rupture de stock ({{ productsStore.outOfStockAlerts.length }})
                        </div>
                        <ul class="space-y-1.5 ml-5">
                            <li v-for="alert in productsStore.outOfStockAlerts" :key="`out-${alert.product.id}`" class="text-xs">
                                <div class="flex flex-col gap-0.5">
                                    <span class="font-medium text-foreground">{{ alert.product.name }}</span>
                                    <div v-if="alert.variations && alert.variations.length > 0" class="flex flex-wrap gap-1">
                                        <span
                                            v-for="variation in alert.variations"
                                            :key="variation.id"
                                            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                        >
                                            {{ getVariationNameById(variation.id) }} ({{ variation.stock }})
                                        </span>
                                    </div>
                                    <span v-else class="text-red-600 text-[10px]">
                                        Stock: {{ alert.product.stock ?? 0 }}
                                    </span>
                                </div>
                            </li>
                        </ul>
                    </div>

                    <!-- Séparateur -->
                    <div v-if="productsStore.outOfStockAlerts.length > 0 && productsStore.lowStockAlerts.length > 0" class="border-t border-border"></div>

                    <!-- Stock faible -->
                    <div v-if="productsStore.lowStockAlerts.length > 0" class="space-y-2">
                        <div class="flex items-center gap-2 text-xs font-semibold text-orange-600 sticky top-0 bg-white dark:bg-gray-900 py-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            Stock faible ({{ productsStore.lowStockAlerts.length }})
                        </div>
                        <ul class="space-y-1.5 ml-5">
                            <li v-for="alert in productsStore.lowStockAlerts" :key="`low-${alert.product.id}`" class="text-xs">
                                <div class="flex flex-col gap-0.5">
                                    <span class="font-medium text-foreground">{{ alert.product.name }}</span>
                                    <div v-if="alert.variations && alert.variations.length > 0" class="flex flex-wrap gap-1">
                                        <span
                                            v-for="variation in alert.variations"
                                            :key="variation.id"
                                            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                                        >
                                            {{ getVariationNameById(variation.id) }} ({{ variation.stock }})
                                        </span>
                                    </div>
                                    <span v-else class="text-orange-600 text-[10px]">
                                        Stock: {{ alert.product.stock ?? 0 }}
                                    </span>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>

        <!-- Bas : Boutons -->
<div class="flex flex-1 items-center justify-center p-6 bg-muted/50 rounded-xl">
    <div class="grid grid-cols-2 md:grid-cols-3 gap-20 w-full max-w-[556px]">
      <button
        v-for="btn in buttons"
        :key="btn.label"
        @click="$router.push(btn.path)"
        class="aspect-square w-[180px] text-white rounded-xl shadow transition flex flex-col items-center justify-center gap-1 group text-center"
        :class="btn.color"
      >
        <component :is="btn.icon" class="w-14 h-14 transition-transform duration-200 group-hover:scale-110" />
        <span class="font-bold text-lg uppercase tracking-wide leading-tight">{{ btn.label }}</span>
      </button>
    </div>
  </div>
    </div>
</template>
