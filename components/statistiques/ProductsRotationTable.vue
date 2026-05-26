<script setup lang="ts">
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertTriangle } from 'lucide-vue-next'

interface RotationRow {
  productId: number
  productName: string
  quantitySold: number
  currentStock: number
  velocityPerDay: number
  daysToSellout: number | null
}

defineProps<{
  items: RotationRow[]
}>()

function rotationBadge(days: number | null): { label: string; class: string; icon: boolean } {
  if (days === null) return { label: '—', class: 'text-muted-foreground', icon: false }
  if (days > 180) return { label: `${days.toFixed(0)} j`, class: 'text-red-600 font-semibold', icon: true }
  if (days > 90) return { label: `${days.toFixed(0)} j`, class: 'text-amber-600', icon: false }
  return { label: `${days.toFixed(0)} j`, class: 'text-emerald-600', icon: false }
}
</script>

<template>
  <div v-if="items.length === 0" class="text-center py-12 text-sm text-muted-foreground">
    Aucun produit vendu avec stock disponible sur cette période
  </div>

  <Table v-else>
    <TableHeader>
      <TableRow>
        <TableHead>Produit</TableHead>
        <TableHead class="text-right">Vendus (période)</TableHead>
        <TableHead class="text-right">Vélocité / jour</TableHead>
        <TableHead class="text-right">Stock actuel</TableHead>
        <TableHead class="text-right">Jours d'écoulement</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow v-for="item in items" :key="item.productId">
        <TableCell class="font-medium">{{ item.productName }}</TableCell>
        <TableCell class="text-right tabular-nums">{{ item.quantitySold }}</TableCell>
        <TableCell class="text-right tabular-nums text-muted-foreground">{{ item.velocityPerDay.toFixed(2) }}</TableCell>
        <TableCell class="text-right tabular-nums">{{ item.currentStock }}</TableCell>
        <TableCell class="text-right tabular-nums">
          <span :class="rotationBadge(item.daysToSellout).class">
            <AlertTriangle v-if="rotationBadge(item.daysToSellout).icon" class="w-3.5 h-3.5 inline mr-1" />
            {{ rotationBadge(item.daysToSellout).label }}
          </span>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>
