<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import SupplierCombobox from '@/components/mouvements/SupplierCombobox.vue'
import type { MovementHistoryEntry } from '@/composables/useMovementHistory'

interface SupplierOption {
  id: number
  name: string
}

const props = defineProps<{
  open: boolean
  movement: MovementHistoryEntry | null
  suppliers: SupplierOption[]
  saving?: boolean
}>()

export interface SavePayload {
  comment?: string | null
  supplierId?: number | null
  deliveryNoteNumber?: string | null
  lines: Array<{ id: number; quantity: number }>
}

const emit = defineEmits<{
  'update:open': [value: boolean]
  'save': [payload: SavePayload]
}>()

// État local du formulaire — réinitialisé à chaque ouverture
const comment = ref('')
const supplierId = ref<number | null>(null)
const deliveryNoteNumber = ref('')
const lineQuantities = ref<Record<number, number>>({})

const isReception = computed(() => props.movement?.type === 'reception')

watch(
  () => props.movement,
  (m) => {
    if (!m) return
    comment.value = m.comment ?? ''
    supplierId.value = m.supplierId
    deliveryNoteNumber.value = m.deliveryNoteNumber ?? ''
    const map: Record<number, number> = {}
    for (const line of m.items) {
      // Afficher la valeur absolue (le signe est géré côté backend)
      map[line.id] = Math.abs(line.quantity)
    }
    lineQuantities.value = map
  },
  { immediate: true },
)

function handleSave() {
  if (!props.movement) return
  const payload: SavePayload = {
    comment: comment.value.trim() || null,
    lines: props.movement.items.map((line) => ({
      id: line.id,
      quantity: lineQuantities.value[line.id] ?? Math.abs(line.quantity),
    })),
  }
  if (isReception.value) {
    payload.supplierId = supplierId.value
    payload.deliveryNoteNumber = deliveryNoteNumber.value.trim() || null
  }
  emit('save', payload)
}
</script>

<template>
  <Sheet :open="open" @update:open="$emit('update:open', $event)">
    <SheetContent class="w-full sm:max-w-lg flex flex-col">
      <SheetHeader>
        <SheetTitle>Modifier le mouvement</SheetTitle>
        <SheetDescription v-if="movement">
          <span class="font-mono text-xs">{{ movement.movementNumber }}</span>
          — {{ movement.itemCount }} ligne{{ movement.itemCount > 1 ? 's' : '' }}
        </SheetDescription>
      </SheetHeader>

      <div v-if="movement" class="flex-1 overflow-y-auto px-4 space-y-4">
        <div v-if="isReception" class="space-y-3">
          <div>
            <Label class="mb-1 block">Fournisseur</Label>
            <SupplierCombobox
              v-model="supplierId"
              :suppliers="suppliers"
              placeholder="Sélectionner un fournisseur..."
            />
          </div>
          <div>
            <Label for="edit-bl" class="mb-1 block">N° bon de livraison</Label>
            <Input id="edit-bl" v-model="deliveryNoteNumber" maxlength="100" />
          </div>
        </div>

        <div>
          <Label for="edit-comment" class="mb-1 block">Commentaire</Label>
          <textarea
            id="edit-comment"
            v-model="comment"
            class="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-sm"
            placeholder="Motif / notes..."
          ></textarea>
        </div>

        <div>
          <Label class="mb-2 block">Lignes</Label>
          <div class="border rounded-md divide-y">
            <div
              v-for="line in movement.items"
              :key="line.id"
              class="px-3 py-2 flex items-center justify-between gap-3"
            >
              <div class="min-w-0 flex-1">
                <div class="text-sm truncate">{{ line.productName }}</div>
                <div class="text-xs text-muted-foreground">
                  <span v-if="line.variation">{{ line.variation }} · </span>
                  <span :class="line.quantity >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ line.quantity > 0 ? '+' : '' }}{{ line.quantity }} (origine)
                  </span>
                </div>
              </div>
              <Input
                :model-value="lineQuantities[line.id]"
                type="number"
                min="0"
                class="w-24 text-right"
                @update:model-value="(v) => lineQuantities[line.id] = parseInt(v as string) || 0"
              />
            </div>
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            Saisir la nouvelle valeur absolue. Le signe d'origine (entrée/sortie/perte) est préservé.
          </p>
        </div>
      </div>

      <SheetFooter class="flex-row justify-end gap-2 border-t pt-4">
        <Button variant="outline" :disabled="saving" @click="$emit('update:open', false)">
          Annuler
        </Button>
        <Button :disabled="saving" @click="handleSave">
          {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
