<script setup lang="ts">
import { Search, Package } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Suggestion = {
  id: number | string
  name: string
  barcode?: string | null
  image?: string | null
  categoryName?: string | null
  stock?: number | null
  stockByVariation?: Record<string, number | string> | null
}

const props = withDefaults(defineProps<{
  searchQuery: string
  suggestions: Suggestion[]
  wrapCard?: boolean
  title?: string
  subtitle?: string
  showSearchButton?: boolean
  showCatalogButton?: boolean
  showLabel?: boolean
  maxWidth?: string
}>(), {
  wrapCard: true,
  showSearchButton: true,
  showCatalogButton: true,
  showLabel: true,
  maxWidth: '',
})

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'search': []
  'selectFirst': []
  'clearSuggestions': []
  'focus': []
  'selectProduct': [product: Suggestion]
  'openCatalog': []
}>()

function handleInput(value: string | number) {
  emit('update:searchQuery', String(value))
}

function getTotalStock(product: Suggestion): number {
  if (product.stockByVariation && Object.keys(product.stockByVariation).length > 0) {
    return Object.values(product.stockByVariation).reduce((sum, qty) => sum + Number(qty || 0), 0)
  }
  return product.stock || 0
}
</script>

<template>
  <div class="w-full">
    <div
      :class="[
        'w-full',
        wrapCard ? '' : 'space-y-4',
        maxWidth ? `${maxWidth}` : '',
      ]"
    >
    <Card v-if="wrapCard">
      <CardHeader v-if="title || subtitle">
        <CardTitle v-if="title">{{ title }}</CardTitle>
        <p v-if="subtitle" class="text-sm text-muted-foreground mt-1">{{ subtitle }}</p>
      </CardHeader>
      <CardContent>
        <slot name="content">
          <div class="space-y-4">
            <div class="grid grid-cols-1 gap-4" :class="props.showCatalogButton ? 'md:grid-cols-3' : 'md:grid-cols-1'">
              <div :class="props.showCatalogButton ? 'md:col-span-2 relative' : 'relative'">
                <Label v-if="props.showLabel">Rechercher par nom ou code-barres</Label>
                <div class="flex gap-2 mt-1">
                  <div class="relative flex-1">
                    <Input
                      :model-value="props.searchQuery"
                      placeholder="Nom du produit ou code-barres..."
                      @update:model-value="handleInput"
                      @keydown.enter="$emit('selectFirst')"
                      @keydown.esc="$emit('clearSuggestions')"
                      @focus="$emit('focus')"
                    />
                    <!-- Suggestions dropdown -->
                    <div
                      v-if="props.suggestions.length > 0"
                      class="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-[300px] overflow-y-auto"
                    >
                      <div
                        v-for="product in props.suggestions"
                        :key="product.id"
                        class="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                        @click="$emit('selectProduct', product)"
                      >
                        <div v-if="product.image" class="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          <img :src="product.image" :alt="product.name" class="w-full h-full object-cover" />
                        </div>
                        <div v-else class="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <Package class="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="font-medium truncate">{{ product.name }}</p>
                          <p class="text-sm text-muted-foreground">{{ product.barcode || 'Sans code-barres' }}</p>
                        </div>
                        <div class="text-right flex-shrink-0">
                          <p class="text-sm font-medium">Stock: {{ getTotalStock(product) }}</p>
                          <p class="text-xs text-muted-foreground">{{ product.categoryName || 'Sans catégorie' }}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button v-if="props.showSearchButton" @click="$emit('search')">
                    <Search class="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div v-if="props.showCatalogButton">
                <Label>&nbsp;</Label>
                <Button variant="outline" class="w-full mt-1" @click="$emit('openCatalog')">
                  <Package class="w-4 h-4 mr-2" />
                  Parcourir le catalogue
                </Button>
              </div>
            </div>
          </div>
        </slot>
      </CardContent>
    </Card>
    <template v-else>
      <slot name="content">
        <div class="space-y-4">
          <div class="grid grid-cols-1 gap-4" :class="props.showCatalogButton ? 'md:grid-cols-3' : 'md:grid-cols-1'">
            <div :class="props.showCatalogButton ? 'md:col-span-2 relative' : 'relative'">
              <Label v-if="props.showLabel">Rechercher par nom ou code-barres</Label>
              <div class="flex gap-2 mt-1">
                <div class="relative flex-1">
                  <Input
                    :model-value="props.searchQuery"
                    placeholder="Nom du produit ou code-barres..."
                    @update:model-value="handleInput"
                    @keydown.enter="$emit('selectFirst')"
                    @keydown.esc="$emit('clearSuggestions')"
                    @focus="$emit('focus')"
                  />
                  <!-- Suggestions dropdown -->
                  <div
                    v-if="props.suggestions.length > 0"
                    class="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-[300px] overflow-y-auto"
                  >
                    <div
                      v-for="product in props.suggestions"
                      :key="product.id"
                      class="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                      @click="$emit('selectProduct', product)"
                    >
                      <div v-if="product.image" class="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img :src="product.image" :alt="product.name" class="w-full h-full object-cover" />
                      </div>
                      <div v-else class="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Package class="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="font-medium truncate">{{ product.name }}</p>
                        <p class="text-sm text-muted-foreground">{{ product.barcode || 'Sans code-barres' }}</p>
                      </div>
                      <div class="text-right flex-shrink-0">
                        <p class="text-sm font-medium">Stock: {{ getTotalStock(product) }}</p>
                        <p class="text-xs text-muted-foreground">{{ product.categoryName || 'Sans catégorie' }}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <Button v-if="props.showSearchButton" @click="$emit('search')">
                  <Search class="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div v-if="props.showCatalogButton">
              <Label>&nbsp;</Label>
              <Button variant="outline" class="w-full mt-1" @click="$emit('openCatalog')">
                <Package class="w-4 h-4 mr-2" />
                Parcourir le catalogue
              </Button>
            </div>
          </div>
        </div>
      </slot>
    </template>
    </div>
  </div>
</template>
