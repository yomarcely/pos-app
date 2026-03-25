<template>
  <Card>
    <CardContent class="p-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- Recherche -->
        <div class="md:col-span-2 relative">
          <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            :model-value="searchQuery"
            placeholder="Rechercher par nom ou code-barres..."
            class="pl-10"
            @update:model-value="(value) => { $emit('update:searchQuery', value as string); $emit('search') }"
          />
        </div>

        <!-- Filtre catégorie -->
        <div>
          <select
            :value="selectedCategoryId"
            class="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            @change="$emit('update:selectedCategoryId', ($event.target as HTMLSelectElement).value ? parseInt(($event.target as HTMLSelectElement).value) : null); $emit('categoryChange')"
          >
            <option :value="null">Toutes les catégories</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </div>

        <!-- Toggle vue -->
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            :class="{ 'bg-accent': viewMode === 'list' }"
            @click="$emit('update:viewMode', 'list')"
          >
            <List class="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            :class="{ 'bg-accent': viewMode === 'grid' }"
            @click="$emit('update:viewMode', 'grid')"
          >
            <Grid class="w-4 h-4" />
          </Button>
        </div>
      </div>

      <!-- Ligne 2 : filtres avancés -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
        <!-- Filtre marque -->
        <div>
          <select
            :value="selectedBrandId"
            class="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            @change="$emit('update:selectedBrandId', ($event.target as HTMLSelectElement).value ? parseInt(($event.target as HTMLSelectElement).value) : null); $emit('filterChange')"
          >
            <option :value="null">Toutes les marques</option>
            <option v-for="brand in brands" :key="brand.id" :value="brand.id">
              {{ brand.name }}
            </option>
          </select>
        </div>

        <!-- Filtre fournisseur -->
        <div>
          <select
            :value="selectedSupplierId"
            class="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            @change="$emit('update:selectedSupplierId', ($event.target as HTMLSelectElement).value ? parseInt(($event.target as HTMLSelectElement).value) : null); $emit('filterChange')"
          >
            <option :value="null">Tous les fournisseurs</option>
            <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
              {{ supplier.name }}
            </option>
          </select>
        </div>

        <!-- Toggle archivés -->
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              :checked="showArchived"
              class="rounded border-input"
              @change="$emit('update:showArchived', ($event.target as HTMLInputElement).checked); $emit('filterChange')"
            />
            <Archive class="w-4 h-4 text-muted-foreground" />
            Afficher les archivés
          </label>
        </div>

        <!-- Bouton réinitialiser -->
        <div class="flex items-center">
          <Button
            v-if="hasActiveFilters"
            variant="ghost"
            size="sm"
            @click="$emit('resetFilters')"
          >
            <X class="w-4 h-4 mr-1" />
            Réinitialiser les filtres
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Search, List, Grid, Archive, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Category, Brand, Supplier } from '@/types'

const props = defineProps<{
  searchQuery: string
  selectedCategoryId: number | null
  selectedBrandId: number | null
  selectedSupplierId: number | null
  showArchived: boolean
  categories: Category[]
  brands: Brand[]
  suppliers: Supplier[]
  viewMode: 'list' | 'grid'
}>()

defineEmits<{
  'update:searchQuery': [value: string]
  'update:selectedCategoryId': [value: number | null]
  'update:selectedBrandId': [value: number | null]
  'update:selectedSupplierId': [value: number | null]
  'update:showArchived': [value: boolean]
  'update:viewMode': [value: 'list' | 'grid']
  'search': []
  'categoryChange': []
  'filterChange': []
  'resetFilters': []
}>()

const hasActiveFilters = computed(() =>
  props.searchQuery !== '' ||
  props.selectedCategoryId !== null ||
  props.selectedBrandId !== null ||
  props.selectedSupplierId !== null ||
  props.showArchived
)
</script>
