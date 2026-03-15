<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { ref, computed, watch, onMounted } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Calendar,
  Lock,
  LockOpen,
} from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import DailySummaryStats from '@/components/synthese/DailySummaryStats.vue'
import SaleTicketItem from '@/components/synthese/SaleTicketItem.vue'
import RegisterSelect from '@/components/shared/RegisterSelect.vue'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'

// Composable pour la sélection établissement/caisse
const { selectedEstablishmentId, selectedRegisterId, initialize } = useEstablishmentRegister()

// État
const selectedDate = ref(new Date().toISOString().split('T')[0])
const dailyData = ref<any>(null)
const loading = ref(false)
const isClosed = ref(false)
const closureData = ref<any>(null)

// Dialog d'annulation
const isCancelDialogOpen = ref(false)
const saleToCancel = ref<any>(null)
const cancellationReason = ref('')

// Dialog de clôture
const isCloseDialogOpen = ref(false)
const closingDay = ref(false)

// Charger les données
async function loadDailyData() {
  if (!selectedRegisterId.value || !selectedDate.value) {
    return
  }

  loading.value = true
  try {
    // Construire les paramètres de requête
    const params = new URLSearchParams()
    params.append('date', selectedDate.value)
    params.append('registerId', String(selectedRegisterId.value))

    if (selectedEstablishmentId.value) {
      params.append('establishmentId', String(selectedEstablishmentId.value))
    }

    // Charger les données de vente
    const response = await $fetch(`/api/sales/daily-summary?${params.toString()}`)
    if (response.success) {
      dailyData.value = response
    }

    // Vérifier si la journée est clôturée
    const closureParams = new URLSearchParams()
    closureParams.append('date', selectedDate.value)
    closureParams.append('registerId', String(selectedRegisterId.value))

    const closureCheck = await $fetch(`/api/sales/check-closure?${closureParams.toString()}`)
    isClosed.value = closureCheck.isClosed
    closureData.value = closureCheck.closure
  } catch (error) {
    console.error('Erreur lors du chargement de la synthèse:', error)
    alert('Erreur lors du chargement des données')
  } finally {
    loading.value = false
  }
}

// Initialiser au montage
onMounted(async () => {
  await initialize()
  loadDailyData()
})

// Charger quand la date, l'établissement ou la caisse change
watch([selectedDate, selectedEstablishmentId, selectedRegisterId], () => {
  loadDailyData()
})

// Ouvrir le dialog d'annulation
function openCancelDialog(sale: any) {
  if (isClosed.value) {
    alert('Impossible d\'annuler une vente sur une journée clôturée')
    return
  }
  saleToCancel.value = sale
  cancellationReason.value = ''
  isCancelDialogOpen.value = true
}

// Annuler une vente
async function cancelSale() {
  if (!saleToCancel.value || !cancellationReason.value.trim()) {
    alert('Veuillez fournir une raison d\'annulation')
    return
  }

  try {
    const response = await $fetch(`/api/sales/${saleToCancel.value.id}/cancel`, {
      method: 'POST',
      body: {
        reason: cancellationReason.value,
      },
    })

    if (response.success) {
      console.log('✅ Vente annulée:', response.sale)
      isCancelDialogOpen.value = false
      saleToCancel.value = null
      cancellationReason.value = ''

      // Recharger les données
      await loadDailyData()
    }
  } catch (error) {
    console.error('Erreur lors de l\'annulation:', error)
    alert('Erreur lors de l\'annulation de la vente')
  }
}

// Clôturer la journée
async function closeDay() {
  if (!selectedRegisterId.value) {
    alert('Veuillez sélectionner une caisse')
    return
  }

  closingDay.value = true
  try {
    const response = await $fetch('/api/sales/close-day', {
      method: 'POST',
      body: {
        date: selectedDate.value,
        registerId: selectedRegisterId.value,
      },
    })

    if (response.success) {
      console.log('🔒 Journée clôturée:', response.closure)
      isCloseDialogOpen.value = false

      // Recharger les données
      await loadDailyData()

      alert(`Journée clôturée avec succès!\nHash de clôture: ${response.closure.closureHash.substring(0, 32)}...`)
    }
  } catch (error: unknown) {
    console.error('Erreur lors de la clôture:', error)
    alert(extractFetchError(error, 'Erreur lors de la clôture de la journée'))
  } finally {
    closingDay.value = false
  }
}

// Computed
const paymentMethodsArray = computed(() => {
  if (!dailyData.value?.summary?.paymentMethods) return []
  return Object.entries(dailyData.value.summary.paymentMethods).map(([mode, data]: [string, any]) => ({
    mode,
    amount: data.amount,
    count: data.count,
  }))
})

const activeSales = computed(() => {
  if (!dailyData.value?.sales) return []
  return dailyData.value.sales.filter((s: any) => s.status === 'completed')
})

const cancelledSales = computed(() => {
  if (!dailyData.value?.sales) return []
  return dailyData.value.sales.filter((s: any) => s.status === 'cancelled')
})
</script>

