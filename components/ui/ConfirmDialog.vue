<template>
  <Dialog v-model:open="internalOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription v-if="description">
          {{ description }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="handleCancel">Annuler</Button>
        <Button :variant="variant" @click="handleConfirm">
          {{ confirmLabel }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Props {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
}

const props = withDefaults(defineProps<Props>(), {
  confirmLabel: 'Confirmer',
  variant: 'destructive'
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': []
}>()

const internalOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

function handleConfirm() {
  emit('confirm')
}

function handleCancel() {
  internalOpen.value = false
}
</script>
