<template>
  <div :class="containerClass">
    <component
      v-if="icon"
      :is="icon"
      :class="['mx-auto mb-4', iconSizeClasses[size], iconColorClass]"
    />
    <p :class="['font-medium', titleSizeClasses[size], titleColorClass]">
      {{ title }}
    </p>
    <p v-if="description" :class="['mt-1', descriptionSizeClasses[size], 'text-muted-foreground']">
      {{ description }}
    </p>
    <slot name="actions" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'

interface Props {
  icon?: Component
  title: string
  description?: string
  size?: 'sm' | 'md' | 'lg'
  centered?: boolean
  iconColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  centered: true,
  iconColor: 'text-muted-foreground'
})

const iconSizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-20 h-20'
}

const titleSizeClasses = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-xl'
}

const descriptionSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base'
}

const containerClass = computed(() => {
  const baseClasses = ['text-center']
  if (props.centered) {
    baseClasses.push('py-12')
  } else {
    baseClasses.push('py-8')
  }
  return baseClasses.join(' ')
})

const iconColorClass = computed(() => props.iconColor)
const titleColorClass = computed(() => 'text-foreground')
</script>
