<script setup lang="ts">
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface DormantRow {
  productId: number
  productName: string
  price: number
  purchasePrice: number | null
  lastUpdate: string | Date
}

defineProps<{
  items: DormantRow[]
}>()

function fmtEur(n: number): string {
  return n.toFixed(2)
}

function fmtDate(d: string | Date): string {
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div v-if="items.length === 0" class="text-center py-12 text-sm text-muted-foreground">
    Aucun produit dormant sur cette période — tous les produits actifs ont été vendus
  </div>

  <Table v-else>
    <TableHeader>
      <TableRow>
        <TableHead>Produit</TableHead>
        <TableHead class="text-right">Prix de vente</TableHead>
        <TableHead class="text-right">Prix d'achat</TableHead>
        <TableHead class="text-right">Dernière maj</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow v-for="item in items" :key="item.productId">
        <TableCell class="font-medium">{{ item.productName }}</TableCell>
        <TableCell class="text-right tabular-nums">{{ fmtEur(item.price) }} €</TableCell>
        <TableCell class="text-right tabular-nums">
          <span v-if="item.purchasePrice === null" class="text-muted-foreground">—</span>
          <span v-else>{{ fmtEur(item.purchasePrice) }} €</span>
        </TableCell>
        <TableCell class="text-right text-muted-foreground text-xs">{{ fmtDate(item.lastUpdate) }}</TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>
