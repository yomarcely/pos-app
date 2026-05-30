<template>
  <Card>
    <CardHeader>
      <CardTitle>Informations générales</CardTitle>
      <CardDescription>Informations de base du produit</CardDescription>
    </CardHeader>
    <CardContent class="space-y-8">
      <div class="grid gap-8 lg:grid-cols-2 lg:items-start lg:justify-center">
        <div class="space-y-4 w-full max-w-lg lg:ml-auto lg:mr-6">
          <!-- Nom du produit -->
          <div class="space-y-2">
            <Label for="name">Nom du produit *</Label>
            <Input
              id="name"
              :model-value="form.name"
              placeholder="Ex: T-shirt Bleu"
              @update:model-value="$emit('update:form', { ...form, name: $event as string })"
            />
          </div>

          <!-- Catégorie (slot injecté depuis la page) -->
          <slot name="category" />

          <!-- Fournisseur -->
          <div class="space-y-2">
            <Label for="supplier">Fournisseur</Label>
            <div class="flex gap-2">
              <SearchableSelect
                :model-value="form.supplierId"
                :items="supplierItems"
                placeholder="Sélectionner un fournisseur"
                search-placeholder="Rechercher un fournisseur..."
                empty-text="Aucun fournisseur trouvé"
                @update:model-value="$emit('update:form', { ...form, supplierId: $event === null ? null : String($event) })"
              />
              <Button
                variant="outline"
                size="icon"
                type="button"
                @click="$emit('add-supplier')"
                title="Ajouter un fournisseur"
              >
                <Plus class="w-4 h-4" />
              </Button>
            </div>
          </div>

          <!-- Marque -->
          <div class="space-y-2">
            <Label for="brand">Marque</Label>
            <div class="flex gap-2">
              <SearchableSelect
                :model-value="form.brandId"
                :items="brandItems"
                placeholder="Sélectionner une marque"
                search-placeholder="Rechercher une marque..."
                empty-text="Aucune marque trouvée"
                @update:model-value="$emit('update:form', { ...form, brandId: $event === null ? null : String($event) })"
              />
              <Button
                variant="outline"
                size="icon"
                type="button"
                @click="$emit('add-brand')"
                title="Ajouter une marque"
              >
                <Plus class="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Colonne droite : photo + description -->
        <div class="space-y-4 w-full max-w-sm lg:max-w-[320px] lg:mr-auto lg:flex lg:flex-col lg:items-center">
          <!-- Upload photo -->
          <div class="space-y-2 w-full">
            <Label class="text-center lg:text-left">Photo du produit</Label>
            <div
              class="relative w-full aspect-square max-w-[320px] rounded-lg border-2 border-dashed transition-colors"
              :class="isDragging ? 'border-primary bg-primary/5' : 'border-muted bg-muted/50'"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="handleDrop"
            >
              <!-- Image preview -->
              <img
                v-if="form.image"
                :src="form.image"
                alt="Preview"
                class="w-full h-full object-cover rounded-lg"
              />

              <!-- Upload zone -->
              <div
                v-else
                class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6"
              >
                <ImageIcon class="w-12 h-12 text-muted-foreground" />
                <div class="text-center">
                  <p class="text-sm text-muted-foreground mb-2">
                    Glissez-déposez une image ici
                  </p>
                  <p class="text-xs text-muted-foreground mb-3">ou</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    @click="fileInput?.click()"
                  >
                    <Upload class="w-4 h-4 mr-2" />
                    Parcourir
                  </Button>
                </div>
              </div>

              <!-- Remove button -->
              <Button
                v-if="form.image"
                type="button"
                variant="destructive"
                size="icon"
                class="absolute top-2 right-2"
                @click="$emit('update:form', { ...form, image: null }); isDragging = false"
              >
                <X class="w-4 h-4" />
              </Button>
            </div>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleFileSelect"
            />
          </div>

          <!-- Description alignée sur la largeur de la photo -->
          <div class="space-y-2 w-full max-w-[320px] lg:self-center">
            <Label for="description" class="text-center lg:text-left">Description</Label>
            <Textarea
              id="description"
              :model-value="form.description"
              placeholder="Décrivez votre produit..."
              rows="4"
              @update:model-value="$emit('update:form', { ...form, description: $event as string })"
            />
            <p class="text-xs text-muted-foreground">
              Description détaillée du produit (optionnel)
            </p>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import SearchableSelect from '@/components/shared/SearchableSelect.vue'
import { Plus, Upload, X, Image as ImageIcon } from 'lucide-vue-next'

interface ProductForm {
  name: string
  description: string
  supplierId: string | null
  brandId: string | null
  image: string | null
}

interface Supplier {
  id: number
  name: string
}

interface Brand {
  id: number
  name: string
}

const props = defineProps<{
  form: ProductForm
  suppliers: Supplier[]
  brands: Brand[]
}>()

const emit = defineEmits<{
  'update:form': [value: ProductForm]
  'add-supplier': []
  'add-brand': []
}>()

const supplierItems = computed(() =>
  props.suppliers.map((s) => ({ id: s.id, label: s.name })),
)
const brandItems = computed(() =>
  props.brands.map((b) => ({ id: b.id, label: b.name })),
)

const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function handleDrop(e: DragEvent) {
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0 && files[0]) {
    handleFile(files[0])
  }
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0 && files[0]) {
    handleFile(files[0])
  }
}

function handleFile(file: File) {
  if (!file.type.startsWith('image/')) {
    alert('Veuillez sélectionner une image')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    const result = e.target?.result as string
    emit('update:form', { ...props.form, image: result })
  }
  reader.readAsDataURL(file)
}
</script>
