<script setup lang="ts">
import {
  Euro,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Percent,
  Wallet,
} from 'lucide-vue-next'

interface Kpis {
  totalTTC: number
  totalHT: number
  totalTVA: number
  ticketCount: number
  totalQuantity: number
  avgBasketValue: number
  avgBasketQuantity: number
  totalCost: number
  totalMargin: number
  marginPct: number | null
  marginCoveragePct: number | null
}

defineProps<{
  kpis: Kpis
}>()

function fmtEur(n: number): string {
  return n.toFixed(2)
}
</script>

<template>
  <div class="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
    <!-- CA TTC -->
    <div class="border rounded-lg p-3 bg-card">
      <div class="flex items-center gap-2">
        <Euro class="h-4 w-4 text-blue-600" />
        <span class="text-sm font-medium">CA TTC</span>
      </div>
      <p class="text-2xl font-bold mt-1">{{ fmtEur(kpis.totalTTC) }} €</p>
      <p class="text-xs text-muted-foreground">
        HT : {{ fmtEur(kpis.totalHT) }} €
      </p>
    </div>

    <!-- Tickets -->
    <div class="border rounded-lg p-3 bg-card">
      <div class="flex items-center gap-2">
        <Receipt class="h-4 w-4 text-green-600" />
        <span class="text-sm font-medium">Tickets</span>
      </div>
      <p class="text-2xl font-bold mt-1">{{ kpis.ticketCount }}</p>
      <p class="text-xs text-muted-foreground">Sur la période</p>
    </div>

    <!-- Panier moyen -->
    <div class="border rounded-lg p-3 bg-card">
      <div class="flex items-center gap-2">
        <TrendingUp class="h-4 w-4 text-emerald-600" />
        <span class="text-sm font-medium">Panier moyen</span>
      </div>
      <p class="text-2xl font-bold mt-1">{{ fmtEur(kpis.avgBasketValue) }} €</p>
      <p class="text-xs text-muted-foreground">{{ kpis.avgBasketQuantity }} produits / ticket</p>
    </div>

    <!-- Articles vendus -->
    <div class="border rounded-lg p-3 bg-card">
      <div class="flex items-center gap-2">
        <ShoppingCart class="h-4 w-4 text-purple-600" />
        <span class="text-sm font-medium">Articles vendus</span>
      </div>
      <p class="text-2xl font-bold mt-1">{{ kpis.totalQuantity }}</p>
      <p class="text-xs text-muted-foreground">Quantité totale</p>
    </div>

    <!-- Marge € -->
    <div class="border rounded-lg p-3 bg-card">
      <div class="flex items-center gap-2">
        <Wallet class="h-4 w-4 text-amber-600" />
        <span class="text-sm font-medium">Marge €</span>
      </div>
      <p class="text-2xl font-bold mt-1">{{ fmtEur(kpis.totalMargin) }} €</p>
      <p class="text-xs text-muted-foreground">Coût : {{ fmtEur(kpis.totalCost) }} €</p>
    </div>

    <!-- Marge % -->
    <div class="border rounded-lg p-3 bg-card">
      <div class="flex items-center gap-2">
        <Percent class="h-4 w-4 text-amber-600" />
        <span class="text-sm font-medium">Marge %</span>
      </div>
      <p class="text-2xl font-bold mt-1">
        <span v-if="kpis.marginPct === null">—</span>
        <span v-else>{{ kpis.marginPct.toFixed(2) }} %</span>
      </p>
      <p class="text-xs text-muted-foreground">Sur CA HT</p>
    </div>
  </div>
</template>
