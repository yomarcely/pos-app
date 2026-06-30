<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import DatePicker from '@/components/shared/DatePicker.vue'

interface Period {
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
}

const props = defineProps<{
  modelValue: Period
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Period]
}>()

const startDate = ref(props.modelValue.startDate)
const endDate = ref(props.modelValue.endDate)

watch(
  () => props.modelValue,
  (v) => {
    startDate.value = v.startDate
    endDate.value = v.endDate
  }
)

function emitChange() {
  emit('update:modelValue', { startDate: startDate.value, endDate: endDate.value })
}

function applyPreset(preset: 'today' | '7d' | '30d' | 'mtd' | 'ytd') {
  const today = new Date()
  const end = formatDate(today)
  let start: Date
  switch (preset) {
    case 'today':
      start = today
      break
    case '7d':
      start = new Date(today)
      start.setDate(today.getDate() - 6)
      break
    case '30d':
      start = new Date(today)
      start.setDate(today.getDate() - 29)
      break
    case 'mtd':
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      break
    case 'ytd':
      start = new Date(today.getFullYear(), 0, 1)
      break
  }
  startDate.value = formatDate(start)
  endDate.value = end
  emitChange()
}

// Date locale (et non UTC) : sinon en soirée les presets renvoient la veille.
function formatDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const activePreset = computed<string | null>(() => {
  const today = formatDate(new Date())
  if (endDate.value !== today) return null
  const start = new Date(startDate.value)
  const now = new Date(today)
  const diffDays = Math.round((now.getTime() - start.getTime()) / 86_400_000)
  if (startDate.value === today) return 'today'
  if (diffDays === 6) return '7d'
  if (diffDays === 29) return '30d'
  if (start.getDate() === 1 && start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear()) return 'mtd'
  if (start.getDate() === 1 && start.getMonth() === 0 && start.getFullYear() === now.getFullYear()) return 'ytd'
  return null
})
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <div class="flex items-center gap-1">
      <Button
        size="sm"
        :variant="activePreset === 'today' ? 'default' : 'outline'"
        @click="applyPreset('today')"
      >
        Aujourd'hui
      </Button>
      <Button
        size="sm"
        :variant="activePreset === '7d' ? 'default' : 'outline'"
        @click="applyPreset('7d')"
      >
        7 jours
      </Button>
      <Button
        size="sm"
        :variant="activePreset === '30d' ? 'default' : 'outline'"
        @click="applyPreset('30d')"
      >
        30 jours
      </Button>
      <Button
        size="sm"
        :variant="activePreset === 'mtd' ? 'default' : 'outline'"
        @click="applyPreset('mtd')"
      >
        Ce mois
      </Button>
      <Button
        size="sm"
        :variant="activePreset === 'ytd' ? 'default' : 'outline'"
        @click="applyPreset('ytd')"
      >
        Cette année
      </Button>
    </div>

    <div class="flex items-center gap-2 ml-2">
      <DatePicker
        v-model="startDate"
        :max="endDate"
        @update:model-value="emitChange"
      />
      <span class="text-sm text-muted-foreground">→</span>
      <DatePicker
        v-model="endDate"
        :min="startDate"
        @update:model-value="emitChange"
      />
    </div>
  </div>
</template>
