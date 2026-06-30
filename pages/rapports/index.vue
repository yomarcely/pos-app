<template>
  <div class="p-6 space-y-6 max-w-3xl">
    <PageHeader
      title="Rapports comptables"
      description="Exports légaux pour la comptabilité et les contrôles fiscaux."
    />

    <!-- Export FEC -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <FileText class="w-5 h-5 text-primary" />
          Fichier des Écritures Comptables (FEC)
        </CardTitle>
        <CardDescription>
          Export au format DGFiP requis pour les contrôles fiscaux.
          Article A47 A-1 du Livre des procédures fiscales.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="space-y-2">
            <Label for="fecFrom">Date de début</Label>
            <DatePicker id="fecFrom" v-model="fecFrom" :max="fecTo" class="w-full" />
          </div>
          <div class="space-y-2">
            <Label for="fecTo">Date de fin</Label>
            <DatePicker id="fecTo" v-model="fecTo" :min="fecFrom" class="w-full" />
          </div>
          <div class="space-y-2">
            <Label>Établissement (optionnel)</Label>
            <EstablishmentSelect :show-tooltip="false" />
          </div>
        </div>

        <div class="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <button
            v-for="preset in presets"
            :key="preset.label"
            class="px-2 py-1 rounded border hover:bg-muted transition-colors"
            @click="applyPreset(preset)"
          >
            {{ preset.label }}
          </button>
        </div>

        <div class="flex items-center justify-between pt-2 border-t">
          <p class="text-sm text-muted-foreground">
            Le fichier sera téléchargé au format <code class="font-mono">.txt</code> (UTF-8, pipe-séparé).
          </p>
          <Button :disabled="!canExport || downloading" @click="downloadFec">
            <Spinner v-if="downloading" class="size-4 mr-2" />
            <Download v-else class="w-4 h-4 mr-2" />
            Télécharger FEC
          </Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Receipt class="w-5 h-5 text-muted-foreground" />
          Tickets Z journaliers
        </CardTitle>
        <CardDescription>
          Le récapitulatif Z se génère depuis la page <NuxtLink to="/clotures" class="text-primary underline">Historique des clôtures</NuxtLink>
          (bouton 🖨️ par ligne).
        </CardDescription>
      </CardHeader>
    </Card>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

import { ref, computed } from 'vue'
import { Download, FileText, Receipt } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Spinner from '@/components/ui/spinner/Spinner.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import EstablishmentSelect from '@/components/shared/EstablishmentSelect.vue'
import DatePicker from '@/components/shared/DatePicker.vue'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import { useToast } from '@/composables/useToast'
import { extractFetchError } from '@/composables/useFetchError'

const toast = useToast()
const { selectedEstablishmentId } = useEstablishmentRegister()

// Période par défaut : mois en cours
const now = new Date()
const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
const fecFrom = ref(firstDayOfMonth.toISOString().slice(0, 10))
const fecTo = ref(now.toISOString().slice(0, 10))

const downloading = ref(false)
const canExport = computed(() => fecFrom.value && fecTo.value && fecFrom.value <= fecTo.value)

interface Preset {
  label: string
  from: () => Date
  to: () => Date
}

const presets: Preset[] = [
  {
    label: 'Mois en cours',
    from: () => new Date(now.getFullYear(), now.getMonth(), 1),
    to: () => now,
  },
  {
    label: 'Mois précédent',
    from: () => new Date(now.getFullYear(), now.getMonth() - 1, 1),
    to: () => new Date(now.getFullYear(), now.getMonth(), 0),
  },
  {
    label: 'Trimestre en cours',
    from: () => new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1),
    to: () => now,
  },
  {
    label: 'Année en cours',
    from: () => new Date(now.getFullYear(), 0, 1),
    to: () => now,
  },
  {
    label: 'Année précédente',
    from: () => new Date(now.getFullYear() - 1, 0, 1),
    to: () => new Date(now.getFullYear() - 1, 11, 31),
  },
]

function applyPreset(preset: Preset): void {
  fecFrom.value = preset.from().toISOString().slice(0, 10)
  fecTo.value = preset.to().toISOString().slice(0, 10)
}

async function downloadFec(): Promise<void> {
  if (!canExport.value || downloading.value) return
  downloading.value = true
  try {
    const params: Record<string, string | number> = {
      from: fecFrom.value,
      to: fecTo.value,
    }
    if (selectedEstablishmentId.value) {
      params.establishmentId = selectedEstablishmentId.value
    }

    // Téléchargement via blob (le serveur renvoie text/plain + Content-Disposition)
    const response = await $fetch<Blob>('/api/reports/fec', {
      params,
      responseType: 'blob',
    })

    // Récupérer le nom de fichier suggéré par le serveur — fallback sur un nom générique
    const filename = `FEC_${fecFrom.value}_${fecTo.value}.txt`
    const url = URL.createObjectURL(response)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('FEC téléchargé')
  }
  catch (error) {
    toast.error(extractFetchError(error, 'Erreur lors de la génération du FEC'))
  }
  finally {
    downloading.value = false
  }
}
</script>
