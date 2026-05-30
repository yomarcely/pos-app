<template>
  <div class="p-6 space-y-6">
    <PageHeader
      title="Historique des mouvements"
      description="Consulter, modifier ou supprimer les mouvements de stock"
    />

    <!-- Filtres -->
    <Card>
      <CardHeader>
        <CardTitle>Filtres</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <div>
          <Label class="mb-2 block text-sm">Période</Label>
          <PeriodPicker v-model="period" />
        </div>
        <div>
          <Label class="mb-2 block text-sm">Type de mouvement</Label>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="opt in typeOptions"
              :key="opt.value"
              size="sm"
              :variant="typeFilter === opt.value ? 'default' : 'outline'"
              :disabled="opt.disabled"
              @click="typeFilter = opt.value"
            >
              {{ opt.label }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Tableau -->
    <Card>
      <CardHeader>
        <CardTitle>
          Mouvements ({{ movements.length }})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div v-if="loading" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>

        <div v-else-if="movements.length === 0" class="py-12 text-center text-muted-foreground">
          Aucun mouvement sur la période et le filtre sélectionnés.
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 border-b">
              <tr>
                <th class="px-3 py-2 w-8"></th>
                <th class="px-3 py-2 text-left">Date</th>
                <th class="px-3 py-2 text-left">N°</th>
                <th class="px-3 py-2 text-left">Type</th>
                <th class="px-3 py-2 text-left">Fournisseur / BL</th>
                <th class="px-3 py-2 text-center">Articles</th>
                <th class="px-3 py-2 text-left">Établissement</th>
                <th class="px-3 py-2 text-center w-32">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <template v-for="movement in movements" :key="movement.id">
                <tr class="hover:bg-muted/30">
                  <td class="px-3 py-2 text-center">
                    <button
                      type="button"
                      class="text-muted-foreground hover:text-foreground"
                      @click="toggleExpanded(movement.id)"
                    >
                      <ChevronRight
                        class="w-4 h-4 transition-transform"
                        :class="expanded.has(movement.id) ? 'rotate-90' : ''"
                      />
                    </button>
                  </td>
                  <td class="px-3 py-2 whitespace-nowrap">{{ formatDateTime(movement.createdAt) }}</td>
                  <td class="px-3 py-2 font-mono text-xs">{{ movement.movementNumber }}</td>
                  <td class="px-3 py-2">
                    <span
                      :class="[
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        typeBadgeClass(movement),
                      ]"
                    >
                      {{ typeLabel(movement) }}
                    </span>
                  </td>
                  <td class="px-3 py-2 text-muted-foreground">
                    <div v-if="movement.supplierName">
                      <div class="font-medium text-foreground">{{ movement.supplierName }}</div>
                      <div v-if="movement.deliveryNoteNumber" class="text-xs">
                        BL: {{ movement.deliveryNoteNumber }}
                      </div>
                    </div>
                    <span v-else>—</span>
                  </td>
                  <td class="px-3 py-2 text-center">
                    <span class="px-2 py-0.5 rounded-full text-xs bg-muted">
                      {{ movement.itemCount }} ligne{{ movement.itemCount > 1 ? 's' : '' }}
                    </span>
                  </td>
                  <td class="px-3 py-2 text-muted-foreground">
                    {{ movement.establishmentName || '—' }}
                  </td>
                  <td class="px-3 py-2">
                    <div class="flex justify-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Modifier"
                        :disabled="savingId === movement.id"
                        @click="askEdit(movement)"
                      >
                        <Pencil class="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Supprimer"
                        :disabled="deletingId === movement.id"
                        @click="askDelete(movement)"
                      >
                        <Trash2 class="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
                <tr v-if="expanded.has(movement.id)" class="bg-muted/20">
                  <td colspan="8" class="px-6 py-3">
                    <div v-if="movement.comment" class="mb-2 text-sm">
                      <span class="font-medium">Commentaire : </span>
                      <span class="text-muted-foreground">{{ movement.comment }}</span>
                    </div>
                    <table class="w-full text-xs">
                      <thead>
                        <tr class="border-b">
                          <th class="px-2 py-1 text-left">Produit</th>
                          <th class="px-2 py-1 text-left">Variation</th>
                          <th class="px-2 py-1 text-center">Quantité</th>
                          <th class="px-2 py-1 text-center">Stock avant</th>
                          <th class="px-2 py-1 text-center">Stock après</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="line in movement.items" :key="line.id">
                          <td class="px-2 py-1">{{ line.productName }}</td>
                          <td class="px-2 py-1 text-muted-foreground">{{ line.variation || '—' }}</td>
                          <td
                            class="px-2 py-1 text-center font-medium"
                            :class="line.quantity >= 0 ? 'text-green-600' : 'text-red-600'"
                          >
                            {{ line.quantity > 0 ? '+' : '' }}{{ line.quantity }}
                          </td>
                          <td class="px-2 py-1 text-center text-muted-foreground">{{ line.oldStock }}</td>
                          <td class="px-2 py-1 text-center font-medium">{{ line.newStock }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <!-- Sheet édition -->
    <EditMovementSheet
      v-model:open="editSheetOpen"
      :movement="editingMovement"
      :suppliers="supplierOptions"
      :saving="savingId !== null"
      @save="handleSaveEdit"
    />

    <!-- Dialog confirmation suppression -->
    <AlertDialog v-model:open="deleteDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer le mouvement ?</AlertDialogTitle>
          <AlertDialogDescription>
            <span v-if="pendingDelete" class="block space-y-1">
              <span class="block">
                <span class="font-mono text-xs">{{ pendingDelete.movementNumber }}</span>
                — {{ typeLabel(pendingDelete) }}
              </span>
              <span class="block">
                {{ pendingDelete.itemCount }} ligne{{ pendingDelete.itemCount > 1 ? 's' : '' }},
                stock restauré (le stock peut devenir négatif si des ventes ont eu lieu après).
              </span>
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="cancelDelete">Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            :disabled="deletingId !== null"
            @click="confirmDelete"
          >
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ChevronRight, Pencil, Trash2 } from 'lucide-vue-next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import PageHeader from '@/components/common/PageHeader.vue'
import PeriodPicker from '@/components/statistiques/PeriodPicker.vue'
import EditMovementSheet, { type SavePayload } from '@/components/mouvements/EditMovementSheet.vue'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import {
  useMovementHistory,
  type MovementHistoryEntry,
  type MovementHistoryFilter,
} from '@/composables/useMovementHistory'
import { useSuppliers } from '@/composables/useSuppliers'
import { formatDateTime } from '@/utils/formatters'

