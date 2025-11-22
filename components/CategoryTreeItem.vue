<template>
  <div class="space-y-1">
    <div
      class="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer transition-colors"
      :class="{ 'bg-accent': selectedId === category.id }"
      @click="$emit('select', category.id)"
    >
      <div
        v-if="category.children && category.children.length > 0"
        class="flex-shrink-0 w-4 h-4 flex items-center justify-center cursor-pointer"
        @click.stop="expanded = !expanded"
      >
        <ChevronRight
          class="w-4 h-4 transition-transform"
          :class="{ 'rotate-90': expanded }"
        />
      </div>
      <div v-else class="w-4" />

      <span class="flex-1 text-sm">{{ category.name }}</span>

      <button
        class="flex-shrink-0 w-5 h-5 rounded hover:bg-primary/20 flex items-center justify-center opacity-50 group-hover:opacity-100 transition-opacity"
        @click.stop="$emit('addSubcategory', category.id)"
        title="Ajouter une sous-catégorie"
      >
        <Plus class="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      <div
        v-if="selectedId === category.id"
        class="flex-shrink-0 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
      >
        <Check class="w-3 h-3 text-primary-foreground" />
      </div>
    </div>

    <div v-if="expanded && category.children && category.children.length > 0" class="ml-4 space-y-1">
      <CategoryTreeItem
        v-for="child in category.children"
        :key="child.id"
        :category="child"
        :selected-id="selectedId"
        @select="$emit('select', $event)"
        @add-subcategory="$emit('addSubcategory', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight, Check, Plus } from 'lucide-vue-next'

interface Category {
  id: number
  name: string
  children?: Category[]
}

defineProps<{
  category: Category
  selectedId: number | null
}>()

defineEmits<{
  select: [id: number]
  addSubcategory: [parentId: number]
}>()

const expanded = ref(false)
</script>
