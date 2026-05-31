<template>
  <div class="p-6 space-y-6">
    <PageHeader
      title="Inventaire"
      description="Consolider une ou plusieurs préparations pour ajuster le stock"
    />

    <!-- Liste des préparations en attente -->
    <Card>
      <CardHeader class="flex flex-row items-center justify-between">
        <CardTitle>Préparations à valider</CardTitle>
        <Button variant="ghost" size="sm" @click="loadPreparations" :disabled="loadingList">
          <RefreshCcw class="w-4 h-4 mr-1" />
          Recharger
        </Button>
      </CardHeader>
      <CardContent>
        <div v-if="loadingList" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>

        <div v-else-if="draftPreparations.length === 0" class="py-8 text-center text-muted-foreground">
          Aucune préparation en attente. Crée-en une depuis
          <NuxtLink to="/mouvements" class="underline">/mouvements → Préparation inventaire</NuxtLink>.
        </div>

        <div v-else class="space-y-3">
          <label
            v-for="prep in draftPreparations"
            :key="prep.id"
            class="flex items-center gap-3 p-3 rounded-md border hover:bg-muted/30 cursor-pointer"
          >
            <Checkbox
              :model-value="selectedIds.has(prep.id)"
              @update:model-value="() => toggleSelected(prep.id)"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-mono text-xs">{{ prep.preparationNumber }}</span>
                <span v-if="prep.name" class="font-medium truncate">{{ prep.name }}</span>
              </div>
              <div class="text-xs text-muted-foreground">
                {{ prep.itemCount }} ligne{{ prep.itemCount > 1 ? 's' : '' }}
                · {{ prep.establishmentName || 'Sans établissement' }}
                · {{ formatDateTime(prep.createdAt) }}
              </div>
            </div>
          </label>

          <div class="flex justify-end gap-2 pt-2">
            <Button variant="outline" :disabled="selectedIds.size === 0" @click="clearSelection">
              Tout désélectionner
            </Button>
            <Button :disabled="selectedIds.size === 0 || previewing" @click="loadPreview">
              {{ previewing ? 'Calcul...' : `Valider la sélection (${selectedIds.size})` }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Conflits -->
    <Card v-if="conflicts && conflicts.length > 0" class="border-destructive">
      <CardHeader>
        <CardTitle class="text-destructive flex items-center gap-2">
          <AlertTriangle class="w-5 h-5" />
          Conflit de comptage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p class="text-sm mb-3">
          Certains articles sont comptés différemment entre les préparations sélectionnées.
          Modifie ou supprime une des préparations puis recalcule.
        </p>
        <ul class="text-sm space-y-2">
          <li v-for="(c, idx) in conflicts" :key="idx" class="border rounded p-2">
            <div>
              <span class="font-medium">Produit #{{ c.productId }}</span>
              <span v-if="c.variation" class="text-muted-foreground"> ({{ c.variation }})</span>
            </div>
            <ul class="text-xs text-muted-foreground mt-1 ml-3 list-disc">
              <li v-for="(count, i) in c.counts" :key="i">
                {{ count.preparationNumber }} : compté {{ count.countedStock }}
              </li>
            </ul>
          </li>
        </ul>
      </CardContent>
    </Card>

    <!-- 3 tableaux d'aperçu -->
    <template v-if="preview">
      <!-- Tableau 1 : inventoriés -->
      <Card>
        <CardHeader>
          <CardTitle>Articles inventoriés ({{ preview.inventoried.length }})</CardTitle>
        </CardHeader>
        <CardContent>
          <div v-if="preview.inventoried.length === 0" class="py-6 text-center text-muted-foreground">
            Aucun article dans les préparations sélectionnées.
          </div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted/50 border-b">
                <tr>
                  <th class="px-3 py-2 text-left">Produit</th>
                  <th class="px-3 py-2 text-left">Variation</th>
                  <th class="px-3 py-2 text-center">Stock actuel</th>
                  <th class="px-3 py-2 text-center">Stock compté</th>
                  <th class="px-3 py-2 text-center">Écart</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="row in preview.inventoried" :key="`inv-${row.productId}-${row.variation}`">
                  <td class="px-3 py-2">{{ row.productName }}</td>
                  <td class="px-3 py-2 text-muted-foreground">{{ row.variation || '—' }}</td>
                  <td class="px-3 py-2 text-center">{{ row.currentStock }}</td>
                  <td class="px-3 py-2 text-center font-medium">{{ row.countedStock }}</td>
                  <td
                    class="px-3 py-2 text-center font-medium"
                    :class="deltaClass(row.delta)"
                  >
                    {{ row.delta > 0 ? '+' : '' }}{{ row.delta }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <!-- Tableau 2 : non inventoriés avec stock > 0 -->
      <Card>
        <CardHeader class="flex flex-row items-center justify-between">
          <CardTitle>Non inventoriés (stock &gt; 0) — {{ preview.notInventoriedPositive.length }}</CardTitle>
          <Button
            v-if="preview.notInventoriedPositive.length > 0"
            size="sm"
            variant="outline"
            @click="toggleAllSetToZero"
          >
            {{ allSetToZeroSelected ? 'Désélectionner tous' : 'Tout sélectionner (mettre à zéro)' }}
          </Button>
        </CardHeader>
        <CardContent>
          <div v-if="preview.notInventoriedPositive.length === 0" class="py-6 text-center text-muted-foreground">
            Aucun article non inventorié avec stock positif.
          </div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted/50 border-b">
                <tr>
                  <th class="px-3 py-2 w-8"></th>
                  <th class="px-3 py-2 text-left">Produit</th>
                  <th class="px-3 py-2 text-left">Variation</th>
                  <th class="px-3 py-2 text-center">Stock actuel</th>
                  <th class="px-3 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="row in preview.notInventoriedPositive" :key="`pos-${row.productId}-${row.variation}`">
                  <td class="px-3 py-2 text-center">
                    <Checkbox
                      :model-value="setToZeroKeys.has(rowKey(row))"
                      @update:model-value="() => toggleSetToZero(rowKey(row))"
                    />
                  </td>
                  <td class="px-3 py-2">{{ row.productName }}</td>
                  <td class="px-3 py-2 text-muted-foreground">{{ row.variation || '—' }}</td>
                  <td class="px-3 py-2 text-center">{{ row.stock }}</td>
                  <td class="px-3 py-2 text-center text-xs text-muted-foreground">
                    <span v-if="setToZeroKeys.has(rowKey(row))" class="text-destructive">→ 0 (perte)</span>
                    <span v-else>Stock inchangé</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <!-- Tableau 3 : non inventoriés stock <= 0 -->
      <Card>
        <CardHeader class="flex flex-row items-center justify-between">
          <CardTitle>Non inventoriés (stock ≤ 0) — {{ preview.notInventoriedNonPositive.length }}</CardTitle>
          <Button
            v-if="archivableCount > 0"
            size="sm"
            variant="outline"
            @click="toggleAllArchive"
          >
            {{ allArchiveSelected ? 'Désélectionner tous' : `Archiver tous les stock=0 (${archivableCount})` }}
          </Button>
        </CardHeader>
        <CardContent>
          <div v-if="preview.notInventoriedNonPositive.length === 0" class="py-6 text-center text-muted-foreground">
            Aucun article non inventorié avec stock ≤ 0.
          </div>
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted/50 border-b">
                <tr>
                  <th class="px-3 py-2 w-8"></th>
                  <th class="px-3 py-2 text-left">Produit</th>
                  <th class="px-3 py-2 text-left">Variation</th>
                  <th class="px-3 py-2 text-center">Stock actuel</th>
                  <th class="px-3 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="row in preview.notInventoriedNonPositive" :key="`nonpos-${row.productId}-${row.variation}`">
                  <td class="px-3 py-2 text-center">
                    <Checkbox
                      v-if="row.stock === 0"
                      :model-value="archiveKeys.has(rowKey(row))"
                      @update:model-value="() => toggleArchive(rowKey(row))"
                    />
                  </td>
                  <td class="px-3 py-2">{{ row.productName }}</td>
                  <td class="px-3 py-2 text-muted-foreground">{{ row.variation || '—' }}</td>
                  <td
                    class="px-3 py-2 text-center font-medium"
                    :class="row.stock < 0 ? 'text-red-600' : 'text-muted-foreground'"
                  >
                    {{ row.stock }}
                  </td>
                  <td class="px-3 py-2 text-center text-xs">
                    <span v-if="row.stock < 0" class="text-amber-600">
                      Stock négatif — à investiguer
                    </span>
                    <span v-else-if="archiveKeys.has(rowKey(row))" class="text-destructive">
                      → archivé
                    </span>
                    <span v-else class="text-muted-foreground">Stock inchangé</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <!-- Erreurs archivage (réponse 409) -->
      <Card v-if="archiveErrors && archiveErrors.length > 0" class="border-destructive">
        <CardHeader>
          <CardTitle class="text-destructive flex items-center gap-2">
            <AlertTriangle class="w-5 h-5" />
            Archivage refusé
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p class="text-sm mb-3">
            Ces articles n'ont plus un stock à 0 au moment de la validation.
            Recalcule l'aperçu avant de réessayer.
          </p>
          <ul class="text-sm space-y-1">
            <li v-for="e in archiveErrors" :key="e.productId" class="border rounded p-2">
              <span class="font-medium">{{ e.name }}</span>
              — stock actuel :
              <span class="font-mono">{{ e.currentStock }}</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <!-- Validation finale -->
      <Card>
        <CardContent class="py-4 flex justify-between items-center">
          <div class="text-sm text-muted-foreground">
            <span class="font-medium text-foreground">{{ adjustmentCount }}</span> ajustements
            · <span class="font-medium text-foreground">{{ setToZeroKeys.size }}</span> mises à zéro
            · <span class="font-medium text-foreground">{{ archiveKeys.size }}</span> archivages
          </div>
          <Button
            :disabled="validating || (adjustmentCount + setToZeroKeys.size + archiveKeys.size) === 0"
            @click="confirmDialogOpen = true"
          >
            {{ validating ? 'Validation...' : "Valider l'inventaire" }}
          </Button>
        </CardContent>
      </Card>

      <!-- Dialog confirmation -->
      <AlertDialog v-model:open="confirmDialogOpen">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Valider l'inventaire ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive :
              <ul class="list-disc ml-5 mt-2 space-y-0.5">
                <li>{{ adjustmentCount }} ajustement(s) de stock seront appliqué(s)</li>
                <li v-if="setToZeroKeys.size > 0">{{ setToZeroKeys.size }} article(s) passeront à 0 (perte)</li>
                <li v-if="archiveKeys.size > 0">{{ archiveKeys.size }} article(s) seront archivé(s)</li>
                <li>Les préparations sélectionnées seront marquées comme validées</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel @click="confirmDialogOpen = false">Annuler</AlertDialogCancel>
            <AlertDialogAction :disabled="validating" @click="handleValidate">
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AlertTriangle, RefreshCcw } from 'lucide-vue-next'
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
import { Checkbox } from '@/components/ui/checkbox'
import PageHeader from '@/components/common/PageHeader.vue'
import { useInventoryValidation, type NotInventoriedRow } from '@/composables/useInventoryValidation'
import { formatDateTime } from '@/utils/formatters'

definePageMeta({
  layout: 'dashboard',
})

const {
  preparations,
  loadingList,
  selectedIds,
  preview,
  previewing,
  conflicts,
  validating,
  archiveErrors,
  loadPreparations,
  toggleSelected,
  clearSelection,
  loadPreview,
  validate,
} = useInventoryValidation()

const draftPreparations = computed(() =>
  preparations.value.filter((p) => p.status === 'draft'),
)

// Sélection des lignes à mettre à zéro / archiver (futur step 4)
const setToZeroKeys = ref<Set<string>>(new Set())
const archiveKeys = ref<Set<string>>(new Set())

function rowKey(row: NotInventoriedRow): string {
  return `${row.productId}|${row.variation ?? ''}`
}

function toggleSetToZero(key: string) {
  const next = new Set(setToZeroKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  setToZeroKeys.value = next
}

function toggleArchive(key: string) {
  const next = new Set(archiveKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  archiveKeys.value = next
}

const allSetToZeroSelected = computed(() =>
  preview.value !== null &&
  preview.value.notInventoriedPositive.length > 0 &&
  preview.value.notInventoriedPositive.every((r) => setToZeroKeys.value.has(rowKey(r))),
)

function toggleAllSetToZero() {
  if (!preview.value) return
  if (allSetToZeroSelected.value) {
    setToZeroKeys.value = new Set()
  } else {
    setToZeroKeys.value = new Set(preview.value.notInventoriedPositive.map(rowKey))
  }
}

const archivableCount = computed(() =>
  preview.value?.notInventoriedNonPositive.filter((r) => r.stock === 0).length || 0,
)

const allArchiveSelected = computed(() =>
  preview.value !== null &&
  archivableCount.value > 0 &&
  preview.value.notInventoriedNonPositive
    .filter((r) => r.stock === 0)
    .every((r) => archiveKeys.value.has(rowKey(r))),
)

function toggleAllArchive() {
  if (!preview.value) return
  const zeroRows = preview.value.notInventoriedNonPositive.filter((r) => r.stock === 0)
  if (allArchiveSelected.value) {
    archiveKeys.value = new Set()
  } else {
    archiveKeys.value = new Set(zeroRows.map(rowKey))
  }
}

function deltaClass(delta: number): string {
  if (delta === 0) return 'text-muted-foreground'
  return delta > 0 ? 'text-green-600' : 'text-red-600'
}

// Compte les ajustements qui généreront un mouvement (delta != 0)
const adjustmentCount = computed(() =>
  preview.value?.inventoried.filter((r) => r.delta !== 0).length || 0,
)

// Confirmation + validation finale
const confirmDialogOpen = ref(false)

async function handleValidate() {
  if (!preview.value) return
  const setToZeroItems = preview.value.notInventoriedPositive
    .filter((r) => setToZeroKeys.value.has(rowKey(r)))
    .map((r) => ({ productId: r.productId, variation: r.variation }))
  const archiveProductIds = Array.from(
    new Set(
      preview.value.notInventoriedNonPositive
        .filter((r) => r.stock === 0 && archiveKeys.value.has(rowKey(r)))
        .map((r) => r.productId),
    ),
  )
  confirmDialogOpen.value = false
  const result = await validate({ setToZeroItems, archiveProductIds })
  if (result.success) {
    setToZeroKeys.value = new Set()
    archiveKeys.value = new Set()
  }
}

onMounted(loadPreparations)
</script>
