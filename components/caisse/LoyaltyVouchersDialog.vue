<script setup lang="ts">
import { computed } from 'vue'
import { Ticket, Calendar } from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { LoyaltyVoucher } from '@/composables/useLoyaltyForCustomer'

const props = defineProps<{
  open: boolean
  vouchers: LoyaltyVoucher[]
  appliedIds: number[]
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'toggle', voucherId: number): void
  (e: 'close'): void
}>()

function isApplied(id: number): boolean {
  return props.appliedIds.includes(id)
}

function formatDate(date: string | Date | null): string {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

const totalSelected = computed(() =>
  props.vouchers
    .filter(v => isApplied(v.id))
    .reduce((sum, v) => sum + v.amount, 0),
)

function close() {
  emit('close')
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="(v) => $emit('update:open', v)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
            <Ticket class="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <DialogTitle>Bons d'achat disponibles</DialogTitle>
            <DialogDescription>
              {{ vouchers.length }} bon{{ vouchers.length > 1 ? 's' : '' }} actif{{ vouchers.length > 1 ? 's' : '' }} —
              cochez ceux à utiliser sur la vente.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div v-if="vouchers.length === 0" class="py-6 text-center text-sm text-muted-foreground">
        Aucun bon d'achat actif pour ce client.
      </div>

      <div v-else class="py-2 space-y-2 max-h-80 overflow-y-auto">
        <label
          v-for="voucher in vouchers"
          :key="voucher.id"
          class="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-muted/30 transition-colors"
          :class="isApplied(voucher.id) ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30' : ''"
        >
          <Checkbox
            :model-value="isApplied(voucher.id)"
            @update:model-value="$emit('toggle', voucher.id)"
          />
          <div class="flex-1 min-w-0">
            <div class="font-mono font-semibold tracking-wider">{{ voucher.code }}</div>
            <div v-if="voucher.expiresAt" class="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <Calendar class="h-3 w-3" />
              Valable jusqu'au {{ formatDate(voucher.expiresAt) }}
            </div>
          </div>
          <div class="font-semibold text-amber-700 dark:text-amber-400">
            {{ formatAmount(voucher.amount) }}
          </div>
        </label>
      </div>

      <div v-if="totalSelected > 0" class="flex items-center justify-between border-t pt-3 text-sm">
        <span class="text-muted-foreground">Total sélectionné</span>
        <span class="font-semibold">{{ formatAmount(totalSelected) }}</span>
      </div>

      <DialogFooter>
        <Button class="w-full" @click="close">Terminer</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
