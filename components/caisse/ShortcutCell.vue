<script setup lang="ts">
import { computed } from 'vue'
import type { Shortcut } from '@/types/shortcut'
import { Package, Percent, Navigation, UserRound, Plus, PanelTop } from 'lucide-vue-next'

const props = defineProps<{
  shortcut: Shortcut | null
}>()

defineEmits<{
  execute: []
}>()

const iconComponent = computed(() => {
  if (!props.shortcut) return Plus
  const map = {
    product: Package,
    discount: Percent,
    navigation: Navigation,
    client: UserRound,
    tab: PanelTop,
  } as const
  return map[props.shortcut.type]
})

const productImage = computed(() => {
  if (props.shortcut?.type === 'product') return props.shortcut.image
  return null
})

const bgClass = computed(() => {
  if (!props.shortcut) return 'bg-muted/40 hover:bg-muted/70 border-2 border-dashed border-muted-foreground/25'
  return 'hover:opacity-80 border-transparent shadow-sm'
})

const bgStyle = computed(() => {
  if (!props.shortcut) return {}
  return { backgroundColor: props.shortcut.color }
})

const textClass = computed(() => {
  if (!props.shortcut) return 'text-muted-foreground'
  return 'text-white'
})

const displayLabel = computed(() => {
  if (!props.shortcut) return ''
  return props.shortcut.label
})
</script>

<template>
  <button
    class="h-20 w-full rounded-lg border text-xs font-medium flex flex-col items-center justify-center gap-1 transition-all cursor-pointer select-none overflow-hidden px-1 active:scale-95"
    :class="[bgClass, textClass]"
    :style="bgStyle"
    @click="$emit('execute')"
  >
    <!-- Image produit -->
    <template v-if="productImage">
      <img
        :src="productImage"
        :alt="displayLabel"
        class="w-9 h-9 rounded object-cover shrink-0"
      />
    </template>
    <!-- Icône par défaut -->
    <template v-else>
      <component
        :is="iconComponent"
        class="w-5 h-5 shrink-0"
        :class="shortcut ? 'opacity-90' : 'opacity-40'"
      />
    </template>
    <span v-if="displayLabel" class="truncate max-w-full leading-tight text-center text-[11px]">{{ displayLabel }}</span>
  </button>
</template>
