<script setup lang="ts">
definePageMeta({
    layout: 'dashboard'
})

import { ref, onMounted, computed, watch } from 'vue'
import { useProductsStore } from '@/stores/products'
import { useVariationGroupsStore } from '@/stores/variationGroups'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    ShoppingCart,
    Package,
    Users,
    ClipboardList,
    Boxes,
    BarChart3,
    TrendingUp,
    Receipt,
    ShoppingBag,
    AlertTriangle,
    PackageX,
    ArrowRight,
} from 'lucide-vue-next'

const productsStore = useProductsStore()
const variationStore = useVariationGroupsStore()
const { selectedEstablishmentId } = useEstablishmentRegister()

// ──────────────────────────────────────────────
// Date & heure (affichage discret en tête)
// ──────────────────────────────────────────────
const date = ref('')
const time = ref('')

function updateDateTime() {
    const now = new Date()
    date.value = now
        .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        .replace(/^\w/, c => c.toUpperCase())
    time.value = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// ──────────────────────────────────────────────
// KPI du jour (endpoint daily-summary existant)
// ──────────────────────────────────────────────
const summary = ref<any>(null)
const loadingSummary = ref(true)

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
const formatCurrency = (n: number) => eur.format(n ?? 0)

async function loadSummary() {
    loadingSummary.value = true
    try {
        const params = new URLSearchParams()
        params.append('date', new Date().toISOString().split('T')[0] as string)
        if (selectedEstablishmentId.value) {
            params.append('establishmentId', String(selectedEstablishmentId.value))
        }
        const res: any = await $fetch(`/api/sales/daily-summary?${params.toString()}`)
        summary.value = res?.success ? res.summary : null
    } catch {
        summary.value = null
    } finally {
        loadingSummary.value = false
    }
}

const kpis = computed(() => {
    const s = summary.value
    return [
        {
            label: 'CA du jour',
            value: formatCurrency(s?.totalTTC ?? 0),
            sub: s ? `HT ${formatCurrency(s.totalHT)} · TVA ${formatCurrency(s.totalTVA)}` : 'TTC encaissé',
            icon: TrendingUp,
            accent: 'emerald',
        },
        {
            label: 'Ventes',
            value: String(s?.ticketCount ?? 0),
            sub: s?.returnCount ? `${s.returnCount} retour(s)` : 'Tickets du jour',
            icon: Receipt,
            accent: 'blue',
        },
        {
            label: 'Panier moyen',
            value: formatCurrency(s?.avgBasketValue ?? 0),
            sub: s ? `${s.avgBasketQuantity} art./ticket` : 'Par ticket',
            icon: ShoppingBag,
            accent: 'violet',
        },
        {
            label: 'Articles vendus',
            value: String(s?.totalQuantity ?? 0),
            sub: 'Quantité totale',
            icon: Package,
            accent: 'amber',
        },
    ]
})

// ──────────────────────────────────────────────
// Actions rapides
// ──────────────────────────────────────────────
const buttons = [
    { label: 'Caisse', icon: ShoppingCart, path: '/caisse', accent: 'blue' },
    { label: 'Catalogue', icon: Package, path: '/produits', accent: 'green' },
    { label: 'Clients', icon: Users, path: '/clients', accent: 'violet' },
    { label: 'Synthèse', icon: ClipboardList, path: '/synthese', accent: 'amber' },
    { label: 'État du stock', icon: Boxes, path: '/stocks', accent: 'orange' },
    { label: 'Statistiques', icon: BarChart3, path: '/statistiques/ca', accent: 'rose' },
]

// Classes statiques (Tailwind ne peut pas générer de classes dynamiques)
const accentClasses: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400',
    violet: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400',
    rose: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
}

// ──────────────────────────────────────────────
// Alertes stock
// ──────────────────────────────────────────────
function getVariationNameById(variationId: string | number): string {
    const targetId = String(variationId)
    for (const group of variationStore.groups) {
        const variation = group.variations.find(v => String(v.id) === targetId)
        if (variation) return variation.name
    }
    return `Variation ${variationId}`
}

const hasStockAlerts = computed(() =>
    productsStore.outOfStockAlerts.length > 0 || productsStore.lowStockAlerts.length > 0
)

onMounted(() => {
    updateDateTime()
    setInterval(updateDateTime, 60000)
    productsStore.loadProducts()
    variationStore.loadGroups()
    loadSummary()
})

watch(selectedEstablishmentId, () => loadSummary())
</script>

