<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
})

import { ref, computed, watch, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Building2 } from 'lucide-vue-next'
import PageHeader from '@/components/common/PageHeader.vue'
import PeriodPicker from '@/components/statistiques/PeriodPicker.vue'
import ProductsTopTable from '@/components/statistiques/ProductsTopTable.vue'
import ProductsDormantTable from '@/components/statistiques/ProductsDormantTable.vue'
import ProductsRotationTable from '@/components/statistiques/ProductsRotationTable.vue'
import EstablishmentMultiSelect from '@/components/sellers/EstablishmentMultiSelect.vue'

interface TopRow {
  productId: number
  productName: string
  quantity: number
  totalTTC: number
  totalHT: number
  totalMargin: number
  marginPct: number | null
}

interface DormantRow {
  productId: number
  productName: string
  price: number
  purchasePrice: number | null
  lastUpdate: string
}

interface RotationRow {
  productId: number
  productName: string
  quantitySold: number
  currentStock: number
  velocityPerDay: number
  daysToSellout: number | null
}

interface Response {
  success: boolean
  period: { startDate: string; endDate: string; days: number }
  topSelling: TopRow[]
  dormant: DormantRow[]
  rotation: RotationRow[]
}

function defaultPeriod() {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 29)
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }
}

const period = ref(defaultPeriod())
const selectedEstablishmentIds = ref<number[]>([])
const data = ref<Response | null>(null)
const loading = ref(false)
const error = ref('')

async function loadStats() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      startDate: period.value.startDate,
      endDate: period.value.endDate,
    })
    if (selectedEstablishmentIds.value.length > 0) {
      params.set('establishmentId', selectedEstablishmentIds.value.join(','))
    }
    data.value = await $fetch<Response>(`/api/stats/products?${params.toString()}`)
  } catch (e: unknown) {
    console.error('Erreur stats produits:', e)
    error.value = e instanceof Error ? e.message : 'Erreur de chargement'
    data.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => loadStats())
watch([period, selectedEstablishmentIds], () => loadStats(), { deep: true })

const establishmentFilterLabel = computed(() => {
  const n = selectedEstablishmentIds.value.length
  if (n === 0) return 'Tous les établissements'
  return `${n} établissement${n > 1 ? 's' : ''} sélectionné${n > 1 ? 's' : ''}`
})
</script>

<template>
  <div class="p-6 space-y-6">
    <PageHeader
      title="Produits"
      description="Top ventes, articles dormants et écoulement des stocks sur la période"
    >
      <template #actions>
        <Dialog>
          <DialogTrigger as-child>
            <Button variant="outline" size="sm">
              <Building2 class="w-4 h-4 mr-2" />
              {{ establishmentFilterLabel }}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Filtrer par établissement</DialogTitle>
              <DialogDescription>
                Laisser tout décoché pour inclure tous les établissements du compte.
              </DialogDescription>
            </DialogHeader>
            <div class="py-2">
              <EstablishmentMultiSelect
                v-model="selectedEstablishmentIds"
                label=""
              />
            </div>
          </DialogContent>
        </Dialog>
      </template>
    </PageHeader>

    <div class="border rounded-lg p-3 bg-card">
      <PeriodPicker v-model="period" />
    </div>

    <div v-if="loading" class="text-center py-12 text-muted-foreground">
      Chargement…
    </div>

    <div v-else-if="error" class="text-center py-12 text-destructive">
      {{ error }}
    </div>

    <div v-else-if="data" class="border rounded-lg bg-card">
      <Tabs default-value="top">
        <TabsList class="m-4">
          <TabsTrigger value="top">Top ventes ({{ data.topSelling.length }})</TabsTrigger>
          <TabsTrigger value="dormant">Articles dormants ({{ data.dormant.length }})</TabsTrigger>
          <TabsTrigger value="rotation">Écoulement stocks ({{ data.rotation.length }})</TabsTrigger>
        </TabsList>

        <TabsContent value="top" class="border-t">
          <ProductsTopTable :items="data.topSelling" />
        </TabsContent>

        <TabsContent value="dormant" class="border-t">
          <div class="px-4 py-2 text-xs text-muted-foreground bg-muted/30">
            Produits non vendus sur la période ({{ data.period.days }} jours), triés par date de dernière mise à jour (les plus anciens en premier).
          </div>
          <ProductsDormantTable :items="data.dormant" />
        </TabsContent>

        <TabsContent value="rotation" class="border-t">
          <div class="px-4 py-2 text-xs text-muted-foreground bg-muted/30">
            Sur-stocks d'abord : produits dont le stock actuel mettra le plus de temps à s'écouler au rythme de la période. Calcul = stock / (qté vendue / {{ data.period.days }} j).
          </div>
          <ProductsRotationTable :items="data.rotation" />
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>
