<script setup lang="ts">
import { CheckCircle2, Printer, FileText } from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

defineProps<{
  open: boolean
  ticketNumber?: string
  autoPrint: boolean
}>()

defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'update:autoPrint', value: boolean): void
  (e: 'print-receipt'): void
  (e: 'print-invoice'): void
  (e: 'close'): void
}>()
</script>

<template>
  <Dialog :open="open" @update:open="(v) => $emit('update:open', v)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <div class="flex flex-col items-center gap-3 pt-2">
          <div class="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
            <CheckCircle2 class="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <DialogTitle class="text-center text-xl">Vente validée</DialogTitle>
          <DialogDescription class="text-center">
            <span v-if="ticketNumber">Ticket <span class="font-mono font-semibold">{{ ticketNumber }}</span></span>
            <span v-else>La vente a été enregistrée avec succès.</span>
          </DialogDescription>
        </div>
      </DialogHeader>

      <p v-if="autoPrint" class="text-center text-xs text-muted-foreground">
        Ticket imprimé automatiquement.
      </p>

      <div class="grid grid-cols-2 gap-3 py-2">
        <Button
          variant="outline"
          class="h-24 flex-col gap-2"
          @click="$emit('print-receipt')"
        >
          <Printer class="h-7 w-7" />
          <span class="text-sm font-medium">{{ autoPrint ? 'Réimprimer' : 'Ticket' }}</span>
          <span class="text-xs text-muted-foreground">80mm</span>
        </Button>

        <Button
          variant="outline"
          class="h-24 flex-col gap-2"
          @click="$emit('print-invoice')"
        >
          <FileText class="h-7 w-7" />
          <span class="text-sm font-medium">Facture</span>
          <span class="text-xs text-muted-foreground">A4</span>
        </Button>
      </div>

      <label class="flex items-center gap-2 text-sm">
        <Checkbox
          :model-value="autoPrint"
          aria-label="Impression automatique du ticket"
          @update:model-value="(v) => $emit('update:autoPrint', v === true)"
        />
        Impression automatique du ticket
      </label>

      <DialogFooter>
        <Button variant="ghost" class="w-full" @click="$emit('close')">
          Fermer
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
