import { defineStore } from 'pinia'
import { ref } from 'vue'

export type NoteType = 'general' | 'client' | 'tache'

export interface Note {
  id: number
  tenantId: string
  establishmentId: number | null
  content: string
  type: NoteType
  customerId: number | null
  dueDate: string | null
  done: boolean
  createdAt: string
  updatedAt: string
}

export interface NotePayload {
  content: string
  type: NoteType
  customerId?: number | null
  dueDate?: string | null
  establishmentId?: number | null
}

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<Note[]>([])
  const loading = ref(false)

  async function loadNotes(establishmentId?: number | null): Promise<void> {
    loading.value = true
    try {
      type Resp = { success: boolean; notes: Note[] }
      const res = await $fetch<Resp>('/api/notes', {
        params: establishmentId ? { establishmentId } : undefined,
      })
      if (res.success) notes.value = res.notes
    } catch (err) {
      console.error('Erreur chargement notes', err)
    } finally {
      loading.value = false
    }
  }

  async function addNote(payload: NotePayload): Promise<void> {
    type Resp = { success: boolean; note: Note }
    const res = await $fetch<Resp>('/api/notes', { method: 'POST', body: payload })
    if (res.success && res.note) notes.value.unshift(res.note)
  }

  async function updateNote(id: number, patch: Partial<NotePayload> & { done?: boolean }): Promise<void> {
    type Resp = { success: boolean; note: Note }
    const res = await $fetch<Resp>(`/api/notes/${id}`, { method: 'PUT', body: patch })
    if (res.success && res.note) {
      const idx = notes.value.findIndex(n => n.id === id)
      if (idx !== -1) notes.value[idx] = res.note
    }
  }

  async function toggleDone(note: Note): Promise<void> {
    await updateNote(note.id, { done: !note.done })
  }

  async function deleteNote(id: number): Promise<void> {
    const res = await $fetch<{ success: boolean }>(`/api/notes/${id}`, { method: 'DELETE' })
    if (res.success) notes.value = notes.value.filter(n => n.id !== id)
  }

  return { notes, loading, loadNotes, addNote, updateNote, toggleDone, deleteNote }
})
