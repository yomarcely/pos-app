<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger
} from '@/components/ui/context-menu'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Scissors, ClipboardPaste } from 'lucide-vue-next'
import { useShortcutBoardStore } from '@/stores/shortcutBoard'
import { useCartStore } from '@/stores/cart'
import { useCustomerStore } from '@/stores/customer'
import { useProductsStore } from '@/stores/products'
import type { Shortcut, ShortcutCell } from '@/types/shortcut'
import { storeToRefs } from 'pinia'

const boardStore = useShortcutBoardStore()
const cartStore = useCartStore()
const productsStore = useProductsStore()
const customerStore = useCustomerStore()

const { tabs, activeTabId } = storeToRefs(boardStore)

const activeTab = computed(() =>
  tabs.value.find(t => t.id === activeTabId.value)
)

// Dialog state
const configDialogOpen = ref(false)
const editingTabId = ref('')
const editingPosition = ref(0)
const editingShortcut = ref<Shortcut | null>(null)

// Tab scroll
const tabsContainerRef = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

function updateScrollState() {
  const el = tabsContainerRef.value
  if (!el) return
  canScrollLeft.value = el.scrollLeft > 0
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}

function scrollTabs(direction: 'left' | 'right') {
  const el = tabsContainerRef.value
  if (!el) return
  el.scrollBy({ left: direction === 'left' ? -120 : 120, behavior: 'smooth' })
}

onMounted(() => {
  nextTick(updateScrollState)
  tabsContainerRef.value?.addEventListener('scroll', updateScrollState, { passive: true })
  window.addEventListener('resize', updateScrollState)
})

onUnmounted(() => {
  tabsContainerRef.value?.removeEventListener('scroll', updateScrollState)
  window.removeEventListener('resize', updateScrollState)
})

watch(() => tabs.value.length, () => nextTick(updateScrollState))

// Tab renaming
const renamingTabId = ref<string | null>(null)
const renameInput = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

