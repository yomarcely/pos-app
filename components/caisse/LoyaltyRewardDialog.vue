<script setup lang="ts">
import { computed } from 'vue'
import { Star, Gift, Euro, Percent, Ticket } from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { LoyaltyRewardType } from '@/composables/useLoyaltyForCustomer'

const props = defineProps<{
  open: boolean
  customerName: string
  pointsCurrent: number
  pointsRequired: number
  rewardType: LoyaltyRewardType
  rewardValue: number
}>()

defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'apply'): void
  (e: 'decline'): void
}>()

const rewardLabel = computed(() => {
  if (props.rewardType === 'percent_discount') return `${props.rewardValue}% de remise immédiate`
  if (props.rewardType === 'euro_discount') return `${props.rewardValue.toFixed(2)} € de rabais immédiat`
  return `Bon d'achat de ${props.rewardValue.toFixed(2)} € (utilisable plus tard)`
})

const rewardIcon = computed(() => {
  if (props.rewardType === 'percent_discount') return Percent
  if (props.rewardType === 'euro_discount') return Euro
  return Ticket
})
</script>

<template>
  <Dialog :open="open" @update:open="(v) => $emit('update:open', v)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <div class="flex flex-col items-center gap-3 pt-2">
          <div class="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
            <Star class="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle class="text-center text-xl">Avantage fidélité disponible</DialogTitle>
          <DialogDescription class="text-center">
            <span class="font-semibold">{{ customerName }}</span> a accumulé
            <span class="font-mono font-semibold">{{ pointsCurrent }}</span>
            point{{ pointsCurrent > 1 ? 's' : '' }} (seuil : {{ pointsRequired }}).
          </DialogDescription>
        </div>
      </DialogHeader>

      <div class="my-4 rounded-lg border bg-muted/30 p-4">
        <div class="flex items-center gap-3">
          <component :is="rewardIcon" class="h-6 w-6 text-amber-600" />
          <div>
            <div class="text-sm text-muted-foreground">Avantage déclenché</div>
            <div class="text-lg font-semibold">{{ rewardLabel }}</div>
          </div>
        </div>
      </div>

      <p class="text-sm text-muted-foreground text-center">
        Le client souhaite-t-il utiliser son avantage maintenant&nbsp;? <br>
        <span class="text-xs">{{ pointsRequired }} points seront consommés.</span>
      </p>

      <DialogFooter class="grid grid-cols-2 gap-2 mt-2">
        <Button variant="outline" @click="$emit('decline')">
          Plus tard
        </Button>
        <Button @click="$emit('apply')">
          <Gift class="h-4 w-4 mr-2" />
          Utiliser
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
