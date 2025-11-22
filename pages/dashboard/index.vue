<script setup lang="ts">
definePageMeta({
    layout: 'dashboard'
})

import { ref, onMounted } from 'vue'

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
            <div class="aspect-video rounded-xl bg-white dark:bg-gray-900 p-4 shadow overflow-auto">
                <h2 class="font-semibold mb-2">Notifications</h2>
                <ul class="text-sm space-y-1">
                    <li>Aucune notification</li>
                </ul>
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
