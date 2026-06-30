<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useNotesStore, type Note, type NoteType } from '@/stores/notes'
import { useCustomerStore } from '@/stores/customer'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'
import {
    Combobox, ComboboxAnchor, ComboboxInput, ComboboxList, ComboboxItem, ComboboxEmpty, ComboboxGroup,
} from '@/components/ui/combobox'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import DatePicker from '@/components/shared/DatePicker.vue'
import {
    StickyNote, Plus, Check, Trash2, CalendarClock, User, X,
} from 'lucide-vue-next'
import type { Customer } from '@/types'

const notesStore = useNotesStore()
const customerStore = useCustomerStore()
const { selectedEstablishmentId } = useEstablishmentRegister()

// ──────────────────────────────────────────────
// Filtre d'affichage
// ──────────────────────────────────────────────
const filter = ref<'todo' | 'all'>('todo')

const visibleNotes = computed(() => {
    const list = notesStore.notes
    return filter.value === 'todo' ? list.filter(n => !n.done) : list
})

const todoCount = computed(() => notesStore.notes.filter(n => !n.done).length)

// ──────────────────────────────────────────────
// Formulaire d'ajout
// ──────────────────────────────────────────────
const todayStr = () => getLocalDateString()

const newContent = ref('')
const newType = ref<NoteType>('general')
const newCustomer = ref<Customer | null>(null)
const newDueDate = ref(todayStr())
const saving = ref(false)

const typeOptions: { value: NoteType; label: string }[] = [
    { value: 'general', label: 'Général' },
    { value: 'client', label: 'Client' },
    { value: 'tache', label: 'Tâche' },
]

