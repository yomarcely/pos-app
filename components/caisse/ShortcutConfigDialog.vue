<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Shortcut, ShortcutType } from '@/types/shortcut'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { useProductsStore } from '@/stores/products'
import { useCustomerStore } from '@/stores/customer'
import { useShortcutBoardStore } from '@/stores/shortcutBoard'
import { Package, Percent, Navigation, UserRound, PanelTop } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
  existing?: Shortcut | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [shortcut: Shortcut]
}>()

const typeOptions: { value: ShortcutType; label: string; icon: typeof Package }[] = [
  { value: 'product', label: 'Produit', icon: Package },
  { value: 'discount', label: 'Remise globale %', icon: Percent },
  { value: 'navigation', label: 'Navigation', icon: Navigation },
  { value: 'client', label: 'Client', icon: UserRound },
  { value: 'tab', label: 'Aller à un onglet', icon: PanelTop },
]

const defaultColors: Record<ShortcutType, string> = {
  product: '#3b82f6',
  discount: '#f59e0b',
  navigation: '#8b5cf6',
  client: '#ec4899',
  tab: '#64748b',
}

const navigationPages = [
  { path: '/synthese', label: 'Synthèse' },
  { path: '/produits', label: 'Produits' },
  { path: '/categories', label: 'Catégories' },
  { path: '/clients', label: 'Clients' },
  { path: '/mouvements', label: 'Mouvements' },
  { path: '/clotures', label: 'Clôtures' },
  { path: '/stocks', label: 'Stocks' },
  { path: '/vendeurs', label: 'Vendeurs' },
  { path: '/tva', label: 'TVA' },
  { path: '/marques', label: 'Marques' },
  { path: '/fournisseurs', label: 'Fournisseurs' },
]

// Form state
const selectedType = ref<ShortcutType>('product')
const label = ref('')
const color = ref('#3b82f6')

// Product fields
const selectedProductId = ref<string>('')
const selectedVariation = ref('')

// Discount fields
const discountPercent = ref(10)

// Navigation fields
const selectedPath = ref('/synthese')

// Client fields
const selectedClientId = ref<string>('')

// Tab fields
const selectedTabId = ref<string>('')

// Data sources
const productsStore = useProductsStore()
const customerStore = useCustomerStore()
const boardStore = useShortcutBoardStore()

const products = computed(() => productsStore.products)
const clients = computed(() => customerStore.clients)
const availableTabs = computed(() => boardStore.tabs)

const selectedProduct = computed(() =>
  products.value.find(p => p.id === Number(selectedProductId.value))
)

const productVariations = computed(() => {
  const product = selectedProduct.value
  if (!product?.variationGroupIds?.length) return []
  return product.variationGroupIds.map(v => String(v))
})

// Populate form when editing existing shortcut
watch(() => props.open, (isOpen) => {
  if (!isOpen) return

  if (props.existing) {
    selectedType.value = props.existing.type
    label.value = props.existing.label
    color.value = props.existing.color

    switch (props.existing.type) {
      case 'product':
        selectedProductId.value = String(props.existing.productId)
        selectedVariation.value = props.existing.variation ?? ''
        break
      case 'discount':
        discountPercent.value = props.existing.percent
        break
      case 'navigation':
        selectedPath.value = props.existing.path
        break
      case 'client':
        selectedClientId.value = String(props.existing.clientId)
        break
      case 'tab':
        selectedTabId.value = props.existing.tabId
        break
    }
  } else {
    resetForm()
  }
})

// Auto-set color when type changes
watch(selectedType, (type) => {
  color.value = defaultColors[type]
})

// Auto-fill label when product selected
watch(selectedProductId, (id) => {
  if (!id) return
  const product = products.value.find(p => p.id === Number(id))
  if (product && !label.value) {
    label.value = product.name
  }
})

// Auto-fill label when client selected
watch(selectedClientId, (id) => {
  if (!id) return
  const client = clients.value.find(c => c.id === Number(id))
  if (client && !label.value) {
    label.value = `${client.firstName} ${client.lastName}`
  }
})

// Auto-fill label for navigation
watch(selectedPath, (path) => {
  const page = navigationPages.find(p => p.path === path)
  if (page && !label.value) {
    label.value = page.label
  }
})

// Auto-fill label when tab selected
watch(selectedTabId, (id) => {
  if (!id) return
  const tab = availableTabs.value.find(t => t.id === id)
  if (tab && !label.value) {
    label.value = tab.name
  }
})

// Auto-fill label for discount
watch(discountPercent, (val) => {
  if (!label.value || label.value.match(/^-?\d+\s*%$/)) {
    label.value = `${val} %`
  }
})

function resetForm() {
  selectedType.value = 'product'
  label.value = ''
  color.value = defaultColors.product
  selectedProductId.value = ''
  selectedVariation.value = ''
  discountPercent.value = 10
  selectedPath.value = '/synthese'
  selectedClientId.value = ''
  selectedTabId.value = ''
}

