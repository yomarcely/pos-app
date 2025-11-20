<script setup lang="ts">
definePageMeta({
  layout: 'dashboard'
})

import { ref, computed, watch } from 'vue'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Calendar,
  Euro,
  ShoppingCart,
  Receipt,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  Trash2,
  Lock,
  LockOpen,
} from 'lucide-vue-next'

// État
const selectedDate = ref(new Date().toISOString().split('T')[0])
const dailyData = ref<any>(null)
const loading = ref(false)
const expandedSales = ref<Set<number>>(new Set())
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
  loading.value = true
  try {
    // Charger les données de vente
    const response = await $fetch(`/api/sales/daily-summary?date=${selectedDate.value}`)
    if (response.success) {
      dailyData.value = response
    }

    // Vérifier si la journée est clôturée
    const closureCheck = await $fetch(`/api/sales/check-closure?date=${selectedDate.value}`)
    isClosed.value = closureCheck.isClosed
    closureData.value = closureCheck.closure
  } catch (error) {
    console.error('Erreur lors du chargement de la synthèse:', error)
    alert('Erreur lors du chargement des données')
  } finally {
    loading.value = false
  }
}

// Charger au montage et quand la date change
watch(selectedDate, () => {
  loadDailyData()
})

loadDailyData()

// Toggle expansion d'une vente
function toggleSaleExpansion(saleId: number) {
  if (expandedSales.value.has(saleId)) {
    expandedSales.value.delete(saleId)
  } else {
    expandedSales.value.add(saleId)
  }
}

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
        userId: 1, // TODO: Récupérer l'utilisateur connecté
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
  closingDay.value = true
  try {
    const response = await $fetch('/api/sales/close-day', {
      method: 'POST',
      body: {
        date: selectedDate.value,
        userId: 1, // TODO: Récupérer l'utilisateur connecté
        userName: 'Administrateur', // TODO: Récupérer le nom de l'utilisateur
      },
    })

    if (response.success) {
      console.log('🔒 Journée clôturée:', response.closure)
      isCloseDialogOpen.value = false

      // Recharger les données
      await loadDailyData()

      alert(`Journée clôturée avec succès!\nHash de clôture: ${response.closure.closureHash.substring(0, 32)}...`)
    }
  } catch (error: any) {
    console.error('Erreur lors de la clôture:', error)
    alert(error.data?.message || 'Erreur lors de la clôture de la journée')
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
  <div class="flex flex-1 flex-col gap-4 p-4">
    <!-- En-tête avec sélection de date et clôture -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold">Synthèse journalière</h1>
        <p class="text-muted-foreground">Vue d'ensemble des ventes et statistiques</p>
      </div>

      <div class="flex items-center gap-3">
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
    </div>

    <!-- Indicateur de chargement -->
    <div v-if="loading" class="text-center py-8">
      <p class="text-muted-foreground">Chargement...</p>
    </div>

    <!-- Contenu principal -->
    <div v-else-if="dailyData" class="space-y-4">
      <!-- ==========================================
           STATISTIQUES COMPACTES
           ========================================== -->
      <div class="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <!-- Total TTC -->
        <div class="border rounded-lg p-3 bg-card">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Euro class="h-4 w-4 text-blue-600" />
              <span class="text-sm font-medium">Total TTC</span>
            </div>
          </div>
          <p class="text-2xl font-bold mt-1">{{ dailyData.summary.totalTTC.toFixed(2) }} €</p>
          <p class="text-xs text-muted-foreground">HT: {{ dailyData.summary.totalHT.toFixed(2) }} € · TVA: {{ dailyData.summary.totalTVA.toFixed(2) }} €</p>
        </div>

        <!-- Tickets -->
        <div class="border rounded-lg p-3 bg-card">
          <div class="flex items-center gap-2">
            <Receipt class="h-4 w-4 text-green-600" />
            <span class="text-sm font-medium">Tickets</span>
          </div>
          <p class="text-2xl font-bold mt-1">{{ dailyData.summary.ticketCount }}</p>
          <p class="text-xs text-muted-foreground">{{ dailyData.summary.returnCount }} annulation(s)</p>
        </div>

        <!-- Produits vendus -->
        <div class="border rounded-lg p-3 bg-card">
          <div class="flex items-center gap-2">
            <ShoppingCart class="h-4 w-4 text-purple-600" />
            <span class="text-sm font-medium">Produits</span>
          </div>
          <p class="text-2xl font-bold mt-1">{{ dailyData.summary.totalQuantity }}</p>
          <p class="text-xs text-muted-foreground">Moy: {{ dailyData.summary.avgBasketQuantity }} / ticket</p>
        </div>

        <!-- Panier moyen -->
        <div class="border rounded-lg p-3 bg-card">
          <div class="flex items-center gap-2">
            <TrendingUp class="h-4 w-4 text-emerald-600" />
            <span class="text-sm font-medium">Panier moyen</span>
          </div>
          <p class="text-2xl font-bold mt-1">{{ dailyData.summary.avgBasketValue.toFixed(2) }} €</p>
          <p class="text-xs text-muted-foreground">{{ dailyData.summary.avgBasketQuantity }} produits</p>
        </div>

        <!-- Remises -->
        <div class="border rounded-lg p-3 bg-card">
          <div class="flex items-center gap-2">
            <TrendingDown class="h-4 w-4 text-orange-600" />
            <span class="text-sm font-medium">Remises</span>
          </div>
          <p class="text-2xl font-bold mt-1">{{ dailyData.summary.discountCount }}</p>
          <p class="text-xs text-muted-foreground">{{ dailyData.summary.totalDiscountValue.toFixed(2) }} €</p>
        </div>

        <!-- Paiements -->
        <div v-for="payment in paymentMethodsArray" :key="payment.mode" class="border rounded-lg p-3 bg-card">
          <div class="flex items-center gap-2">
            <Euro class="h-4 w-4 text-slate-600" />
            <span class="text-sm font-medium">{{ payment.mode }}</span>
          </div>
          <p class="text-2xl font-bold mt-1">{{ payment.amount.toFixed(2) }} €</p>
          <p class="text-xs text-muted-foreground">{{ payment.count }} transaction(s)</p>
        </div>
      </div>

      <!-- ==========================================
           LISTING DES TICKETS
           ========================================== -->
      <div class="border rounded-lg p-4 bg-card">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-semibold">Tickets de la journée</h3>
            <p class="text-sm text-muted-foreground">{{ dailyData.sales.length }} ticket(s) - {{ activeSales.length }} actif(s), {{ cancelledSales.length }} annulé(s)</p>
          </div>
        </div>

        <div class="space-y-2 max-h-[500px] overflow-y-auto">
          <!-- Ventes actives -->
          <div v-for="sale in activeSales" :key="sale.id">
            <Collapsible>
              <div class="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                <div class="flex items-center gap-3 flex-1">
                  <CollapsibleTrigger @click="toggleSaleExpansion(sale.id)" class="p-1 hover:bg-muted rounded">
                    <ChevronDown v-if="expandedSales.has(sale.id)" class="w-4 h-4" />
                    <ChevronRight v-else class="w-4 h-4" />
                  </CollapsibleTrigger>

                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-sm">{{ sale.ticketNumber }}</span>
                      <Badge variant="default" class="text-xs">Actif</Badge>
                    </div>
                    <p class="text-xs text-muted-foreground">
                      {{ new Date(sale.saleDate).toLocaleTimeString('fr-FR') }}
                    </p>
                  </div>

                  <div class="text-right">
                    <p class="font-bold text-sm">{{ sale.totalTTC.toFixed(2) }} €</p>
                    <p class="text-xs text-muted-foreground">{{ sale.items.length }} art.</p>
                  </div>

                  <Button
                    v-if="!isClosed"
                    variant="ghost"
                    size="sm"
                    @click="openCancelDialog(sale)"
                    class="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                  >
                    <Trash2 class="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <CollapsibleContent v-if="expandedSales.has(sale.id)" class="pt-2 px-3 pb-3">
                <div class="border rounded-lg p-3 bg-muted/30 space-y-2">
                  <!-- Détails -->
                  <div class="grid grid-cols-3 gap-2 text-xs">
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
                  <div class="text-xs">
                    <p class="font-semibold mb-1">Articles:</p>
                    <div class="space-y-1">
                      <div v-for="item in sale.items" :key="item.id" class="flex justify-between">
                        <span>{{ item.productName }} <span v-if="item.variation" class="text-muted-foreground">({{ item.variation }})</span></span>
                        <span>{{ item.quantity }} x {{ item.unitPrice.toFixed(2) }} € = {{ item.totalTTC.toFixed(2) }} €</span>
                      </div>
                    </div>
                  </div>

                  <!-- Paiements -->
                  <div class="flex gap-1">
                    <Badge v-for="(payment, idx) in sale.payments" :key="idx" variant="secondary" class="text-xs">
                      {{ payment.mode }}: {{ payment.amount.toFixed(2) }} €
                    </Badge>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <!-- Ventes annulées -->
          <div v-for="sale in cancelledSales" :key="sale.id">
            <Collapsible>
              <div class="flex items-center justify-between p-3 border rounded-lg bg-destructive/5 hover:bg-destructive/10 transition-colors">
                <div class="flex items-center gap-3 flex-1">
                  <CollapsibleTrigger @click="toggleSaleExpansion(sale.id)" class="p-1 hover:bg-muted rounded">
                    <ChevronDown v-if="expandedSales.has(sale.id)" class="w-4 h-4" />
                    <ChevronRight v-else class="w-4 h-4" />
                  </CollapsibleTrigger>

                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-sm line-through text-muted-foreground">{{ sale.ticketNumber }}</span>
                      <Badge variant="destructive" class="text-xs">Annulé</Badge>
                    </div>
                    <p class="text-xs text-destructive">{{ sale.cancellationReason }}</p>
                  </div>

                  <div class="text-right opacity-50">
                    <p class="font-bold text-sm line-through">{{ sale.totalTTC.toFixed(2) }} €</p>
                  </div>
                </div>
              </div>

              <CollapsibleContent v-if="expandedSales.has(sale.id)" class="pt-2 px-3 pb-3">
                <div class="border rounded-lg p-3 bg-muted/30">
                  <div class="bg-destructive/10 p-2 rounded text-xs text-destructive mb-2">
                    Annulée le {{ new Date(sale.cancelledAt).toLocaleString('fr-FR') }}
                  </div>
                  <div class="text-xs space-y-1 opacity-50">
                    <div v-for="item in sale.items" :key="item.id" class="flex justify-between">
                      <span>{{ item.productName }}</span>
                      <span>{{ item.quantity }} x {{ item.unitPrice.toFixed(2) }} €</span>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

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
