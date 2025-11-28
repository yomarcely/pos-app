<template>
  <div class="grid gap-3 grid-cols-2 lg:grid-cols-4">
    <!-- Total TTC -->
    <div class="border rounded-lg p-3 bg-card">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Euro class="h-4 w-4 text-blue-600" />
          <span class="text-sm font-medium">Total TTC</span>
        </div>
      </div>
      <p class="text-2xl font-bold mt-1">{{ summary.totalTTC.toFixed(2) }} €</p>
      <p class="text-xs text-muted-foreground">HT: {{ summary.totalHT.toFixed(2) }} € · TVA: {{ summary.totalTVA.toFixed(2) }} €</p>
    </div>

    <!-- Tickets -->
    <div class="border rounded-lg p-3 bg-card">
      <div class="flex items-center gap-2">
        <Receipt class="h-4 w-4 text-green-600" />
        <span class="text-sm font-medium">Tickets</span>
      </div>
      <p class="text-2xl font-bold mt-1">{{ summary.ticketCount }}</p>
      <p class="text-xs text-muted-foreground">{{ summary.returnCount }} annulation(s)</p>
    </div>

    <!-- Produits vendus -->
    <div class="border rounded-lg p-3 bg-card">
      <div class="flex items-center gap-2">
        <ShoppingCart class="h-4 w-4 text-purple-600" />
        <span class="text-sm font-medium">Produits</span>
      </div>
      <p class="text-2xl font-bold mt-1">{{ summary.totalQuantity }}</p>
      <p class="text-xs text-muted-foreground">Moy: {{ summary.avgBasketQuantity }} / ticket</p>
    </div>

    <!-- Panier moyen -->
    <div class="border rounded-lg p-3 bg-card">
      <div class="flex items-center gap-2">
        <TrendingUp class="h-4 w-4 text-emerald-600" />
        <span class="text-sm font-medium">Panier moyen</span>
      </div>
      <p class="text-2xl font-bold mt-1">{{ summary.avgBasketValue.toFixed(2) }} €</p>
      <p class="text-xs text-muted-foreground">{{ summary.avgBasketQuantity }} produits</p>
    </div>

    <!-- Remises -->
    <div class="border rounded-lg p-3 bg-card">
      <div class="flex items-center gap-2">
        <TrendingDown class="h-4 w-4 text-orange-600" />
        <span class="text-sm font-medium">Remises</span>
      </div>
      <p class="text-2xl font-bold mt-1">{{ summary.discountCount }}</p>
      <p class="text-xs text-muted-foreground">{{ summary.totalDiscountValue.toFixed(2) }} €</p>
    </div>

    <!-- Paiements -->
    <div v-for="payment in paymentMethods" :key="payment.mode" class="border rounded-lg p-3 bg-card">
      <div class="flex items-center gap-2">
        <Euro class="h-4 w-4 text-slate-600" />
        <span class="text-sm font-medium">{{ payment.mode }}</span>
      </div>
      <p class="text-2xl font-bold mt-1">{{ payment.amount.toFixed(2) }} €</p>
      <p class="text-xs text-muted-foreground">{{ payment.count }} transaction(s)</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Euro, Receipt, ShoppingCart, TrendingUp, TrendingDown } from 'lucide-vue-next'

interface Summary {
  totalTTC: number
  totalHT: number
  totalTVA: number
  ticketCount: number
  returnCount: number
  totalQuantity: number
  avgBasketQuantity: number
  avgBasketValue: number
  discountCount: number
  totalDiscountValue: number
}

interface PaymentMethod {
  mode: string
  amount: number
  count: number
}

defineProps<{
  summary: Summary
  paymentMethods: PaymentMethod[]
}>()
</script>
