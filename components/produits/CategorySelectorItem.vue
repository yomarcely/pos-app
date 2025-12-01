<template>
  <div>
    <div
      class="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent cursor-pointer"
      :style="{ paddingLeft: `${level * 1.5 + 0.5}rem` }"
    >
      <button
        v-if="hasChildren"
        type="button"
        class="p-0.5 hover:bg-accent-foreground/10 rounded flex-shrink-0"
        @click.stop="emit('toggle', category.id)"
      >
        <ChevronRight
          class="w-4 h-4 transition-transform"
          :class="{ 'rotate-90': isExpanded }"
        />
      </button>
      <div v-else class="w-5 flex-shrink-0" />

      <div class="flex items-center gap-2 flex-1 min-w-0">
        <Checkbox
          :key="`checkbox-${category.id}-${isSelected}`"
          :model-value="isSelected"
          @update:model-value="() => emit('select', category.id)"
        />
        <div class="flex items-center gap-2 flex-1 cursor-pointer" @click="emit('select', category.id)">
          <Folder class="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span class="text-sm truncate">{{ category.name }}</span>
        </div>
      </div>
    </div>

    <div v-if="isExpanded && hasChildren">
      <CategorySelectorItem
        v-for="child in category.children"
        :key="child.id"
        :category="child"
        :selected-id="selectedId"
        :expanded-categories="expandedCategories"
        :level="level + 1"
        @select="(id) => emit('select', id)"
        @toggle="(id) => emit('toggle', id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight, Folder, Check } from 'lucide-vue-next'
import { Checkbox } from '@/components/ui/checkbox'

interface Category {
  id: number
  name: string
  parentId: number | null
  children?: Category[]
}

const props = withDefaults(defineProps<{
  category: Category
  selectedId: string | null
  expandedCategories: Set<number>
  level?: number
}>(), {
  level: 0
})

const emit = defineEmits<{
  select: [id: number]
  toggle: [id: number]
}>()

const hasChildren = computed(() => {
  return props.category.children && props.category.children.length > 0
})

const isExpanded = computed(() => {
  return props.expandedCategories.has(props.category.id)
})

const isSelected = computed(() => {
  return String(props.category.id) === props.selectedId
})
</script>
