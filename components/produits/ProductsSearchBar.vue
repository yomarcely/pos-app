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
        <CategorySelector
          :categories="categories"
          :model-value="selectedCategoryId !== null ? String(selectedCategoryId) : null"
          :show-label="false"
          :clearable="true"
          placeholder="Toutes les catégories"
          @update:model-value="(value: string | null) => { $emit('update:selectedCategoryId', value ? parseInt(value) : null); $emit('categoryChange') }"
        />

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
        <SearchableSelect
          :model-value="selectedBrandId"
          :items="brandItems"
          placeholder="Toutes les marques"
          search-placeholder="Rechercher une marque..."
          empty-text="Aucune marque trouvée"
          @update:model-value="(value) => { $emit('update:selectedBrandId', value === null ? null : Number(value)); $emit('filterChange') }"
        />

        <!-- Filtre fournisseur -->
        <SearchableSelect
          :model-value="selectedSupplierId"
          :items="supplierItems"
          placeholder="Tous les fournisseurs"
          search-placeholder="Rechercher un fournisseur..."
          empty-text="Aucun fournisseur trouvé"
          @update:model-value="(value) => { $emit('update:selectedSupplierId', value === null ? null : Number(value)); $emit('filterChange') }"
        />

        <!-- Toggle archivés -->
        <div class="flex items-center gap-2">
          <label class="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              :model-value="showArchived"
              @update:model-value="(value) => { $emit('update:showArchived', !!value); $emit('filterChange') }"
            />
            <Archive class="w-4 h-4 text-muted-foreground" />
            Voir uniquement les archivés
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
import { Checkbox } from '@/components/ui/checkbox'
import SearchableSelect from '@/components/shared/SearchableSelect.vue'
import CategorySelector from '@/components/produits/CategorySelector.vue'
import type { Brand, Supplier } from '@/types'

interface CategoryTree {
  id: number
  name: string
  parentId: number | null
  children?: CategoryTree[]
}

const props = defineProps<{
  searchQuery: string
  selectedCategoryId: number | null
  selectedBrandId: number | null
  selectedSupplierId: number | null
  showArchived: boolean
  categories: CategoryTree[]
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

const brandItems = computed(() =>
  props.brands.map((b) => ({ id: b.id, label: b.name })),
)
const supplierItems = computed(() =>
  props.suppliers.map((s) => ({ id: s.id, label: s.name })),
)

const hasActiveFilters = computed(() =>
  props.searchQuery !== '' ||
  props.selectedCategoryId !== null ||
  props.selectedBrandId !== null ||
  props.selectedSupplierId !== null ||
  props.showArchived
)
</script>
