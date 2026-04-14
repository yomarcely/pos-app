import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { ShortcutTab, ShortcutCell } from '@/types/shortcut'

const STORAGE_KEY = 'fympos-shortcut-board'
const CELLS_PER_TAB = 20

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

function loadFromStorage(): ShortcutTab[] {
  if (typeof window === 'undefined') return [createDefaultTab()]
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [createDefaultTab()]
    const parsed = JSON.parse(raw) as ShortcutTab[]
    if (!Array.isArray(parsed) || parsed.length === 0) return [createDefaultTab()]
    return parsed
  } catch {
    return [createDefaultTab()]
  }
}

function saveToStorage(tabs: ShortcutTab[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs))
}

export const useShortcutBoardStore = defineStore('shortcutBoard', () => {
  const tabs = ref<ShortcutTab[]>(loadFromStorage())
  const activeTabId = ref(tabs.value[0]?.id ?? '')

  // Persist on change
  watch(tabs, (val) => saveToStorage(val), { deep: true })

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
