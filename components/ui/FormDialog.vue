<template>
  <Dialog v-model:open="internalOpen">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription v-if="description">
          {{ description }}
        </DialogDescription>
      </DialogHeader>
      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label :for="inputId">{{ label }}</Label>
          <Input
            :id="inputId"
            v-model="internalValue"
            :placeholder="placeholder"
            @keyup.enter="handleSubmit"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="handleCancel">Annuler</Button>
        <Button @click="handleSubmit" :disabled="!internalValue.trim()">
          {{ submitLabel }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  open: boolean
  title: string
  description?: string
  label: string
  placeholder?: string
  submitLabel?: string
  modelValue?: string
}

const props = withDefaults(defineProps<Props>(), {
  submitLabel: 'Confirmer',
  modelValue: ''
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:modelValue': [value: string]
  'submit': [value: string]
}>()

const internalOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const internalValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const inputId = computed(() => props.label.toLowerCase().replace(/\s+/g, '-'))

function handleSubmit() {
  if (internalValue.value.trim()) {
    emit('submit', internalValue.value)
  }
}

function handleCancel() {
  internalOpen.value = false
}

// Reset value when dialog closes
watch(() => props.open, (newVal) => {
  if (!newVal) {
    emit('update:modelValue', '')
  }
})
</script>
