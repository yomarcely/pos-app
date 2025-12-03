<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <PageHeader
      title="Historique des clôtures"
      :description="`${filteredCount} clôture(s)`"
    />

    <!-- Filtres -->
    <Card>
      <CardContent class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Date de début -->
          <div class="space-y-2">
            <Label for="startDate">Date de début</Label>
            <Input
              id="startDate"
              v-model="startDate"
              type="date"
              @change="loadClosures"
            />
          </div>

          <!-- Date de fin -->
          <div class="space-y-2">
            <Label for="endDate">Date de fin</Label>
            <Input
              id="endDate"
              v-model="endDate"
              type="date"
              @change="loadClosures"
            />
          </div>

          <!-- Bouton reset -->
          <div class="flex items-end">
            <Button variant="outline" @click="resetFilters" class="w-full">
              Réinitialiser
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Loading -->
    <LoadingSpinner v-if="loading" text="Chargement des clôtures..." />

    <!-- Tableau des clôtures -->
    <Card v-else-if="closures.length > 0">
      <CardContent class="p-0">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-muted/50 border-b">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Date
                </th>
                <th class="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Tickets
                </th>
                <th class="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Annulés
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Total HT
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  TVA
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Total TTC
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Modes de paiement
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr
                v-for="closure in closures"
                :key="closure.id"
                class="hover:bg-muted/50 transition-colors"
              >
                <td class="px-6 py-4 whitespace-nowrap font-medium">
                  {{ formatDate(closure.closureDate) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                  <span class="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                    {{ closure.ticketCount }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                  <span
                    v-if="closure.cancelledCount > 0"
                    class="px-2 py-1 text-xs rounded-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                  >
                    {{ closure.cancelledCount }}
                  </span>
                  <span v-else class="text-muted-foreground">-</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                  {{ formatPrice(closure.totalHT) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                  {{ formatPrice(closure.totalTVA) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right font-semibold">
                  {{ formatPrice(closure.totalTTC) }}
                </td>
                <td class="px-6 py-4">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="(amount, method) in closure.paymentMethods as Record<string, number>"
                      :key="method"
                      class="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                    >
                      {{ method }}: {{ formatPrice(amount) }}
                    </span>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                  <Button variant="ghost" size="sm" @click="viewDetails(closure)">
                    <Eye class="w-4 h-4" />
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <!-- État vide -->
    <EmptyState
      v-else-if="!loading && closures.length === 0"
      :icon="CalendarDays"
      title="Aucune clôture trouvée"
      :description="startDate || endDate ? 'Essayez de modifier les filtres de date' : 'Aucune journée n\'a encore été clôturée'"
    />

    <!-- Dialog détails clôture -->
    <Dialog v-model:open="isDetailsDialogOpen">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Détails de la clôture</DialogTitle>
          <DialogDescription v-if="selectedClosure">
            Journée du {{ formatDate(selectedClosure.closureDate) }}
          </DialogDescription>
        </DialogHeader>

        <div v-if="selectedClosure" class="space-y-4">
          <!-- Statistiques -->
          <div class="grid grid-cols-2 gap-4">
            <div class="border rounded-lg p-4">
              <p class="text-sm text-muted-foreground">Tickets vendus</p>
              <p class="text-2xl font-bold">{{ selectedClosure.ticketCount }}</p>
            </div>
            <div class="border rounded-lg p-4">
              <p class="text-sm text-muted-foreground">Tickets annulés</p>
              <p class="text-2xl font-bold text-red-600">{{ selectedClosure.cancelledCount }}</p>
            </div>
          </div>

          <!-- Totaux -->
          <div class="border rounded-lg p-4 space-y-2">
            <h3 class="font-semibold mb-2">Totaux</h3>
            <div class="flex justify-between">
              <span class="text-muted-foreground">Total HT</span>
              <span class="font-medium">{{ formatPrice(selectedClosure.totalHT) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">TVA</span>
              <span class="font-medium">{{ formatPrice(selectedClosure.totalTVA) }}</span>
            </div>
            <div class="flex justify-between border-t pt-2">
              <span class="font-semibold">Total TTC</span>
              <span class="font-bold text-lg">{{ formatPrice(selectedClosure.totalTTC) }}</span>
            </div>
          </div>

          <!-- Modes de paiement -->
          <div class="border rounded-lg p-4">
            <h3 class="font-semibold mb-2">Modes de paiement</h3>
            <div class="space-y-2">
              <div
                v-for="(amount, method) in selectedClosure.paymentMethods as Record<string, number>"
                :key="method"
                class="flex justify-between"
              >
                <span class="text-muted-foreground">{{ method }}</span>
                <span class="font-medium">{{ formatPrice(amount) }}</span>
              </div>
            </div>
          </div>

          <!-- Hash NF525 -->
          <div class="border rounded-lg p-4 bg-muted/50">
            <h3 class="font-semibold mb-2 text-xs uppercase text-muted-foreground">Hash NF525</h3>
            <p class="text-xs font-mono break-all">{{ selectedClosure.closureHash }}</p>
          </div>

          <!-- Dates -->
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-muted-foreground">Créée le</p>
              <p class="font-medium">{{ formatDateTime(selectedClosure.createdAt) }}</p>
            </div>
            <div v-if="selectedClosure.closedAt">
              <p class="text-muted-foreground">Clôturée le</p>
              <p class="font-medium">{{ formatDateTime(selectedClosure.closedAt) }}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="isDetailsDialogOpen = false">
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Eye, CalendarDays } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import PageHeader from '@/components/common/PageHeader.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { formatPrice, formatDate, formatDateTime } from '@/utils/formatters'

definePageMeta({
  layout: 'dashboard'
})

interface Closure {
  id: number
  closureDate: string
  ticketCount: number
  cancelledCount: number
  totalHT: string
  totalTVA: string
  totalTTC: string
  paymentMethods: Record<string, number>
  closureHash: string
  createdAt: string
  closedAt?: string
}

// State
const loading = ref(true)
const closures = ref<Closure[]>([])
const filteredCount = ref(0)
const startDate = ref('')
const endDate = ref('')
const isDetailsDialogOpen = ref(false)
const selectedClosure = ref<Closure | null>(null)

// Charger les clôtures
async function loadClosures() {
  try {
    loading.value = true

    const params: any = {}
    if (startDate.value) params.startDate = startDate.value
    if (endDate.value) params.endDate = endDate.value

    const response = await $fetch('/api/closures', { params })
    closures.value = response.closures
    filteredCount.value = response.count
  } catch (error) {
    console.error('Erreur lors du chargement des clôtures:', error)
  } finally {
    loading.value = false
  }
}

// Réinitialiser les filtres
function resetFilters() {
  startDate.value = ''
  endDate.value = ''
  loadClosures()
}

// Afficher les détails
function viewDetails(closure: Closure) {
  selectedClosure.value = closure
  isDetailsDialogOpen.value = true
}

// Charger au montage
onMounted(() => {
  loadClosures()
})
</script>