<template>
    <div class="flex h-[calc(100svh_-_4rem)] flex-col gap-6 p-4 pt-0 sm:p-6 sm:pt-0 min-h-0 overflow-hidden">
        <!-- En-tête : date & heure -->
        <div class="flex shrink-0 flex-wrap items-end justify-between gap-2">
            <div>
                <h1 class="text-2xl font-bold tracking-tight">Tableau de bord</h1>
                <p class="text-sm text-muted-foreground capitalize">{{ date }}</p>
            </div>
            <div class="text-3xl font-bold tabular-nums tracking-tight">{{ time }}</div>
        </div>

        <!-- KPI du jour -->
        <div class="grid shrink-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div
                v-for="kpi in kpis"
                :key="kpi.label"
                class="rounded-xl border bg-card p-5 shadow-sm"
            >
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <p class="text-sm font-medium text-muted-foreground">{{ kpi.label }}</p>
                        <p v-if="loadingSummary" class="mt-2 h-8 w-24 animate-pulse rounded bg-muted"></p>
                        <p v-else class="mt-1 text-3xl font-bold tracking-tight tabular-nums">{{ kpi.value }}</p>
                        <p class="mt-1 truncate text-xs text-muted-foreground">{{ kpi.sub }}</p>
                    </div>
                    <span
                        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                        :class="accentClasses[kpi.accent]"
                    >
                        <component :is="kpi.icon" class="h-5 w-5" />
                    </span>
                </div>
            </div>
        </div>

        <!-- Actions rapides + Alertes stock -->
        <div class="grid shrink-0 gap-4 lg:grid-cols-3">
            <!-- Actions rapides -->
            <section class="lg:col-span-2">
                <h2 class="mb-3 text-sm font-semibold text-muted-foreground">Accès rapides</h2>
                <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <button
                        v-for="btn in buttons"
                        :key="btn.label"
                        @click="$router.push(btn.path)"
                        class="group flex flex-col items-center justify-center gap-3 rounded-xl border bg-card p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                        <span
                            class="flex h-14 w-14 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                            :class="accentClasses[btn.accent]"
                        >
                            <component :is="btn.icon" class="h-7 w-7" />
                        </span>
                        <span class="text-sm font-semibold">{{ btn.label }}</span>
                    </button>
                </div>
            </section>

            <!-- Alertes stock -->
            <section class="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
                <div class="flex shrink-0 items-center justify-between border-b px-4 py-3">
                    <h2 class="flex items-center gap-2 text-sm font-semibold">
                        <AlertTriangle class="h-4 w-4 text-muted-foreground" />
                        Alertes stock
                    </h2>
                    <NuxtLink
                        to="/stocks"
                        class="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
                    >
                        Tout voir
                        <ArrowRight class="h-3 w-3" />
                    </NuxtLink>
                </div>

                <div class="relative min-h-0 flex-1">
                  <div class="absolute inset-0 p-4">
                    <div v-if="!hasStockAlerts" class="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Aucune alerte — tout est en stock ✅
                    </div>

                    <ScrollArea v-else class="h-full pr-3">
                    <div class="space-y-5">
                        <!-- Rupture de stock -->
                        <div v-if="productsStore.outOfStockAlerts.length > 0" class="space-y-2">
                            <div class="flex items-center gap-2 text-xs font-semibold text-red-600">
                                <PackageX class="h-4 w-4" />
                                Rupture de stock ({{ productsStore.outOfStockAlerts.length }})
                            </div>
                            <ul class="space-y-2 pl-1">
                                <li v-for="alert in productsStore.outOfStockAlerts" :key="`out-${alert.product.id}`">
                                    <div class="flex flex-col gap-1 rounded-lg border bg-background p-2.5">
                                        <span class="text-sm font-medium">{{ alert.product.name }}</span>
                                        <div v-if="alert.variations && alert.variations.length > 0" class="flex flex-wrap gap-1">
                                            <span
                                                v-for="variation in alert.variations"
                                                :key="variation.id"
                                                class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                            >
                                                {{ getVariationNameById(variation.id) }} ({{ variation.stock }})
                                            </span>
                                        </div>
                                        <span v-else class="text-[11px] text-red-600">Stock : {{ alert.product.stock ?? 0 }}</span>
                                    </div>
                                </li>
                            </ul>
                        </div>

                        <!-- Stock faible -->
                        <div v-if="productsStore.lowStockAlerts.length > 0" class="space-y-2">
                            <div class="flex items-center gap-2 text-xs font-semibold text-orange-600">
                                <AlertTriangle class="h-4 w-4" />
                                Stock faible ({{ productsStore.lowStockAlerts.length }})
                            </div>
                            <ul class="space-y-2 pl-1">
                                <li v-for="alert in productsStore.lowStockAlerts" :key="`low-${alert.product.id}`">
                                    <div class="flex flex-col gap-1 rounded-lg border bg-background p-2.5">
                                        <span class="text-sm font-medium">{{ alert.product.name }}</span>
                                        <div v-if="alert.variations && alert.variations.length > 0" class="flex flex-wrap gap-1">
                                            <span
                                                v-for="variation in alert.variations"
                                                :key="variation.id"
                                                class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                            >
                                                {{ getVariationNameById(variation.id) }} ({{ variation.stock }})
                                            </span>
                                        </div>
                                        <span v-else class="text-[11px] text-orange-600">Stock : {{ alert.product.stock ?? 0 }}</span>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>
                    </ScrollArea>
                  </div>
                </div>
            </section>
        </div>

        <!-- Notes & rappels d'équipe -->
        <div class="min-h-0 flex-1">
            <DashboardNotesWidget />
        </div>
    </div>
</template>
