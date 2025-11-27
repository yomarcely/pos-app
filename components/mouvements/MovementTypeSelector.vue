<template>
  <Card>
    <CardHeader>
      <CardTitle>Type de mouvement</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="grid grid-cols-3 gap-4">
        <Button
          :variant="modelValue === 'entry' ? 'default' : 'outline'"
          size="lg"
          @click="$emit('update:modelValue', 'entry')"
          class="h-20 flex flex-col gap-2"
        >
          <PackagePlus class="w-6 h-6" />
          <span>Entrée / Sortie</span>
        </Button>
        <Button
          :variant="modelValue === 'adjustment' ? 'default' : 'outline'"
          size="lg"
          @click="$emit('update:modelValue', 'adjustment')"
          class="h-20 flex flex-col gap-2"
        >
          <Settings class="w-6 h-6" />
          <span>Ajustement</span>
        </Button>
        <Button
          :variant="modelValue === 'loss' ? 'default' : 'outline'"
          size="lg"
          @click="$emit('update:modelValue', 'loss')"
          class="h-20 flex flex-col gap-2"
        >
          <AlertTriangle class="w-6 h-6" />
          <span>Pertes</span>
        </Button>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { PackagePlus, Settings, AlertTriangle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MovementType } from '@/types/mouvements'

defineProps<{
  modelValue: MovementType
}>()

defineEmits<{
  'update:modelValue': [value: MovementType]
}>()
</script>