const isValid = computed(() => {
  if (!label.value.trim()) return false
  switch (selectedType.value) {
    case 'product':
      return !!selectedProductId.value
    case 'discount':
      return discountPercent.value > 0 && discountPercent.value <= 100
    case 'navigation':
      return !!selectedPath.value
    case 'client':
      return !!selectedClientId.value
    case 'tab':
      return !!selectedTabId.value
    default:
      return false
  }
})

function save() {
  if (!isValid.value) return

  const base = {
    id: props.existing?.id ?? crypto.randomUUID(),
    label: label.value.trim(),
    color: color.value,
  }

  let shortcut: Shortcut

  switch (selectedType.value) {
    case 'product': {
      const product = products.value.find(p => p.id === Number(selectedProductId.value))!
      shortcut = {
        ...base,
        type: 'product',
        productId: product.id,
        productName: product.name,
        variation: selectedVariation.value || undefined,
        image: product.image ?? null,
      }
      break
    }
    case 'discount':
      shortcut = {
        ...base,
        type: 'discount',
        percent: discountPercent.value,
      }
      break
    case 'navigation':
      shortcut = {
        ...base,
        type: 'navigation',
        path: selectedPath.value,
      }
      break
    case 'client': {
      const client = clients.value.find(c => c.id === Number(selectedClientId.value))!
      shortcut = {
        ...base,
        type: 'client',
        clientId: client.id,
        clientName: `${client.firstName} ${client.lastName}`,
      }
      break
    }
    case 'tab': {
      const tab = availableTabs.value.find(t => t.id === selectedTabId.value)!
      shortcut = {
        ...base,
        type: 'tab',
        tabId: tab.id,
        tabName: tab.name,
      }
      break
    }
  }

  emit('save', shortcut!)
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ existing ? 'Modifier le raccourci' : 'Créer un raccourci' }}</DialogTitle>
        <DialogDescription>Configurez l'action de cette touche</DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-2">
        <!-- Type -->
        <div class="space-y-1.5">
          <Label>Type</Label>
          <Select v-model="selectedType">
            <SelectTrigger>
              <SelectValue placeholder="Choisir un type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
                <div class="flex items-center gap-2">
                  <component :is="opt.icon" class="w-4 h-4" />
                  {{ opt.label }}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Product config -->
        <template v-if="selectedType === 'product'">
          <div class="space-y-1.5">
            <Label>Produit</Label>
            <Select v-model="selectedProductId">
              <SelectTrigger>
                <SelectValue placeholder="Choisir un produit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="p in products.filter(p => !p.isArchived)"
                  :key="p.id"
                  :value="String(p.id)"
                >
                  {{ p.name }} — {{ p.price.toFixed(2) }} €
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div v-if="productVariations.length" class="space-y-1.5">
            <Label>Variation (optionnel)</Label>
            <Select v-model="selectedVariation">
              <SelectTrigger>
                <SelectValue placeholder="Aucune variation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucune</SelectItem>
                <SelectItem v-for="v in productVariations" :key="v" :value="v">
                  {{ v }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </template>

        <!-- Discount config -->
        <template v-if="selectedType === 'discount'">
          <div class="space-y-1.5">
            <Label>Pourcentage de remise</Label>
            <div class="flex items-center gap-2">
              <Input
                v-model.number="discountPercent"
                type="number"
                min="1"
                max="100"
                class="w-24"
              />
              <span class="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        </template>

        <!-- Navigation config -->
        <template v-if="selectedType === 'navigation'">
          <div class="space-y-1.5">
            <Label>Page</Label>
            <Select v-model="selectedPath">
              <SelectTrigger>
                <SelectValue placeholder="Choisir une page" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="page in navigationPages" :key="page.path" :value="page.path">
                  {{ page.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </template>

        <!-- Client config -->
        <template v-if="selectedType === 'client'">
          <div class="space-y-1.5">
            <Label>Client</Label>
            <Select v-model="selectedClientId">
              <SelectTrigger>
                <SelectValue placeholder="Choisir un client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="c in clients" :key="c.id" :value="String(c.id)">
                  {{ c.firstName }} {{ c.lastName }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </template>

        <!-- Tab config -->
        <template v-if="selectedType === 'tab'">
          <div class="space-y-1.5">
            <Label>Onglet cible</Label>
            <Select v-model="selectedTabId">
              <SelectTrigger>
                <SelectValue placeholder="Choisir un onglet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="tab in availableTabs" :key="tab.id" :value="tab.id">
                  {{ tab.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </template>

        <!-- Label + Color (commun) -->
        <div class="grid grid-cols-[1fr_auto] gap-3">
          <div class="space-y-1.5">
            <Label>Label</Label>
            <Input v-model="label" placeholder="Nom affiché sur la touche" />
          </div>
          <div class="space-y-1.5">
            <Label>Couleur</Label>
            <input
              v-model="color"
              type="color"
              class="h-9 w-12 rounded-md border cursor-pointer"
            />
          </div>
        </div>
      </div>

      <DialogFooter class="gap-2">
        <DialogClose as-child>
          <Button variant="outline">Annuler</Button>
        </DialogClose>
        <Button :disabled="!isValid" @click="save">
          {{ existing ? 'Modifier' : 'Créer' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