definePageMeta({
  layout: 'dashboard',
})

const { selectedEstablishmentId, initialize: initializeEstablishments } = useEstablishmentRegister()

// Période par défaut : 30 derniers jours
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
const today = new Date()
const thirtyDaysAgo = new Date(today)
thirtyDaysAgo.setDate(today.getDate() - 29)

const period = ref({
  startDate: isoDate(thirtyDaysAgo),
  endDate: isoDate(today),
})

const typeFilter = ref<MovementHistoryFilter>('all')

const typeOptions: Array<{ value: MovementHistoryFilter; label: string; disabled?: boolean }> = [
  { value: 'all', label: 'Tous' },
  { value: 'reception-supplier', label: 'Réception fournisseur' },
  { value: 'reception-free', label: 'Entrée/Sortie libre' },
  { value: 'adjustment', label: 'Ajustement' },
  { value: 'loss', label: 'Perte' },
]

const { movements, loading, loadHistory, deleteMovement, updateMovement } = useMovementHistory(period, typeFilter, selectedEstablishmentId)
const { suppliers, loadSuppliers } = useSuppliers()
const supplierOptions = computed(() => suppliers.value.map((s) => ({ id: s.id, name: s.name })))

const expanded = ref<Set<number>>(new Set())
function toggleExpanded(id: number) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

function typeLabel(m: MovementHistoryEntry): string {
  if (m.type === 'reception') return m.supplierId ? 'Réception fournisseur' : 'Entrée libre'
  if (m.type === 'adjustment') return 'Ajustement'
  if (m.type === 'loss') return 'Perte'
  if (m.type === 'transfer') return 'Transfert'
  return m.type
}

function typeBadgeClass(m: MovementHistoryEntry): string {
  if (m.type === 'reception' && m.supplierId)
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
  if (m.type === 'reception')
    return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
  if (m.type === 'adjustment')
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
  if (m.type === 'loss')
    return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
  return 'bg-muted text-muted-foreground'
}

// Édition
const editSheetOpen = ref(false)
const editingMovement = ref<MovementHistoryEntry | null>(null)
const savingId = ref<number | null>(null)

function askEdit(movement: MovementHistoryEntry) {
  editingMovement.value = movement
  editSheetOpen.value = true
}

async function handleSaveEdit(payload: SavePayload) {
  if (!editingMovement.value) return
  const id = editingMovement.value.id
  savingId.value = id
  const ok = await updateMovement(id, payload)
  savingId.value = null
  if (ok) {
    editSheetOpen.value = false
    editingMovement.value = null
  }
}

// Suppression
const deleteDialogOpen = ref(false)
const pendingDelete = ref<MovementHistoryEntry | null>(null)
const deletingId = ref<number | null>(null)

function askDelete(movement: MovementHistoryEntry) {
  pendingDelete.value = movement
  deleteDialogOpen.value = true
}

function cancelDelete() {
  deleteDialogOpen.value = false
  pendingDelete.value = null
}

async function confirmDelete() {
  if (!pendingDelete.value) return
  const id = pendingDelete.value.id
  deletingId.value = id
  const ok = await deleteMovement(id)
  deletingId.value = null
  deleteDialogOpen.value = false
  pendingDelete.value = null
  if (ok) {
    const next = new Set(expanded.value)
    next.delete(id)
    expanded.value = next
  }
}

// Debounce léger pour éviter spam de requêtes au scrub des dates
let reloadTimer: ReturnType<typeof setTimeout> | undefined
function scheduleReload() {
  clearTimeout(reloadTimer)
  reloadTimer = setTimeout(loadHistory, 150)
}

watch([period, typeFilter, selectedEstablishmentId], scheduleReload, { deep: true })

onMounted(async () => {
  await initializeEstablishments()
  await Promise.all([loadHistory(), loadSuppliers()])
})
</script>
