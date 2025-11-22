<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  Edit,
  Trash2,
} from 'lucide-vue-next'

interface Category {
  id: number
  name: string
  parentId: number | null
  sortOrder: number
  icon: string | null
  color: string | null
  isArchived: boolean
  children?: Category[]
}

interface Props {
  category: Category
  level?: number
  expanded?: boolean
  expandedCategories?: Set<number>
}

const props = withDefaults(defineProps<Props>(), {
  level: 0,
  expanded: false,
  expandedCategories: () => new Set(),
})

const emit = defineEmits<{
  toggle: [id: number]
  edit: [category: Category]
  delete: [category: Category]
  addSubcategory: [category: Category]
}>()

const hasChildren = computed(() => {
  return props.category.children && props.category.children.length > 0
})

const paddingLeft = computed(() => {
  return `${props.level * 2}rem`
})
</script>

<template>
  <div>
    <div
      class="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer"
      :style="{ paddingLeft }"
    >
      <div class="flex items-center gap-2 flex-1" @click="emit('toggle', category.id)">
        <component
          :is="hasChildren ? (expanded ? ChevronDown : ChevronRight) : 'div'"
          class="w-4 h-4 text-muted-foreground"
          :class="{ 'opacity-0': !hasChildren }"
        />
        <component
          :is="expanded && hasChildren ? FolderOpen : Folder"
          class="w-4 h-4"
          :style="{ color: category.color || '#3b82f6' }"
        />
        <span class="font-medium">{{ category.name }}</span>
      </div>

      <div class="flex items-center gap-1" @click.stop>
        <Button variant="ghost" size="sm" @click="emit('addSubcategory', category)">
          <Plus class="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" @click="emit('edit', category)">
          <Edit class="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" @click="emit('delete', category)">
          <Trash2 class="w-4 h-4 text-red-500" />
        </Button>
      </div>
    </div>

    <div v-if="expanded && hasChildren">
      <CategoryTreeItem
        v-for="child in category.children"
        :key="child.id"
        :category="child"
        :level="level + 1"
        :expanded="expandedCategories.has(child.id)"
        :expanded-categories="expandedCategories"
        @toggle="(id) => emit('toggle', id)"
        @edit="(cat) => emit('edit', cat)"
        @delete="(cat) => emit('delete', cat)"
        @add-subcategory="(cat) => emit('addSubcategory', cat)"
      />
    </div>
  </div>
</template>
