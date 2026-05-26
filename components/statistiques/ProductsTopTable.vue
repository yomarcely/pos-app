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

interface TopRow {
  productId: number
  productName: string
  quantity: number
  totalTTC: number
  totalHT: number
  totalMargin: number
  marginPct: number | null
}

const props = defineProps<{
  items: TopRow[]
}>()

const maxTTC = computed(() => Math.max(...props.items.map(r => r.totalTTC), 1))

function fmtEur(n: number): string {
  return n.toFixed(2)
}

function pctOfMax(ttc: number): number {
  return (ttc / maxTTC.value) * 100
}
</script>

<template>
  <div v-if="items.length === 0" class="text-center py-12 text-sm text-muted-foreground">
    Aucune vente sur cette période
  </div>

  <Table v-else>
    <TableHeader>
      <TableRow>
        <TableHead class="w-10">#</TableHead>
        <TableHead>Produit</TableHead>
        <TableHead class="text-right">Qté vendue</TableHead>
        <TableHead class="text-right">Marge €</TableHead>
        <TableHead class="text-right">Marge %</TableHead>
        <TableHead class="text-right w-[220px]">CA TTC</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow v-for="(item, i) in items" :key="item.productId">
        <TableCell class="font-mono text-xs">
          <Trophy v-if="i === 0" class="w-4 h-4 text-amber-500 inline" />
          <span v-else>{{ i + 1 }}</span>
        </TableCell>
        <TableCell class="font-medium">{{ item.productName }}</TableCell>
        <TableCell class="text-right tabular-nums">{{ item.quantity }}</TableCell>
        <TableCell class="text-right tabular-nums">{{ fmtEur(item.totalMargin) }} €</TableCell>
        <TableCell class="text-right tabular-nums">
          <span v-if="item.marginPct === null" class="text-muted-foreground">—</span>
          <span v-else>{{ item.marginPct.toFixed(2) }} %</span>
        </TableCell>
        <TableCell class="text-right">
          <div class="flex items-center gap-2 justify-end">
            <div class="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[120px]">
              <div
                class="h-full bg-blue-500 transition-all"
                :style="{ width: `${pctOfMax(item.totalTTC)}%` }"
              />
            </div>
            <span class="tabular-nums font-medium whitespace-nowrap">{{ fmtEur(item.totalTTC) }} €</span>
          </div>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>
