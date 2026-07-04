<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { ref, computed, watch, onMounted } from 'vue'
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
  Lock,
  LockOpen,
} from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import DailySummaryStats, { type Summary } from '@/components/synthese/DailySummaryStats.vue'
import SaleTicketItem, { type Sale } from '@/components/synthese/SaleTicketItem.vue'
import RegisterSelect from '@/components/shared/RegisterSelect.vue'
import DatePicker from '@/components/shared/DatePicker.vue'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import { useUserRole } from '@/composables/useUserRole'

// Composable pour la sélection établissement/caisse
const { selectedEstablishmentId, selectedRegisterId, initialize } = useEstablishmentRegister()

// RBAC : la clôture est réservée aux manager+ (cf. assertRole sur /api/sales/close-day).
// Masquage UI ; le 403 serveur reste la vraie barrière.
const { canAccess } = useUserRole()
const canCloseDay = computed(() => canAccess('manager'))

// Types des données journalières (summary partagé avec DailySummaryStats,
// enrichi des moyens de paiement utilisés pour construire paymentMethodsArray).
type DailySummaryData = Summary & {
  paymentMethods?: Record<string, { amount: number; count: number }>
}
interface DailyData {
  success: boolean
  summary: DailySummaryData
  sales: Sale[]
}
interface PendingSale {
  registerId: number | null
}

// État
const selectedDate = ref(getLocalDateString())
const dailyData = ref<DailyData | null>(null)
const loading = ref(false)
const isClosed = ref(false)
const closureData = ref<unknown>(null)
const pendingForRegister = ref<PendingSale[]>([])

// Dialog d'annulation
const isCancelDialogOpen = ref(false)
const saleToCancel = ref<Sale | null>(null)
const cancellationReason = ref('')

// Dialog de clôture
const isCloseDialogOpen = ref(false)
const closingDay = ref(false)

// Dialog "forcer la clôture" — affiché quand le serveur refuse la clôture (409)
// pour une anomalie bloquante (incohérence des totaux ou tickets en attente).
const isForceDialogOpen = ref(false)
interface CloseBlocker {
  reason: string
  message: string
  pendingSales?: Array<{ id: number; createdAt: string | null; createdByEmail: string | null; itemCount: number }>
  diff?: number
  totalHT?: number
  totalTVA?: number
  totalTTC?: number
}
const closeBlocker = ref<CloseBlocker | null>(null)

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
    const response = await $fetch<DailyData>(`/api/sales/daily-summary?${params.toString()}`)
    if (response.success) {
      dailyData.value = response
    }

    // Vérifier si la journée est clôturée
    const closureParams = new URLSearchParams()
    closureParams.append('date', selectedDate.value)
    closureParams.append('registerId', String(selectedRegisterId.value))

    const closureCheck = await $fetch<{ isClosed: boolean; closure: unknown }>(`/api/sales/check-closure?${closureParams.toString()}`)
    isClosed.value = closureCheck.isClosed
    closureData.value = closureCheck.closure

    // Tickets en attente sur cette caisse (bloquent la clôture)
    if (selectedEstablishmentId.value) {
      const pendingResp = await $fetch<{ pendingSales: PendingSale[] }>('/api/pending-sales', {
        params: {
          establishmentId: selectedEstablishmentId.value,
          registerId: selectedRegisterId.value,
        },
      })
      // Filtrer sur la caisse courante (la liste peut être partagée)
      pendingForRegister.value = pendingResp.pendingSales.filter(
        (p) => p.registerId === selectedRegisterId.value
      )
    } else {
      pendingForRegister.value = []
    }
  } catch (error) {
    console.error('Erreur lors du chargement de la synthèse:', error)
    alert('Erreur lors du chargement des données')
  } finally {
    loading.value = false
  }
}

// Préremplir la date avec la dernière journée active non clôturée de la caisse
// (oubli de clôture la veille → on arrive directement sur la bonne journée).
async function prefillUnclosedDay() {
  if (!selectedRegisterId.value) return
  try {
    const res = await $fetch<{ success: boolean; day: string | null }>('/api/sales/unclosed-day', {
      params: { registerId: selectedRegisterId.value },
    })
    if (res?.day) {
      selectedDate.value = res.day
    }
  } catch (error) {
    console.error('Erreur lors de la recherche de journée non clôturée:', error)
  }
}

// Initialiser au montage
onMounted(async () => {
  await initialize()
  await prefillUnclosedDay()
  loadDailyData()
})

// Charger quand la date, l'établissement ou la caisse change
watch([selectedDate, selectedEstablishmentId, selectedRegisterId], () => {
  loadDailyData()
})

// Changement de caisse : repositionner la date sur sa journée non clôturée éventuelle
watch(selectedRegisterId, () => {
  prefillUnclosedDay()
})

