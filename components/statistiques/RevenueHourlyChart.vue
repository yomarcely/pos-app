<script setup lang="ts">
import {
  VisXYContainer,
  VisStackedBar,
  VisAxis,
  VisTooltip,
  VisCrosshair,
} from '@unovis/vue'

interface HourlyPoint {
  hour: number // 0..23
  ttc: number
  ticketCount: number
}

defineProps<{
  data: HourlyPoint[]
}>()

const x = (d: HourlyPoint) => d.hour
const y = (d: HourlyPoint) => d.ticketCount

function fmtHour(h: number): string {
  return `${h}h`
}

function tooltipTpl(d: HourlyPoint): string {
  return `<div class="text-xs"><div class="font-semibold">${d.hour}h - ${d.hour + 1}h</div><div>${d.ticketCount} ticket${d.ticketCount > 1 ? 's' : ''} • ${d.ttc.toFixed(2)} €</div></div>`
}
</script>

<template>
  <div class="border rounded-lg p-4 bg-card">
    <div class="mb-2">
      <h3 class="font-semibold text-sm">Affluence horaire</h3>
      <p class="text-xs text-muted-foreground">Nombre de tickets par tranche horaire (cumul sur la période)</p>
    </div>
    <VisXYContainer
      :data="data"
      :height="260"
      :margin="{ top: 8, right: 8, bottom: 24, left: 40 }"
    >
      <VisStackedBar :x="x" :y="y" color="#3b82f6" :bar-padding="0.2" />
      <VisAxis type="x" :tick-format="fmtHour" :num-ticks="12" />
      <VisAxis type="y" :num-ticks="5" />
      <VisCrosshair :template="tooltipTpl" />
      <VisTooltip />
    </VisXYContainer>
  </div>
</template>