const typeBadge: Record<NoteType, { label: string; class: string }> = {
    general: { label: 'Général', class: 'bg-muted text-muted-foreground' },
    client: { label: 'Client', class: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400' },
    tache: { label: 'Tâche', class: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400' },
}

const clients = computed(() => customerStore.clients)

async function submit() {
    const content = newContent.value.trim()
    if (!content || saving.value) return
    saving.value = true
    try {
        await notesStore.addNote({
            content,
            type: newType.value,
            customerId: newCustomer.value?.id ?? null,
            dueDate: newDueDate.value ? new Date(newDueDate.value).toISOString() : null,
            establishmentId: selectedEstablishmentId.value ?? null,
        })
        newContent.value = ''
        newType.value = 'general'
        newCustomer.value = null
        newDueDate.value = todayStr()
    } catch (e) {
        console.error('Erreur ajout note', e)
    } finally {
        saving.value = false
    }
}

// ──────────────────────────────────────────────
// Helpers d'affichage
// ──────────────────────────────────────────────
function customerName(customerId: number | null): string | null {
    if (!customerId) return null
    const c = clients.value.find(c => c.id === customerId)
    return c ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || 'Client' : null
}

function isOverdue(note: Note): boolean {
    if (!note.dueDate || note.done) return false
    const d = new Date(note.dueDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return d < today
}

function formatDue(dueDate: string): string {
    return new Date(dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ──────────────────────────────────────────────
// Chargement
// ──────────────────────────────────────────────
onMounted(() => {
    notesStore.loadNotes(selectedEstablishmentId.value)
    if (!customerStore.loaded) customerStore.loadCustomers()
})

watch(selectedEstablishmentId, (id) => notesStore.loadNotes(id))
</script>

<template>
    <section class="flex h-full min-h-0 flex-col rounded-xl border bg-card shadow-sm">
        <!-- En-tête -->
        <div class="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
            <h2 class="flex items-center gap-2 text-sm font-semibold">
                <StickyNote class="h-4 w-4 text-muted-foreground" />
                Notes & rappels
                <span v-if="todoCount" class="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                    {{ todoCount }}
                </span>
            </h2>
            <div class="flex items-center gap-1 rounded-lg bg-muted p-0.5 text-xs">
                <button
                    class="rounded-md px-2 py-1 font-medium transition"
                    :class="filter === 'todo' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                    @click="filter = 'todo'"
                >
                    À faire
                </button>
                <button
                    class="rounded-md px-2 py-1 font-medium transition"
                    :class="filter === 'all' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                    @click="filter = 'all'"
                >
                    Tous
                </button>
            </div>
        </div>

        <!-- Formulaire d'ajout -->
        <div class="shrink-0 border-b p-4">
            <div class="flex flex-col gap-2 lg:flex-row lg:items-center">
                <input
                    v-model="newContent"
                    type="text"
                    placeholder="Nouvelle note ou rappel…"
                    class="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    @keydown.enter="submit"
                />

                <div class="flex flex-wrap items-center gap-2">
                    <!-- Type -->
                    <Select v-model="newType">
                        <SelectTrigger class="h-9 w-[120px]">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
                                {{ opt.label }}
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    <!-- Client (optionnel) -->
                    <client-only>
                        <div class="flex items-center gap-1">
                            <Combobox v-model="newCustomer" :options="clients" option-value="id">
                                <ComboboxAnchor>
                                    <div class="relative flex h-9 w-[160px] items-center rounded-md border border-input">
                                        <ComboboxInput
                                            :display-value="(c: any) => c ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() : ''"
                                            placeholder="Client (option.)"
                                            class="h-full w-full bg-transparent px-3 text-sm outline-none"
                                        />
                                    </div>
                                </ComboboxAnchor>
                                <ComboboxList>
                                    <ComboboxEmpty>Aucun client</ComboboxEmpty>
                                    <ComboboxGroup>
                                        <ComboboxItem v-for="c in clients" :key="c.id" :value="c">
                                            <div class="flex flex-col leading-tight">
                                                <span class="text-sm font-medium">{{ c.firstName }} {{ c.lastName }}</span>
                                            </div>
                                        </ComboboxItem>
                                    </ComboboxGroup>
                                </ComboboxList>
                            </Combobox>
                            <button
                                v-if="newCustomer"
                                type="button"
                                class="text-muted-foreground hover:text-foreground"
                                title="Retirer le client"
                                @click="newCustomer = null"
                            >
                                <X class="h-4 w-4" />
                            </button>
                        </div>
                        <template #fallback>
                            <div class="flex h-9 w-[160px] items-center rounded-md border border-input px-3 text-sm text-muted-foreground">
                                Client (option.)
                            </div>
                        </template>
                    </client-only>

                    <!-- Date limite -->
                    <DatePicker
                        v-model="newDueDate"
                        placeholder="Échéance"
                        class="h-9 w-[150px]"
                    />

                    <Button size="sm" class="h-9 gap-1" :disabled="!newContent.trim() || saving" @click="submit">
                        <Plus class="h-4 w-4" />
                        Ajouter
                    </Button>
                </div>
            </div>
        </div>

        <!-- Liste -->
        <div class="min-h-0 flex-1 p-4">
            <div v-if="visibleNotes.length === 0" class="flex items-center justify-center py-8 text-sm text-muted-foreground">
                {{ filter === 'todo' ? 'Aucun rappel en cours 🎉' : 'Aucune note pour le moment' }}
            </div>

            <ScrollArea v-else class="h-full pr-3">
            <ul class="space-y-2">
                <li
                    v-for="note in visibleNotes"
                    :key="note.id"
                    class="flex items-start gap-3 rounded-lg border bg-background p-3 transition"
                    :class="{ 'opacity-60': note.done }"
                >
                    <!-- Toggle fait -->
                    <button
                        type="button"
                        class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition"
                        :class="note.done ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:border-primary'"
                        :title="note.done ? 'Marquer à faire' : 'Marquer comme fait'"
                        @click="notesStore.toggleDone(note)"
                    >
                        <Check v-if="note.done" class="h-3.5 w-3.5" />
                    </button>

                    <!-- Contenu -->
                    <div class="min-w-0 flex-1">
                        <p class="text-sm" :class="note.done ? 'line-through' : ''">{{ note.content }}</p>
                        <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span
                                class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
                                :class="typeBadge[note.type].class"
                            >
                                {{ typeBadge[note.type].label }}
                            </span>
                            <NuxtLink
                                v-if="customerName(note.customerId)"
                                :to="`/clients/${note.customerId}/edit`"
                                class="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground hover:underline"
                            >
                                <User class="h-3 w-3" />
                                {{ customerName(note.customerId) }}
                            </NuxtLink>
                            <span
                                v-if="note.dueDate"
                                class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
                                :class="isOverdue(note) ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted text-muted-foreground'"
                            >
                                <CalendarClock class="h-3 w-3" />
                                {{ formatDue(note.dueDate) }}
                            </span>
                        </div>
                    </div>

                    <!-- Supprimer -->
                    <button
                        type="button"
                        class="mt-0.5 text-muted-foreground transition hover:text-red-600"
                        title="Supprimer"
                        @click="notesStore.deleteNote(note.id)"
                    >
                        <Trash2 class="h-4 w-4" />
                    </button>
                </li>
            </ul>
            </ScrollArea>
        </div>
    </section>
</template>
