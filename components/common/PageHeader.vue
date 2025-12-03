<template>
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold">{{ title }}</h1>
      <p v-if="description" class="text-muted-foreground mt-1">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>
