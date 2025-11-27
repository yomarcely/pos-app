<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="w-[1100px] max-w-[1100px] h-[80vh]">
      <DialogHeader>
        <DialogTitle>Sélectionner un produit</DialogTitle>
      </DialogHeader>

      <!-- Filtres -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 py-4">
        <div>
          <Label>Recherche</Label>
          <Input
            :model-value="searchQuery"
            placeholder="Nom ou code-barres..."
            @update:model-value="(value) => $emit('update:searchQuery', value as string)"
          />
        </div>
        <div>
          <Label>Catégorie</Label>
          <select
            :value="selectedCategory"
            class="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            @change="$emit('update:selectedCategory', parseInt(($event.target as HTMLSelectElement).value) || null)"
          >
            <option :value="null">Toutes les catégories</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </div>
        <div>
          <Label>Fournisseur</Label>
          <select
            :value="selectedSupplier"
            class="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            @change="$emit('update:selectedSupplier', parseInt(($event.target as HTMLSelectElement).value) || null)"
          >
            <option :value="null">Tous les fournisseurs</option>
            <option v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id">
              {{ supplier.name }}
            </option>
          </select>
        </div>
        <div>
          <Label>Marque</Label>
          <select
            :value="selectedBrand"
            class="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            @change="$emit('update:selectedBrand', parseInt(($event.target as HTMLSelectElement).value) || null)"
          >
            <option :value="null">Toutes les marques</option>
            <option v-for="brand in brands" :key="brand.id" :value="brand.id">
              {{ brand.name }}
            </option>
          </select>
        </div>
      </div>

      <!-- Liste des produits -->
      <div class="border rounded-lg overflow-hidden flex flex-col h-[calc(80vh-220px)]">
        <div v-if="loading" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>

        <div v-else class="flex-1 overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50">
              <tr>
                <th class="px-4 py-2 text-left w-14">Image</th>
                <th class="px-4 py-2 text-left">Produit</th>
                <th class="px-4 py-2 text-center w-24">Stock</th>
                <th class="px-4 py-2 text-left">Catégorie</th>
                <th class="px-4 py-2 text-left">Fournisseur</th>
                <th class="px-4 py-2 text-left">Marque</th>
                <th class="px-4 py-2 text-center w-28">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="products.length === 0">
                <td colspan="7" class="px-4 py-6 text-center text-muted-foreground">
                  Aucun produit trouvé
                </td>
              </tr>
              <tr
                v-for="product in products"
                :key="product.id"
                class="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer"
                @click="$emit('selectProduct', product)"
              >
                <td class="px-4 py-3">
                  <div v-if="product.image" class="w-12 h-12 rounded-md overflow-hidden bg-muted">
                    <img :src="product.image" :alt="product.name" class="w-full h-full object-cover" />
                  </div>
                  <div v-else class="w-12 h-12 rounded-md bg-muted flex items-center justify-center">
                    <Package class="w-5 h-5 text-muted-foreground" />
                  </div>
                </td>
                <td class="px-4 py-3">
                  <p class="font-medium">{{ product.name }}</p>
                  <p v-if="product.barcode" class="text-xs text-muted-foreground">CB: {{ product.barcode }}</p>
                </td>
                <td class="px-4 py-3 text-center">
                  <span class="px-2 py-1 rounded-full text-xs font-medium bg-muted">
                    {{ getTotalStock(product) }}
                  </span>
                </td>
                <td class="px-4 py-3 text-sm text-muted-foreground">
                  {{ product.categoryName || '—' }}
                </td>
                <td class="px-4 py-3 text-sm text-muted-foreground">
                  {{ product.supplierName || '—' }}
                </td>
                <td class="px-4 py-3 text-sm text-muted-foreground">
                  {{ product.brandName || '—' }}
                </td>
                <td class="px-4 py-3 text-center" @click.stop>
                  <Button size="sm" variant="outline" @click="$emit('selectProduct', product)">
                    Ajouter
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="$emit('update:open', false)">
          Fermer
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Package } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Product, Category, Supplier, Brand } from '@/types/mouvements'

defineProps<{
  open: boolean
  searchQuery: string
  selectedCategory: number | null
  selectedSupplier: number | null
  selectedBrand: number | null
  products: Product[]
  categories: Category[]
  suppliers: Supplier[]
  brands: Brand[]
  loading: boolean
}>()

defineEmits<{
  'update:open': [value: boolean]
  'update:searchQuery': [value: string]
  'update:selectedCategory': [value: number | null]
  'update:selectedSupplier': [value: number | null]
  'update:selectedBrand': [value: number | null]
  'selectProduct': [product: Product]
}>()

function getTotalStock(product: Product): number {
  if (product.stockByVariation && Object.keys(product.stockByVariation).length > 0) {
    return Object.values(product.stockByVariation).reduce((sum, qty) => sum + Number(qty || 0), 0)
  }
  return product.stock || 0
}
</script>
