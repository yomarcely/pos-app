<script setup lang="ts">
import { computed } from 'vue'
import {
  VisXYContainer,
  VisStackedBar,
  VisAxis,
  VisTooltip,
  VisCrosshair,
} from '@unovis/vue'

interface DailyPoint {
  date: string // YYYY-MM-DD
  ttc: number
  ticketCount: number
}

const props = defineProps<{
  data: DailyPoint[]
}>()

const enriched = computed(() =>
  props.data.map(d => ({ ...d, ts: new Date(d.date).getTime() }))
)

const x = (d: DailyPoint & { ts: number }) => d.ts
const y = (d: DailyPoint & { ts: number }) => d.ttc

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function fmtEur(n: number): string {
  return `${n.toFixed(2)} €`
}

function tooltipTpl(d: DailyPoint & { ts: number }): string {
  const day = new Date(d.ts).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  return `<div class="text-xs"><div class="font-semibold capitalize">${day}</div><div>${fmtEur(d.ttc)} • ${d.ticketCount} ticket${d.ticketCount > 1 ? 's' : ''}</div></div>`
}
</script>

<template>
  <div class="border rounded-lg p-4 bg-card">
    <div class="mb-2">
      <h3 class="font-semibold text-sm">CA quotidien</h3>
      <p class="text-xs text-muted-foreground">Évolution du chiffre d'affaires TTC jour par jour</p>
    </div>
    <div v-if="enriched.length === 0" class="text-center py-12 text-sm text-muted-foreground">
      Aucune vente sur cette période
    </div>
    <VisXYContainer
      v-else
      :data="enriched"
      :height="260"
      :margin="{ top: 8, right: 8, bottom: 24, left: 48 }"
    >
      <VisStackedBar :x="x" :y="y" color="#3b82f6" :bar-padding="0.2" />
      <VisAxis type="x" :tick-format="fmtDate" :num-ticks="6" />
      <VisAxis type="y" :tick-format="fmtEur" :num-ticks="5" />
      <VisCrosshair :template="tooltipTpl" />
      <VisTooltip />
    </VisXYContainer>
  </div>
</template>
