<script setup lang="ts">
/**
 * Sélecteur de date au format français JJ/MM/AAAA.
 *
 * Remplace `<Input type="date">` (dont l'affichage suit la locale du navigateur,
 * non maîtrisable) par un calendrier ShadCN/Reka. Conserve le MÊME contrat que
 * l'input natif : v-model est une chaîne `YYYY-MM-DD` (ou '' si vide), `min`/`max`
 * sont aussi des chaînes `YYYY-MM-DD`. Aucun changement côté logique métier.
 */
import { CalendarIcon } from 'lucide-vue-next'
import { CalendarDate, DateFormatter, parseDate, type DateValue } from '@internationalized/date'
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const props = withDefaults(defineProps<{
  modelValue?: string | null
  min?: string | null
  max?: string | null
  placeholder?: string
  disabled?: boolean
  id?: string
  class?: string
}>(), {
  modelValue: '',
  placeholder: 'JJ/MM/AAAA',
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

// Affichage : JJ/MM/AAAA (ex: 29/06/2026). timeZone UTC + toDate('UTC') :
// le jour affiché ne dépend pas du fuseau du navigateur (pas de décalage ±1).
const df = new DateFormatter('fr-FR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })

/** Parse une chaîne `YYYY-MM-DD` en DateValue ; undefined si vide/invalide. */
function toDateValue(raw: string | null | undefined): CalendarDate | undefined {
  if (!raw) return undefined
  try {
    return parseDate(raw)
  } catch {
    return undefined
  }
}

const value = computed<DateValue | undefined>({
  get: () => toDateValue(props.modelValue),
  // CalendarDate.toString() renvoie `YYYY-MM-DD` — contrat identique à l'input natif.
  set: (v) => emit('update:modelValue', v ? v.toString() : ''),
})

const minValue = computed(() => toDateValue(props.min))
const maxValue = computed(() => toDateValue(props.max))

const displayLabel = computed(() =>
  value.value ? df.format(value.value.toDate('UTC')) : props.placeholder,
)
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button
        :id="id"
        variant="outline"
        :disabled="disabled"
        :class="cn(
          'w-[150px] justify-start text-left font-normal',
          !value && 'text-muted-foreground',
          props.class,
        )"
      >
        <CalendarIcon class="mr-2 h-4 w-4" />
        {{ displayLabel }}
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0">
      <Calendar
        v-model="value"
        locale="fr-FR"
        :min-value="minValue"
        :max-value="maxValue"
        initial-focus
      />
    </PopoverContent>
  </Popover>
</template>
