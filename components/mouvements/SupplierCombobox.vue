<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, ChevronsUpDown, Search } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface SupplierOption {
  id: number
  name: string
}

const props = withDefaults(defineProps<{
  modelValue: number | null
  suppliers: SupplierOption[]
  placeholder?: string
  disabled?: boolean
}>(), {
  placeholder: 'Sélectionner un fournisseur...',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const isOpen = ref(false)
const searchTerm = ref('')
const containerRef = ref<HTMLDivElement | null>(null)

const selectedSupplier = computed(() =>
  props.suppliers.find((s) => s.id === props.modelValue) || null
)

const filtered = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()
  if (!term) return props.suppliers
  return props.suppliers.filter((s) => s.name.toLowerCase().includes(term))
})

function toggle() {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (isOpen.value) searchTerm.value = ''
}

function select(supplier: SupplierOption) {
  emit('update:modelValue', supplier.id)
  isOpen.value = false
}

function clear(event: MouseEvent) {
  event.stopPropagation()
  emit('update:modelValue', null)
}

function handleClickOutside(event: MouseEvent) {
  if (!containerRef.value) return
  if (!containerRef.value.contains(event.target as Node)) isOpen.value = false
}

onMounted(() => document.addEventListener('mousedown', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', handleClickOutside))
</script>

<template>
  <div ref="containerRef" class="relative w-full">
    <Button
      type="button"
      variant="outline"
      role="combobox"
      :aria-expanded="isOpen"
      :disabled="disabled"
      :class="cn('w-full justify-between font-normal', !selectedSupplier && 'text-muted-foreground')"
      @click="toggle"
    >
      <span class="truncate">{{ selectedSupplier?.name || placeholder }}</span>
      <div class="flex items-center gap-1 shrink-0">
        <span
          v-if="selectedSupplier"
          class="text-xs text-muted-foreground hover:text-foreground"
          role="button"
          tabindex="0"
          @click="clear"
        >
          ✕
        </span>
        <ChevronsUpDown class="h-4 w-4 opacity-50" />
      </div>
    </Button>

    <div
      v-if="isOpen"
      class="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md"
    >
      <div class="flex items-center gap-2 border-b px-3">
        <Search class="size-4 shrink-0 opacity-50" />
        <Input
          v-model="searchTerm"
          placeholder="Rechercher un fournisseur..."
          class="h-10 border-0 px-0 shadow-none focus-visible:ring-0"
        />
      </div>
      <div class="max-h-[300px] overflow-y-auto p-1">
        <div
          v-if="filtered.length === 0"
          class="py-6 text-center text-sm text-muted-foreground"
        >
          Aucun fournisseur trouvé
        </div>
        <button
          v-for="supplier in filtered"
          :key="supplier.id"
          type="button"
          class="relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
          @click="select(supplier)"
        >
          <Check
            :class="cn(
              'h-4 w-4',
              modelValue === supplier.id ? 'opacity-100' : 'opacity-0',
            )"
          />
          <span class="truncate">{{ supplier.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
