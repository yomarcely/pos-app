<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ChevronsUpDown, Plus, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type Id = string | number

interface Item {
  id: Id
  label: string
}

const props = withDefaults(defineProps<{
  modelValue: Id | null
  items: Item[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  allowClear?: boolean
  /** Affiche un bouton "+ Ajouter" en bas de la liste */
  showAddButton?: boolean
  addLabel?: string
}>(), {
  placeholder: 'Sélectionner...',
  searchPlaceholder: 'Rechercher...',
  emptyText: 'Aucun résultat',
  disabled: false,
  allowClear: true,
  showAddButton: false,
  addLabel: 'Ajouter',
})

const emit = defineEmits<{
  'update:modelValue': [value: Id | null]
  'add': []
}>()

const isOpen = ref(false)

// Comparaison souple : selectedItem se base sur string(id) pour accepter
// indifféremment number/string en modelValue (compat <Select> existants)
function idEqual(a: Id | null, b: Id): boolean {
  if (a === null) return false
  return String(a) === String(b)
}

const selectedItem = computed(() =>
  props.items.find((s) => idEqual(props.modelValue, s.id)) || null,
)

// La valeur de CommandItem doit être string ; on stocke l'id stringifié
// et on convertit en retour si le type d'origine était number.
function handleSelect(item: Item) {
  emit('update:modelValue', item.id)
  isOpen.value = false
}

function handleClear(event: Event) {
  event.stopPropagation()
  emit('update:modelValue', null)
}
</script>

<template>
  <Popover v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        :aria-expanded="isOpen"
        :disabled="disabled"
        :class="cn('w-full justify-between font-normal', !selectedItem && 'text-muted-foreground')"
      >
        <span class="truncate">{{ selectedItem?.label || placeholder }}</span>
        <div class="flex items-center gap-1 shrink-0">
          <span
            v-if="selectedItem && allowClear"
            class="inline-flex items-center justify-center w-4 h-4 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted"
            role="button"
            tabindex="0"
            aria-label="Effacer la sélection"
            @click="handleClear"
            @keydown.enter="handleClear"
          >
            <X class="w-3 h-3" />
          </span>
          <ChevronsUpDown class="h-4 w-4 opacity-50" />
        </div>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-(--reka-popover-trigger-width) p-0" align="start">
      <Command>
        <CommandInput :placeholder="searchPlaceholder" />
        <CommandList>
          <CommandEmpty>{{ emptyText }}</CommandEmpty>
          <CommandGroup>
            <CommandItem
              v-for="item in items"
              :key="item.id"
              :value="item.label"
              @select="handleSelect(item)"
            >
              <Check
                :class="cn(
                  'mr-2 h-4 w-4',
                  idEqual(modelValue, item.id) ? 'opacity-100' : 'opacity-0',
                )"
              />
              <span class="truncate">{{ item.label }}</span>
            </CommandItem>
          </CommandGroup>
          <template v-if="showAddButton">
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="__add__"
                class="text-primary"
                @select="emit('add'); isOpen = false"
              >
                <Plus class="mr-2 h-4 w-4" />
                {{ addLabel }}
              </CommandItem>
            </CommandGroup>
          </template>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
