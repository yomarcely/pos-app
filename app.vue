<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Toaster from '@/components/ui/toast/Toaster.vue'
import { setToasterInstance } from '@/composables/useToast'

const toaster = ref()

onMounted(() => {
  if (toaster.value) {
    setToasterInstance(toaster.value)
  }
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <Toaster ref="toaster" />
</template>
