<template>
  <div class="text-center py-12">
    <Package class="w-16 h-16 mx-auto text-muted-foreground mb-4" />
    <p class="text-muted-foreground text-lg">Aucun produit trouvé</p>
    <p class="text-muted-foreground text-sm">
      {{ message }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { Package } from 'lucide-vue-next'

defineProps<{
  message: string
}>()
</script>
