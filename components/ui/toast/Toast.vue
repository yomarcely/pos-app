<script setup lang="ts">
import { computed } from 'vue'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-vue-next'

export interface ToastProps {
  id: string
  type?: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
  duration?: number
}

const props = withDefaults(defineProps<ToastProps>(), {
  type: 'info',
  duration: 5000
})

const emit = defineEmits<{
  close: [id: string]
}>()

const icon = computed(() => {
  switch (props.type) {
    case 'success':
      return CheckCircle
    case 'error':
      return AlertCircle
    case 'warning':
      return AlertTriangle
    default:
      return Info
  }
})

const colorClasses = computed(() => {
  switch (props.type) {
    case 'success':
      return 'border-green-500 bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100'
    case 'error':
      return 'border-red-500 bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100'
    case 'warning':
      return 'border-orange-500 bg-orange-50 dark:bg-orange-950 text-orange-900 dark:text-orange-100'
    default:
      return 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-100'
  }
})

const iconColorClasses = computed(() => {
  switch (props.type) {
    case 'success':
      return 'text-green-600 dark:text-green-400'
    case 'error':
      return 'text-red-600 dark:text-red-400'
    case 'warning':
      return 'text-orange-600 dark:text-orange-400'
    default:
      return 'text-blue-600 dark:text-blue-400'
  }
})
</script>

<template>
  <div
    :class="[
      'flex items-start gap-3 p-4 rounded-lg border-l-4 shadow-lg min-w-[320px] max-w-md',
      colorClasses
    ]"
  >
    <component :is="icon" :class="['w-5 h-5 flex-shrink-0 mt-0.5', iconColorClasses]" />
    <div class="flex-1">
      <h3 class="font-semibold text-sm">{{ title }}</h3>
      <p v-if="description" class="text-sm opacity-90 mt-1">{{ description }}</p>
    </div>
    <button
      @click="emit('close', id)"
      class="text-current opacity-50 hover:opacity-100 transition-opacity"
    >
      <X class="w-4 h-4" />
    </button>
  </div>
</template>
