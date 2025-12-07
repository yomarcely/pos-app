<template>
  <div class="space-y-2">
    <Label :for="id">{{ label }}</Label>
    <div class="space-y-2">
      <div v-if="loading" class="text-sm text-muted-foreground">
        Chargement des établissements...
      </div>
      <div v-else-if="establishments.length === 0" class="text-sm text-muted-foreground">
        Aucun établissement disponible
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="establishment in establishments"
          :key="`${establishment.id}-${isSelected(establishment.id)}`"
          class="flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50"
        >
          <Checkbox
            :id="`establishment-${establishment.id}`"
            :model-value="isSelected(establishment.id)"
            @update:model-value="(checked) => toggleEstablishment(establishment.id, checked)"
          />
          <Label
            :for="`establishment-${establishment.id}`"
            class="flex-1 cursor-pointer text-sm font-normal"
          >
            <div class="flex items-center justify-between">
              <span>{{ establishment.name }}</span>
              <span v-if="establishment.city" class="text-xs text-muted-foreground ml-2">
                {{ establishment.city }}
              </span>
            </div>
          </Label>
        </div>
      </div>
      <div v-if="selectedCount > 0" class="text-xs text-muted-foreground">
        {{ selectedCount }} établissement{{ selectedCount > 1 ? 's' : '' }} sélectionné{{ selectedCount > 1 ? 's' : '' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface Establishment {
  id: number
  name: string
  city?: string | null
}

interface Props {
  modelValue: number[]
  label?: string
  id?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: 'Établissements',
  id: 'establishments',
})

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
}>()

const establishments = ref<Establishment[]>([])
const loading = ref(true)

const selectedCount = computed(() => props.modelValue.length)

function isSelected(id: number): boolean {
  return props.modelValue.includes(id)
}

function toggleEstablishment(id: number, checked: boolean | 'indeterminate') {
  console.log('toggleEstablishment called with id:', id, 'checked:', checked, 'current:', props.modelValue)

  if (checked === 'indeterminate') return

  const currentValue = [...props.modelValue]
  const index = currentValue.indexOf(id)

  if (checked && index === -1) {
    // Ajouter si coché et pas déjà présent
    currentValue.push(id)
    console.log('Added:', id, 'New array:', currentValue)
  } else if (!checked && index > -1) {
    // Retirer si décoché et présent
    currentValue.splice(index, 1)
    console.log('Removed:', id, 'New array:', currentValue)
  }

  console.log('Emitting update:modelValue with:', currentValue)
  emit('update:modelValue', currentValue)
}

async function loadEstablishments() {
  try {
    loading.value = true
    const response = await $fetch<{ establishments: Establishment[] }>('/api/establishments')
    establishments.value = response.establishments || []
  } catch (error) {
    console.error('Erreur lors du chargement des établissements:', error)
    establishments.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadEstablishments()
})
</script>
