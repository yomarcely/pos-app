<script setup lang="ts">
import Toaster from '@/components/ui/sonner/Sonner.vue'
import 'vue-sonner/style.css'
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ClientOnly>
    <Toaster position="top-center" rich-colors close-button />
  </ClientOnly>
</template>
