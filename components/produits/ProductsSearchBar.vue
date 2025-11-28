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
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Search, List, Grid } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Category } from '@/types'

defineProps<{
  searchQuery: string
  selectedCategoryId: number | null
  categories: Category[]
  viewMode: 'list' | 'grid'
}>()

defineEmits<{
  'update:searchQuery': [value: string]
  'update:selectedCategoryId': [value: number | null]
  'update:viewMode': [value: 'list' | 'grid']
  'search': []
  'categoryChange': []
}>()
</script>
