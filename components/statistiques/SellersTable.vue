<script setup lang="ts">
import { computed } from 'vue'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Trophy } from 'lucide-vue-next'

interface SellerStat {
  sellerId: number
  sellerName: string
  ticketCount: number
  totalTTC: number
  totalHT: number
  totalQuantity: number
  avgBasketValue: number
  totalMargin: number
  marginPct: number | null
}

const props = defineProps<{
  sellers: SellerStat[]
}>()

const maxTTC = computed(() => Math.max(...props.sellers.map(s => s.totalTTC), 1))

function fmtEur(n: number): string {
  return n.toFixed(2)
}

function pctOfMax(ttc: number): number {
  return (ttc / maxTTC.value) * 100
}
</script>

<template>
  <div class="border rounded-lg bg-card">
    <div class="p-4 border-b">
      <h3 class="font-semibold text-sm">Classement vendeurs</h3>
      <p class="text-xs text-muted-foreground">Trié par CA TTC décroissant sur la période</p>
    </div>

    <div v-if="sellers.length === 0" class="text-center py-12 text-sm text-muted-foreground">
      Aucune vente sur cette période
    </div>

    <Table v-else>
      <TableHeader>
        <TableRow>
          <TableHead class="w-10">#</TableHead>
          <TableHead>Vendeur</TableHead>
          <TableHead class="text-right">Tickets</TableHead>
          <TableHead class="text-right">Articles</TableHead>
          <TableHead class="text-right">Panier moyen</TableHead>
          <TableHead class="text-right">Marge €</TableHead>
          <TableHead class="text-right">Marge %</TableHead>
          <TableHead class="text-right w-[200px]">CA TTC</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="(seller, i) in sellers" :key="seller.sellerId">
          <TableCell class="font-mono text-xs">
            <Trophy v-if="i === 0" class="w-4 h-4 text-amber-500 inline" />
            <span v-else>{{ i + 1 }}</span>
          </TableCell>
          <TableCell class="font-medium">{{ seller.sellerName }}</TableCell>
          <TableCell class="text-right tabular-nums">{{ seller.ticketCount }}</TableCell>
          <TableCell class="text-right tabular-nums text-muted-foreground">{{ seller.totalQuantity }}</TableCell>
          <TableCell class="text-right tabular-nums">{{ fmtEur(seller.avgBasketValue) }} €</TableCell>
          <TableCell class="text-right tabular-nums">{{ fmtEur(seller.totalMargin) }} €</TableCell>
          <TableCell class="text-right tabular-nums">
            <span v-if="seller.marginPct === null" class="text-muted-foreground">—</span>
            <span v-else>{{ seller.marginPct.toFixed(2) }} %</span>
          </TableCell>
          <TableCell class="text-right">
            <div class="flex items-center gap-2 justify-end">
              <div class="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[120px]">
                <div
                  class="h-full bg-blue-500 transition-all"
                  :style="{ width: `${pctOfMax(seller.totalTTC)}%` }"
                />
              </div>
              <span class="tabular-nums font-medium whitespace-nowrap">{{ fmtEur(seller.totalTTC) }} €</span>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
