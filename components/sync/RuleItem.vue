<template>
  <div class="flex items-center gap-2">
    <Check v-if="enabled" class="w-4 h-4 text-green-600" />
    <X v-else class="w-4 h-4 text-gray-400" />
    <span :class="enabled ? 'text-gray-900' : 'text-gray-500'">
      {{ label }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { Check, X } from 'lucide-vue-next'

defineProps<{
  label: string
  enabled?: boolean
}>()
</script>
