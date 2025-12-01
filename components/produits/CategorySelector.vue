<template>
  <div class="space-y-2">
    <Label>Catégorie</Label>
    <Button
      variant="outline"
      type="button"
      class="w-full justify-between"
      @click="open = true"
    >
      <div class="flex flex-wrap items-center gap-1">
        <template v-if="selectedCategoryPath.length">
          <Badge
            v-for="name in selectedCategoryPath"
            :key="name"
            variant="secondary"
            class="text-xs"
          >
            {{ name }}
          </Badge>
        </template>
        <span v-else class="text-sm text-muted-foreground">Sélectionner une catégorie</span>
      </div>
      <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>

    <Dialog v-model:open="open">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Sélectionner une catégorie</DialogTitle>
        </DialogHeader>
        <div class="max-h-[400px] overflow-y-auto pr-2">
          <div v-if="categories.length === 0" class="p-4 text-center text-sm text-muted-foreground">
            Aucune catégorie disponible
          </div>
          <CategorySelectorItem
            v-for="category in categories"
            :key="category.id"
            :category="category"
            :selected-id="modelValue"
            :expanded-categories="expandedCategories"
            :level="0"
            @select="handleSelect"
            @toggle="toggleCategory"
          />
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ChevronsUpDown } from 'lucide-vue-next'
import CategorySelectorItem from '@/components/produits/CategorySelectorItem.vue'

interface Category {
  id: number
  name: string
  parentId: number | null
  children?: Category[]
}

const props = defineProps<{
  categories: Category[]
  modelValue: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const open = ref(false)
const expandedCategories = ref<Set<number>>(new Set())

const selectedCategoryPath = computed(() => {
  if (!props.modelValue) return []

  const findPath = (cats: Category[], targetId: number, path: string[] = []): string[] | null => {
    for (const cat of cats) {
      const currentPath = [...path, cat.name]
      if (cat.id === targetId) {
        return currentPath
      }
      if (cat.children?.length) {
        const childPath = findPath(cat.children, targetId, currentPath)
        if (childPath) return childPath
      }
    }
    return null
  }

  return findPath(props.categories, parseInt(props.modelValue)) || []
})

// Expand parent categories when dialog opens with a selected category
watch(open, (isOpen) => {
  if (isOpen) {
    // Clear expanded categories
    expandedCategories.value.clear()

    // Expand parents of selected category
    if (props.modelValue) {
      expandParentCategories(parseInt(props.modelValue))
    }
  }
})

function expandParentCategories(categoryId: number) {
  const findParents = (cats: Category[], targetId: number, parents: number[] = []): number[] | null => {
    for (const cat of cats) {
      if (cat.id === targetId) {
        return parents
      }
      if (cat.children?.length) {
        const found = findParents(cat.children, targetId, [...parents, cat.id])
        if (found) return found
      }
    }
    return null
  }

  const parents = findParents(props.categories, categoryId)
  if (parents) {
    parents.forEach(parentId => expandedCategories.value.add(parentId))
  }
}

function handleSelect(categoryId: number) {
  emit('update:modelValue', String(categoryId))
  open.value = false
}

function toggleCategory(categoryId: number) {
  if (expandedCategories.value.has(categoryId)) {
    expandedCategories.value.delete(categoryId)
  } else {
    expandedCategories.value.add(categoryId)
  }
}
</script>