<template>
  <div class="p-6 space-y-6">
    <!-- En-tête avec sélection de date et clôture -->
    <PageHeader
      title="Synthèse journalière"
      description="Vue d'ensemble des ventes et statistiques"
    >
      <template #actions>
        <div class="flex items-center gap-3 flex-wrap">
          <!-- Sélection caisse -->
          <RegisterSelect :show-tooltip="false" />

          <!-- Sélection date -->
          <div class="flex items-center gap-2">
            <Calendar class="w-4 h-4 text-muted-foreground" />
            <Input
              v-model="selectedDate"
              type="date"
              class="w-[200px]"
              :disabled="closingDay"
            />
          </div>

          <!-- Badge de statut -->
          <Badge v-if="isClosed" variant="secondary" class="gap-1">
            <Lock class="w-3 h-3" />
            Clôturée
          </Badge>
          <Badge v-else variant="outline" class="gap-1">
            <LockOpen class="w-3 h-3" />
            Ouverte
          </Badge>

          <!-- Bouton de clôture -->
          <Button
            v-if="!isClosed"
            @click="isCloseDialogOpen = true"
            :disabled="loading || closingDay || !dailyData"
            variant="default"
            class="bg-blue-600 hover:bg-blue-700"
          >
            <Lock class="w-4 h-4 mr-2" />
            Clôturer la journée
          </Button>
        </div>
      </template>
    </PageHeader>

    <!-- Indicateur de chargement -->
    <div v-if="loading" class="text-center py-8">
      <p class="text-muted-foreground">Chargement...</p>
    </div>

    <!-- Contenu principal -->
    <div v-else-if="dailyData">
      <!-- Statistiques -->
      <DailySummaryStats
        :summary="dailyData.summary"
        :payment-methods="paymentMethodsArray"
      />

      <!-- Liste des tickets -->
      <div class="border rounded-lg p-4 bg-card">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-semibold">Tickets de la journée</h3>
            <p class="text-sm text-muted-foreground">{{ dailyData.sales.length }} ticket(s) - {{ activeSales.length }} actif(s), {{ cancelledSales.length }} annulé(s)</p>
          </div>
        </div>

        <div class="space-y-2 max-h-[500px] overflow-y-auto">
          <!-- Ventes actives -->
          <SaleTicketItem
            v-for="sale in activeSales"
            :key="sale.id"
            :sale="sale"
            :is-closed="isClosed"
            @cancel="openCancelDialog"
          />

          <!-- Ventes annulées -->
          <SaleTicketItem
            v-for="sale in cancelledSales"
            :key="sale.id"
            :sale="sale"
            :is-closed="isClosed"
            @cancel="openCancelDialog"
          />

          <!-- Message si aucune vente -->
          <div v-if="dailyData.sales.length === 0" class="text-center py-8 text-muted-foreground text-sm">
            Aucune vente enregistrée pour cette journée
          </div>
        </div>
      </div>
    </div>

    <!-- Dialog d'annulation -->
    <Dialog v-model:open="isCancelDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler une vente</DialogTitle>
          <DialogDescription>
            Ticket: {{ saleToCancel?.ticketNumber }} - {{ saleToCancel?.totalTTC?.toFixed(2) }} €
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <Label for="reason">Raison de l'annulation *</Label>
            <Textarea
              id="reason"
              v-model="cancellationReason"
              placeholder="Ex: Erreur de saisie, retour client, etc."
              rows="3"
            />
          </div>

          <div class="bg-orange-50 dark:bg-orange-950/20 p-3 rounded border border-orange-200 dark:border-orange-800">
            <p class="text-sm text-orange-800 dark:text-orange-200">
              ⚠️ L'annulation va restaurer les stocks. Cette action est tracée dans l'audit log NF525.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="isCancelDialogOpen = false">
            Annuler
          </Button>
          <Button
            variant="destructive"
            @click="cancelSale"
            :disabled="!cancellationReason.trim()"
          >
            Confirmer l'annulation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog de clôture -->
    <Dialog v-model:open="isCloseDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clôturer la journée</DialogTitle>
          <DialogDescription>
            Clôture de la journée du {{ selectedDate }}
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <div class="space-y-2">
            <p class="font-semibold">Résumé de la journée :</p>
            <div class="text-sm space-y-1 bg-muted p-3 rounded">
              <div class="flex justify-between">
                <span>Nombre de tickets :</span>
                <span class="font-medium">{{ dailyData?.summary.ticketCount || 0 }}</span>
              </div>
              <div class="flex justify-between">
                <span>Total TTC :</span>
                <span class="font-medium">{{ dailyData?.summary.totalTTC.toFixed(2) || '0.00' }} €</span>
              </div>
              <div class="flex justify-between">
                <span>Produits vendus :</span>
                <span class="font-medium">{{ dailyData?.summary.totalQuantity || 0 }}</span>
              </div>
            </div>
          </div>

          <div class="bg-blue-50 dark:bg-blue-950/20 p-3 rounded border border-blue-200 dark:border-blue-800">
            <p class="text-sm text-blue-800 dark:text-blue-200">
              🔒 <strong>Attention :</strong> Après la clôture, il sera impossible d'enregistrer de nouvelles ventes pour cette journée. Un hash cryptographique NF525 sera généré et enregistré dans l'audit log.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="isCloseDialogOpen = false" :disabled="closingDay">
            Annuler
          </Button>
          <Button
            @click="closeDay"
            :disabled="closingDay"
            class="bg-blue-600 hover:bg-blue-700"
          >
            <Lock class="w-4 h-4 mr-2" />
            {{ closingDay ? 'Clôture en cours...' : 'Confirmer la clôture' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
