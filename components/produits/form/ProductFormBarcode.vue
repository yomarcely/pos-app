<template>
  <Card>
    <CardHeader>
      <CardTitle>Code-barres</CardTitle>
      <CardDescription>Définissez les codes-barres du produit</CardDescription>
    </CardHeader>
    <CardContent class="space-y-6">
      <!-- Code interne fournisseur -->
      <div class="space-y-2">
        <Label for="supplier-code">Code interne fournisseur</Label>
        <Input
          id="supplier-code"
          placeholder="Ex: REF-12345"
          :model-value="supplierCode"
          @update:model-value="$emit('update:supplierCode', $event as string)"
        />
        <p class="text-xs text-muted-foreground">
          Code ou référence interne du fournisseur (optionnel)
        </p>
      </div>

      <div v-if="!hasVariations">
        <!-- Code-barres simple -->
        <div class="space-y-2">
          <Label for="barcode">Code-barres du produit</Label>
          <Input
            id="barcode"
            placeholder="Ex: 3401234567890"
            :model-value="barcode"
            @update:model-value="$emit('update:barcode', $event as string)"
          />
          <p class="text-xs text-muted-foreground">
            Saisissez le code-barres du produit
          </p>
        </div>
      </div>

      <div v-else>
        <!-- Code-barres par variation -->
        <div v-if="selectedVariationsList.length === 0" class="text-center py-8 text-muted-foreground">
          <Info class="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucune variation sélectionnée.</p>
          <p class="text-sm">Sélectionnez des variations dans l'onglet "Variations".</p>
        </div>

        <div v-else class="space-y-4">
          <p class="text-sm text-muted-foreground">
            Définissez un code-barres pour chaque combinaison de variations
          </p>
          <div v-for="variation in selectedVariationsList" :key="variation.id" class="space-y-2">
            <Label :for="`barcode-${variation.id}`">{{ variation.name }}</Label>
            <Input
              :id="`barcode-${variation.id}`"
              placeholder="Code-barres"
              :model-value="barcodeByVariation[variation.id] || ''"
              @update:model-value="updateBarcodeByVariation(variation.id, $event as string)"
            />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Info } from 'lucide-vue-next'

interface Variation {
  id: number
  name: string
}

const props = defineProps<{
  hasVariations: boolean
  supplierCode: string
  barcode: string
  barcodeByVariation: Record<number, string>
  selectedVariationsList: Variation[]
}>()

const emit = defineEmits<{
  'update:supplierCode': [value: string]
  'update:barcode': [value: string]
  'update:barcodeByVariation': [value: Record<number, string>]
}>()

function updateBarcodeByVariation(variationId: number, value: string) {
  const updated = { ...props.barcodeByVariation, [variationId]: value }
  emit('update:barcodeByVariation', updated)
}
</script>
