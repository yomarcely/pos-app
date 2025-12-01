<template>
  <Card>
    <CardHeader>
      <CardTitle>Informations générales</CardTitle>
      <CardDescription>Informations de base du produit</CardDescription>
    </CardHeader>
    <CardContent class="space-y-6">
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

      <!-- Description -->
      <div class="space-y-2">
        <Label for="description">Description</Label>
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

      <!-- Fournisseur -->
      <div class="space-y-2">
        <Label for="supplier">Fournisseur</Label>
        <div class="flex gap-2">
          <Select :model-value="form.supplierId" @update:model-value="$emit('update:form', { ...form, supplierId: String($event) })">
            <SelectTrigger id="supplier" class="flex-1">
              <SelectValue placeholder="Sélectionner un fournisseur" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="supplier in suppliers" :key="supplier.id" :value="supplier.id.toString()">
                {{ supplier.name }}
              </SelectItem>
            </SelectContent>
          </Select>
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
          <Select :model-value="form.brandId" @update:model-value="$emit('update:form', { ...form, brandId: String($event) })">
            <SelectTrigger id="brand" class="flex-1">
              <SelectValue placeholder="Sélectionner une marque" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="brand in brands" :key="brand.id" :value="brand.id.toString()">
                {{ brand.name }}
              </SelectItem>
            </SelectContent>
          </Select>
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

      <!-- Upload photo -->
      <div class="space-y-2">
        <Label>Photo du produit</Label>
        <div
          class="relative w-full aspect-square max-w-xs rounded-lg border-2 border-dashed transition-colors"
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
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
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