// Ouvrir le dialog d'annulation
function openCancelDialog(sale: Sale) {
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
    const response = await $fetch<{ success: boolean }>(`/api/sales/${saleToCancel.value.id}/cancel`, {
      method: 'POST',
      body: {
        reason: cancellationReason.value,
      },
    })

    if (response.success) {
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

// Ouvrir le dialog de clôture. Le contrôle des anomalies bloquantes (tickets
// en attente, incohérence des totaux) est délégué au serveur, qui renvoie un
// 409 détaillé → on propose alors de forcer la clôture (cf. closeDay).
function tryOpenCloseDialog() {
  isCloseDialogOpen.value = true
}

// Clôturer la journée. `force=true` passe outre une anomalie bloquante
// (l'anomalie est consignée dans l'audit log NF525 côté serveur).
async function closeDay(force = false) {
  if (!selectedRegisterId.value) {
    alert('Veuillez sélectionner une caisse')
    return
  }

  closingDay.value = true
  try {
    const response = await $fetch<{ success: boolean; forced?: boolean; closure: { closureHash: string } }>('/api/sales/close-day', {
      method: 'POST',
      body: {
        date: selectedDate.value,
        registerId: selectedRegisterId.value,
        force,
      },
    })

    if (response.success) {
      isCloseDialogOpen.value = false
      isForceDialogOpen.value = false
      closeBlocker.value = null

      // Recharger les données
      await loadDailyData()

      alert(
        response.forced
          ? 'Journée clôturée (forcée). L\'anomalie a été consignée dans l\'audit log NF525.'
          : `Journée clôturée avec succès!\nHash de clôture: ${response.closure.closureHash.substring(0, 32)}...`
      )
    }
  } catch (error: unknown) {
    const e = error as { statusCode?: number; data?: { statusCode?: number; message?: string; data?: CloseBlocker } }
    const status = e?.statusCode ?? e?.data?.statusCode
    const detail = e?.data?.data

    // 409 = anomalie bloquante → proposer de forcer derrière une confirmation
    if (status === 409 && detail?.reason) {
      closeBlocker.value = {
        reason: detail.reason,
        message: e?.data?.message ?? 'Clôture refusée',
        pendingSales: detail.pendingSales,
        diff: detail.diff,
        totalHT: detail.totalHT,
        totalTVA: detail.totalTVA,
        totalTTC: detail.totalTTC,
      }
      isCloseDialogOpen.value = false
      isForceDialogOpen.value = true
    } else {
      console.error('Erreur lors de la clôture:', error)
      alert(extractFetchError(error, 'Erreur lors de la clôture de la journée'))
    }
  } finally {
    closingDay.value = false
  }
}

// Computed
const paymentMethodsArray = computed(() => {
  if (!dailyData.value?.summary?.paymentMethods) return []
  return Object.entries(dailyData.value.summary.paymentMethods).map(([mode, data]) => ({
    mode,
    amount: data.amount,
    count: data.count,
  }))
})

const activeSales = computed(() => {
  if (!dailyData.value?.sales) return []
  return dailyData.value.sales.filter((s) => s.status === 'completed')
})

const cancelledSales = computed(() => {
  if (!dailyData.value?.sales) return []
  return dailyData.value.sales.filter((s) => s.status === 'cancelled')
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
            <DatePicker
              v-model="selectedDate"
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

          <!-- Badge tickets en attente bloquants -->
          <Badge v-if="!isClosed && pendingForRegister.length > 0" variant="destructive" class="gap-1">
            {{ pendingForRegister.length }} en attente
          </Badge>

          <!-- Bouton de clôture -->
          <Button
            v-if="!isClosed && canCloseDay"
            @click="tryOpenCloseDialog"
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
            @click="closeDay(false)"
            :disabled="closingDay"
            class="bg-blue-600 hover:bg-blue-700"
          >
            <Lock class="w-4 h-4 mr-2" />
            {{ closingDay ? 'Clôture en cours...' : 'Confirmer la clôture' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Dialog "forcer la clôture" (anomalie bloquante renvoyée par le serveur) -->
    <Dialog v-model:open="isForceDialogOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clôture refusée — anomalie détectée</DialogTitle>
          <DialogDescription>
            {{ closeBlocker?.message }}
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <!-- Incohérence des totaux -->
          <div
            v-if="closeBlocker?.reason === 'totals_mismatch'"
            class="text-sm space-y-1 bg-muted p-3 rounded"
          >
            <div class="flex justify-between">
              <span>Total HT :</span>
              <span class="font-medium">{{ closeBlocker?.totalHT?.toFixed(2) }} €</span>
            </div>
            <div class="flex justify-between">
              <span>Total TVA :</span>
              <span class="font-medium">{{ closeBlocker?.totalTVA?.toFixed(2) }} €</span>
            </div>
            <div class="flex justify-between">
              <span>Total TTC :</span>
              <span class="font-medium">{{ closeBlocker?.totalTTC?.toFixed(2) }} €</span>
            </div>
            <div class="flex justify-between border-t pt-1 mt-1 text-destructive">
              <span>Écart (HT + TVA − TTC) :</span>
              <span class="font-semibold">{{ closeBlocker?.diff?.toFixed(2) }} €</span>
            </div>
          </div>

          <!-- Tickets en attente -->
          <div
            v-else-if="closeBlocker?.reason === 'pending_sales'"
            class="text-sm bg-muted p-3 rounded space-y-1 max-h-[200px] overflow-y-auto"
          >
            <p class="font-medium mb-2">
              {{ closeBlocker?.pendingSales?.length }} ticket(s) en attente :
            </p>
            <div
              v-for="p in closeBlocker?.pendingSales"
              :key="p.id"
              class="flex justify-between text-muted-foreground"
            >
              <span>#{{ p.id }} — {{ p.itemCount }} article(s)</span>
              <span>{{ p.createdByEmail || '—' }}</span>
            </div>
          </div>

          <div class="bg-orange-50 dark:bg-orange-950/20 p-3 rounded border border-orange-200 dark:border-orange-800">
            <p class="text-sm text-orange-800 dark:text-orange-200">
              ⚠️ Forcer la clôture passe outre cette anomalie. Elle sera
              <strong>consignée dans l'audit log NF525</strong> à des fins de traçabilité.
              Cette action est irréversible.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="isForceDialogOpen = false" :disabled="closingDay">
            Annuler
          </Button>
          <Button
            variant="destructive"
            @click="closeDay(true)"
            :disabled="closingDay"
          >
            <Lock class="w-4 h-4 mr-2" />
            {{ closingDay ? 'Clôture en cours...' : 'Forcer la clôture' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
