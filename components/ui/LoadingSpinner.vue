<template>
  <div :class="containerClass">
    <div
      :class="[
        'rounded-full border-b-2 border-primary animate-spin',
        sizeClasses[size]
      ]"
    ></div>
    <p v-if="text" :class="['mt-2', textSizeClasses[size]]">{{ text }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  text?: string
  centered?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'lg',
  centered: true
})

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16'
}

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg'
}

const containerClass = computed(() => {
  const baseClasses = ['flex flex-col items-center']
  if (props.centered) {
    baseClasses.push('justify-center py-12')
  }
  return baseClasses.join(' ')
})
</script>
