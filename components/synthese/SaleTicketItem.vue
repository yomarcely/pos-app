<template>
  <Collapsible>
    <div
      :class="[
        'flex items-center justify-between p-3 border rounded-lg transition-colors',
        sale.status === 'cancelled'
          ? 'bg-destructive/5 hover:bg-destructive/10'
          : 'bg-card hover:bg-muted/50'
      ]"
    >
      <div class="flex items-center gap-3 flex-1">
        <CollapsibleTrigger @click="toggleExpand" class="p-1 hover:bg-muted rounded">
          <ChevronDown v-if="isExpanded" class="w-4 h-4" />
          <ChevronRight v-else class="w-4 h-4" />
        </CollapsibleTrigger>

        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span
              :class="[
                'font-medium text-sm',
                sale.status === 'cancelled' ? 'line-through text-muted-foreground' : ''
              ]"
            >
              {{ sale.ticketNumber }}
            </span>
            <Badge
              :variant="sale.status === 'cancelled' ? 'destructive' : 'default'"
              class="text-xs"
            >
              {{ sale.status === 'cancelled' ? 'Annulé' : 'Actif' }}
            </Badge>
          </div>
          <p v-if="sale.status === 'cancelled'" class="text-xs text-destructive">
            {{ sale.cancellationReason }}
          </p>
          <p v-else class="text-xs text-muted-foreground">
            {{ new Date(sale.saleDate).toLocaleTimeString('fr-FR') }}
          </p>
        </div>

        <div class="text-right" :class="{ 'opacity-50': sale.status === 'cancelled' }">
          <p
            :class="[
              'font-bold text-sm',
              sale.status === 'cancelled' ? 'line-through' : ''
            ]"
          >
            {{ sale.totalTTC.toFixed(2) }} €
          </p>
          <p class="text-xs text-muted-foreground">{{ sale.items.length }} art.</p>
        </div>

        <Button
          v-if="sale.status !== 'cancelled' && !isClosed"
          variant="ghost"
          size="sm"
          @click="$emit('cancel', sale)"
          class="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
        >
          <Trash2 class="w-3 h-3" />
        </Button>
      </div>
    </div>

    <CollapsibleContent v-if="isExpanded" class="pt-2 px-3 pb-3">
      <div
        :class="[
          'border rounded-lg p-3 space-y-2',
          sale.status === 'cancelled' ? 'bg-muted/30' : 'bg-muted/30'
        ]"
      >
        <!-- Annulation info -->
        <div v-if="sale.status === 'cancelled'" class="bg-destructive/10 p-2 rounded text-xs text-destructive mb-2">
          Annulée le {{ new Date(sale.cancelledAt).toLocaleString('fr-FR') }}
        </div>

        <!-- Détails -->
        <div v-if="sale.status !== 'cancelled'" class="grid grid-cols-3 gap-2 text-xs">
          <div>
            <span class="text-muted-foreground">HT:</span>
            <span class="font-medium ml-1">{{ sale.totalHT.toFixed(2) }} €</span>
          </div>
          <div>
            <span class="text-muted-foreground">TVA:</span>
            <span class="font-medium ml-1">{{ sale.totalTVA.toFixed(2) }} €</span>
          </div>
          <div v-if="sale.globalDiscount > 0">
            <span class="text-muted-foreground">Remise:</span>
            <span class="font-medium ml-1">{{ sale.globalDiscount }} {{ sale.globalDiscountType }}</span>
          </div>
        </div>

        <!-- Articles -->
        <div class="text-xs" :class="{ 'opacity-50': sale.status === 'cancelled' }">
          <p class="font-semibold mb-1">Articles:</p>
          <div class="space-y-1">
            <div v-for="item in sale.items" :key="item.id">
              <div class="flex justify-between">
                <span>
                  {{ item.productName }}
                  <span v-if="item.variation" class="text-muted-foreground">({{ item.variation }})</span>
                  <span v-if="item.discount && item.discount > 0" class="text-orange-600 text-[10px] italic ml-1">
                    (-{{ item.discount }}{{ item.discountType }})
                  </span>
                </span>
                <span>{{ item.quantity }} x {{ item.unitPrice.toFixed(2) }} € = {{ item.totalTTC.toFixed(2) }} €</span>
              </div>
              <div v-if="item.discount && item.discount > 0 && item.originalPrice" class="flex justify-end text-muted-foreground text-[10px]">
                Prix origine: {{ Number(item.originalPrice).toFixed(2) }} €
              </div>
            </div>
          </div>
        </div>

        <!-- Paiements -->
        <div v-if="sale.status !== 'cancelled'" class="flex gap-1">
          <Badge v-for="(payment, idx) in sale.payments" :key="idx" variant="secondary" class="text-xs">
            {{ payment.mode }}: {{ payment.amount.toFixed(2) }} €
          </Badge>
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

interface SaleItem {
  id: number
  productName: string
  variation?: string
  quantity: number
  unitPrice: number
  totalTTC: number
  discount?: number
  discountType?: string
  originalPrice?: number
}

interface Payment {
  mode: string
  amount: number
}

interface Sale {
  id: number
  ticketNumber: string
  saleDate: string
  status: 'completed' | 'cancelled'
  totalTTC: number
  totalHT: number
  totalTVA: number
  globalDiscount: number
  globalDiscountType?: string
  items: SaleItem[]
  payments: Payment[]
  cancellationReason?: string
  cancelledAt?: string
}

const props = defineProps<{
  sale: Sale
  isClosed: boolean
  defaultExpanded?: boolean
}>()

const emit = defineEmits<{
  'cancel': [sale: Sale]
}>()

const isExpanded = ref(props.defaultExpanded || false)

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}
</script>
