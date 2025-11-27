<template>
  <Card>
    <CardHeader>
      <CardTitle>Tarification</CardTitle>
      <CardDescription>Définissez les prix de vente et d'achat</CardDescription>
    </CardHeader>
    <CardContent class="space-y-6">
      <!-- Prix de vente -->
      <div class="space-y-2">
        <Label for="price">Prix de vente TTC *</Label>
        <div class="flex gap-2">
          <div class="relative flex-1">
            <Input
              id="price"
              type="number"
              step="0.01"
              :model-value="form.price"
              placeholder="0.00"
              class="pr-8"
              @update:model-value="$emit('update:form', { ...form, price: $event })"
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
          </div>
        </div>
      </div>

      <!-- Prix d'achat -->
      <div class="space-y-2">
        <Label for="purchasePrice">Prix d'achat HT</Label>
        <div class="flex gap-2">
          <div class="relative flex-1">
            <Input
              id="purchasePrice"
              type="number"
              step="0.01"
              :model-value="form.purchasePrice"
              placeholder="0.00"
              class="pr-8"
              @update:model-value="$emit('update:form', { ...form, purchasePrice: $event })"
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
          </div>
        </div>
      </div>

      <!-- TVA -->
      <div class="space-y-2">
        <Label for="tva">TVA *</Label>
        <Select :model-value="form.tva" @update:model-value="$emit('update:form', { ...form, tva: $event })">
          <SelectTrigger id="tva">
            <SelectValue placeholder="Sélectionner un taux" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0%</SelectItem>
            <SelectItem value="2.1">2,1%</SelectItem>
            <SelectItem value="5.5">5,5%</SelectItem>
            <SelectItem value="10">10%</SelectItem>
            <SelectItem value="20">20%</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Catégorie -->
      <div class="space-y-2">
        <Label for="category">Catégorie</Label>
        <div class="flex gap-2">
          <Select :model-value="form.categoryId" @update:model-value="$emit('update:form', { ...form, categoryId: $event })">
            <SelectTrigger id="category" class="flex-1">
              <SelectValue placeholder="Sélectionner une catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="category in categories" :key="category.id" :value="category.id.toString()">
                {{ category.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            type="button"
            @click="$emit('add-category')"
            title="Ajouter une catégorie"
          >
            <Plus class="w-4 h-4" />
          </Button>
        </div>
      </div>

      <!-- Aperçu de la marge -->
      <div v-if="form.price && form.purchasePrice" class="p-4 bg-muted rounded-lg space-y-2">
        <p class="text-sm font-medium">Aperçu de la marge</p>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p class="text-muted-foreground">Marge brute</p>
            <p class="font-medium">{{ margin.toFixed(2) }} €</p>
          </div>
          <div>
            <p class="text-muted-foreground">Taux de marge</p>
            <p class="font-medium" :class="marginRate > 0 ? 'text-green-600' : 'text-red-600'">
              {{ marginRate.toFixed(2) }}%
            </p>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Plus } from 'lucide-vue-next'

interface PricingForm {
  price: string
  purchasePrice: string
  tva: string
  categoryId: string | null
}

interface Category {
  id: number
  name: string
}

const props = defineProps<{
  form: PricingForm
  categories: Category[]
}>()

defineEmits<{
  'update:form': [value: PricingForm]
  'add-category': []
}>()

const margin = computed(() => {
  const price = parseFloat(props.form.price) || 0
  const purchasePrice = parseFloat(props.form.purchasePrice) || 0
  return price - purchasePrice
})

const marginRate = computed(() => {
  const purchasePrice = parseFloat(props.form.purchasePrice) || 0
  if (purchasePrice === 0) return 0
  return (margin.value / purchasePrice) * 100
})
</script>