function startRename(tabId: string, currentName: string) {
  renamingTabId.value = tabId
  renameInput.value = currentName
  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

function finishRename() {
  if (renamingTabId.value) {
    boardStore.renameTab(renamingTabId.value, renameInput.value)
    renamingTabId.value = null
  }
}

function cancelRename() {
  renamingTabId.value = null
}

// Config dialog
function openConfig(cell: ShortcutCell) {
  editingTabId.value = activeTabId.value
  editingPosition.value = cell.position
  editingShortcut.value = cell.shortcut
  configDialogOpen.value = true
}

function handleSave(shortcut: Shortcut) {
  boardStore.setShortcut(editingTabId.value, editingPosition.value, shortcut)
}

function clearShortcut(cell: ShortcutCell) {
  boardStore.clearCell(activeTabId.value, cell.position)
}

// --- Drag & drop (même onglet) ---
const dragFromPosition = ref<number | null>(null)
const dragOverPosition = ref<number | null>(null)

function onDragStart(cell: ShortcutCell, event: DragEvent) {
  if (!cell.shortcut) {
    event.preventDefault()
    return
  }
  dragFromPosition.value = cell.position
  event.dataTransfer!.effectAllowed = 'move'
  // Image fantôme semi-transparente par défaut du navigateur
}

function onDragOver(cell: ShortcutCell, event: DragEvent) {
  if (dragFromPosition.value === null) return
  event.preventDefault()
  event.dataTransfer!.dropEffect = 'move'
  dragOverPosition.value = cell.position
}

function onDragLeave() {
  dragOverPosition.value = null
}

function onDrop(cell: ShortcutCell) {
  if (dragFromPosition.value === null) return
  if (dragFromPosition.value !== cell.position) {
    boardStore.swapCells(activeTabId.value, dragFromPosition.value, cell.position)
  }
  dragFromPosition.value = null
  dragOverPosition.value = null
}

function onDragEnd() {
  dragFromPosition.value = null
  dragOverPosition.value = null
}

// --- Couper / Coller (entre onglets) ---
const clipboard = ref<{ shortcut: Shortcut; sourceTabId: string; sourcePosition: number } | null>(null)

function cutCell(cell: ShortcutCell) {
  if (!cell.shortcut) return
  clipboard.value = {
    shortcut: { ...cell.shortcut },
    sourceTabId: activeTabId.value,
    sourcePosition: cell.position,
  }
}

function pasteCell(cell: ShortcutCell) {
  if (!clipboard.value) return
  // Vider la cellule source
  boardStore.clearCell(clipboard.value.sourceTabId, clipboard.value.sourcePosition)
  // Placer dans la cellule cible (swap si occupée)
  if (cell.shortcut) {
    boardStore.setShortcut(clipboard.value.sourceTabId, clipboard.value.sourcePosition, cell.shortcut)
  }
  boardStore.setShortcut(activeTabId.value, cell.position, clipboard.value.shortcut)
  clipboard.value = null
}

// --- Exécution ---
function executeShortcut(shortcut: Shortcut) {
  switch (shortcut.type) {
    case 'product': {
      const product = productsStore.products.find(p => p.id === shortcut.productId)
      if (product) {
        cartStore.addToCart(product, shortcut.variation ?? '')
      }
      break
    }
    case 'discount': {
      cartStore.updateGlobalDiscount(shortcut.percent, '%')
      cartStore.applyGlobalDiscountToItems()
      break
    }
    case 'navigation': {
      navigateTo(shortcut.path)
      break
    }
    case 'client': {
      const client = customerStore.clients.find(c => c.id === shortcut.clientId)
      if (client) {
        customerStore.selectClient(client)
      }
      break
    }
    case 'tab': {
      const target = tabs.value.find(t => t.id === shortcut.tabId)
      if (target) {
        activeTabId.value = shortcut.tabId
      }
      break
    }
  }
}
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col gap-2">
    <!-- Tab list -->
    <div class="flex items-center gap-0.5 flex-shrink-0">
      <button
        v-show="canScrollLeft"
        class="shrink-0 h-10 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        @click="scrollTabs('left')"
      >
        <ChevronLeft class="w-4 h-4" />
      </button>

      <div
        ref="tabsContainerRef"
        class="flex gap-1.5 overflow-x-auto flex-1 min-w-0"
        style="scrollbar-width: none; -ms-overflow-style: none;"
      >
        <template v-for="tab in tabs" :key="tab.id">
          <ContextMenu>
            <ContextMenuTrigger as-child>
              <button
                class="h-10 min-w-[5rem] shrink-0 rounded-md text-xs font-medium truncate px-3 border transition-all"
                :class="activeTabId === tab.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground'"
                @click="activeTabId = tab.id"
              >
                <template v-if="renamingTabId === tab.id">
                  <input
                    ref="renameInputRef"
                    v-model="renameInput"
                    class="w-full bg-transparent text-xs text-center outline-none text-inherit"
                    @keydown.enter="finishRename"
                    @keydown.escape="cancelRename"
                    @blur="finishRename"
                    @click.stop
                  />
                </template>
                <template v-else>
                  {{ tab.name }}
                </template>
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem @click="boardStore.addTab()">
                <Plus class="w-4 h-4 mr-2" />
                Nouvel onglet
              </ContextMenuItem>
              <ContextMenuItem @click="startRename(tab.id, tab.name)">
                <Pencil class="w-4 h-4 mr-2" />
                Renommer
              </ContextMenuItem>
              <template v-if="tabs.length > 1">
                <ContextMenuSeparator />
                <ContextMenuItem class="text-destructive" @click="boardStore.removeTab(tab.id)">
                  <Trash2 class="w-4 h-4 mr-2" />
                  Supprimer
                </ContextMenuItem>
              </template>
            </ContextMenuContent>
          </ContextMenu>
        </template>
      </div>

      <button
        v-show="canScrollRight"
        class="shrink-0 h-10 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        @click="scrollTabs('right')"
      >
        <ChevronRight class="w-4 h-4" />
      </button>
    </div>

    <!-- Bandeau clipboard -->
    <div
      v-if="clipboard"
      class="flex items-center justify-between px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium flex-shrink-0"
    >
      <span>« {{ clipboard.shortcut.label }} » coupé — clic droit sur une cellule pour coller</span>
      <button class="underline hover:no-underline" @click="clipboard = null">Annuler</button>
    </div>

    <!-- Grid -->
    <div class="flex-1 min-h-0 relative overflow-hidden">
      <Transition name="tab-slide" mode="out-in">
        <div
          v-if="activeTab"
          :key="activeTabId"
          class="grid grid-cols-4 gap-2 overflow-auto h-full content-start absolute inset-0"
        >
          <ContextMenu v-for="cell in activeTab.cells" :key="cell.position">
            <ContextMenuTrigger>
              <div
                class="relative"
                :class="{
                  'ring-2 ring-primary rounded-lg': dragFromPosition === cell.position,
                  'ring-2 ring-primary/40 rounded-lg': dragOverPosition === cell.position && dragFromPosition !== cell.position,
                }"
                draggable="true"
                @dragstart="onDragStart(cell, $event)"
                @dragover="onDragOver(cell, $event)"
                @dragleave="onDragLeave"
                @drop="onDrop(cell)"
                @dragend="onDragEnd"
              >
                <CaisseShortcutCell
                  :shortcut="cell.shortcut"
                  @execute="cell.shortcut ? executeShortcut(cell.shortcut) : openConfig(cell)"
                />
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <template v-if="cell.shortcut">
                <ContextMenuItem @click="openConfig(cell)">
                  <Pencil class="w-4 h-4 mr-2" />
                  Modifier
                </ContextMenuItem>
                <ContextMenuItem @click="cutCell(cell)">
                  <Scissors class="w-4 h-4 mr-2" />
                  Couper
                </ContextMenuItem>
                <template v-if="clipboard">
                  <ContextMenuItem @click="pasteCell(cell)">
                    <ClipboardPaste class="w-4 h-4 mr-2" />
                    Coller ici (échange)
                  </ContextMenuItem>
                </template>
                <ContextMenuSeparator />
                <ContextMenuItem class="text-destructive" @click="clearShortcut(cell)">
                  <Trash2 class="w-4 h-4 mr-2" />
                  Supprimer
                </ContextMenuItem>
              </template>
              <template v-else>
                <template v-if="clipboard">
                  <ContextMenuItem @click="pasteCell(cell)">
                    <ClipboardPaste class="w-4 h-4 mr-2" />
                    Coller ici
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                </template>
                <ContextMenuItem @click="openConfig(cell)">
                  <Plus class="w-4 h-4 mr-2" />
                  Créer un raccourci
                </ContextMenuItem>
              </template>
            </ContextMenuContent>
          </ContextMenu>
        </div>
      </Transition>
    </div>

    <!-- Config dialog -->
    <CaisseShortcutConfigDialog
      :open="configDialogOpen"
      :existing="editingShortcut"
      @update:open="configDialogOpen = $event"
      @save="handleSave"
    />
  </div>
</template>

<style scoped>
.tab-slide-enter-active,
.tab-slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.tab-slide-enter-from {
  opacity: 0;
  transform: translateX(8px);
}

.tab-slide-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}
</style>
