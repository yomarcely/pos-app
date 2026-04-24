import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { ShortcutTab, ShortcutCell } from '@/types/shortcut'
import { useEstablishmentRegister } from '@/composables/useEstablishmentRegister'

const STORAGE_PREFIX = 'fympos-shortcut-board'
const CELLS_PER_TAB = 20

function storageKey(establishmentId: number | null): string {
  return establishmentId
    ? `${STORAGE_PREFIX}-${establishmentId}`
    : STORAGE_PREFIX
}

function createEmptyCells(): ShortcutCell[] {
  return Array.from({ length: CELLS_PER_TAB }, (_, i) => ({
    position: i,
    shortcut: null,
  }))
}

function createDefaultTab(id?: string, name?: string): ShortcutTab {
  return {
    id: id ?? crypto.randomUUID(),
    name: name ?? 'Principal',
    cells: createEmptyCells(),
  }
}

function loadFromStorage(establishmentId: number | null): ShortcutTab[] {
  if (typeof window === 'undefined') return [createDefaultTab()]
  try {
    const raw = localStorage.getItem(storageKey(establishmentId))
    if (!raw) return [createDefaultTab()]
    const parsed = JSON.parse(raw) as ShortcutTab[]
    if (!Array.isArray(parsed) || parsed.length === 0) return [createDefaultTab()]
    return parsed
  } catch {
    return [createDefaultTab()]
  }
}

function saveToStorage(establishmentId: number | null, tabs: ShortcutTab[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(storageKey(establishmentId), JSON.stringify(tabs))
}

export const useShortcutBoardStore = defineStore('shortcutBoard', () => {
  const { selectedEstablishmentId } = useEstablishmentRegister()

  const currentEstablishmentId = ref<number | null>(selectedEstablishmentId.value)
  const tabs = ref<ShortcutTab[]>(loadFromStorage(currentEstablishmentId.value))
  const activeTabId = ref(tabs.value[0]?.id ?? '')

  // Reload when establishment changes
  watch(selectedEstablishmentId, (newId) => {
    if (newId === currentEstablishmentId.value) return
    currentEstablishmentId.value = newId
    tabs.value = loadFromStorage(newId)
    activeTabId.value = tabs.value[0]?.id ?? ''
  })

  // Persist on change
  watch(tabs, (val) => saveToStorage(currentEstablishmentId.value, val), { deep: true })

  function addTab(name = 'Nouvel onglet') {
    const tab = createDefaultTab(undefined, name)
    tabs.value.push(tab)
    activeTabId.value = tab.id
  }

  function removeTab(tabId: string) {
    if (tabs.value.length <= 1) return
    const index = tabs.value.findIndex(t => t.id === tabId)
    if (index === -1) return
    tabs.value.splice(index, 1)
    if (activeTabId.value === tabId) {
      activeTabId.value = tabs.value[0]?.id ?? ''
    }
  }

  function renameTab(tabId: string, name: string) {
    const tab = tabs.value.find(t => t.id === tabId)
    if (tab) tab.name = name.trim() || tab.name
  }

  function setShortcut(tabId: string, position: number, shortcut: ShortcutCell['shortcut']) {
    const tab = tabs.value.find(t => t.id === tabId)
    if (!tab) return
    const cell = tab.cells.find(c => c.position === position)
    if (cell) cell.shortcut = shortcut
  }

  function clearCell(tabId: string, position: number) {
    setShortcut(tabId, position, null)
  }

  function swapCells(tabId: string, fromPos: number, toPos: number) {
    const tab = tabs.value.find(t => t.id === tabId)
    if (!tab) return
    const fromCell = tab.cells.find(c => c.position === fromPos)
    const toCell = tab.cells.find(c => c.position === toPos)
    if (!fromCell || !toCell) return
    const tmp = fromCell.shortcut
    fromCell.shortcut = toCell.shortcut
    toCell.shortcut = tmp
  }

  return {
    tabs,
    activeTabId,
    addTab,
    removeTab,
    renameTab,
    setShortcut,
    clearCell,
    swapCells,
  }
})
