<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProductsStore } from '@/stores/products'
import { AlertCircle, PackageX, X, ChevronDown, ChevronUp } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const productsStore = useProductsStore()

const isVisible = ref(true)
const isExpanded = ref(true)

const showAlerts = computed(() =>
  isVisible.value && (
    productsStore.outOfStockAlerts.length > 0 ||
    productsStore.lowStockAlerts.length > 0
  )
)

const totalAlerts = computed(() =>
  productsStore.outOfStockAlerts.length +
  productsStore.lowStockAlerts.length
)

function closeAlert() {
  isVisible.value = false
}

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <Transition name="slide-fade">
    <div v-if="showAlerts" class="fixed bottom-24 right-4 z-50 pointer-events-none">
      <div class="bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-border p-4 max-w-sm pointer-events-auto transition-all duration-300">
        <!-- En-tête -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <AlertCircle class="w-5 h-5 text-orange-500 flex-shrink-0" />
            <h3 class="font-semibold text-sm">Alertes de stock</h3>
            <Badge variant="destructive">{{ totalAlerts }}</Badge>
          </div>
          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              class="h-6 w-6"
              @click="toggleExpanded"
            >
              <ChevronUp v-if="isExpanded" class="w-4 h-4" />
              <ChevronDown v-else class="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="h-6 w-6 text-muted-foreground hover:text-foreground"
              @click="closeAlert"
            >
              <X class="w-4 h-4" />
            </Button>
          </div>
        </div>

        <!-- Contenu (repliable) -->
        <Transition name="expand">
          <div v-if="isExpanded" class="space-y-3">
            <!-- Rupture de stock -->
            <div v-if="productsStore.outOfStockAlerts.length > 0">
              <div class="flex items-center gap-2 text-xs font-medium text-red-600 mb-1">
                <PackageX class="w-4 h-4" />
                Rupture de stock ({{ productsStore.outOfStockAlerts.length }})
              </div>
              <ul class="text-xs space-y-1 ml-6">
                <li v-for="alert in productsStore.outOfStockAlerts.slice(0, 5)" :key="`out-${alert.product.id}-${alert.variations?.[0]?.name || ''}`" class="text-muted-foreground">
                  {{ alert.product.name }}
                  <span v-if="alert.variations && alert.variations.length > 0" class="text-red-600 font-medium">
                    <template v-for="(variation, index) in alert.variations" :key="variation.name">
                      {{ index > 0 ? ', ' : '' }}{{ variation.name }} ({{ variation.stock }})
                    </template>
                  </span>
                  <span v-else class="text-red-600 font-medium">
                    ({{ alert.product.stock ?? 0 }} restant)
                  </span>
                </li>
                <li v-if="productsStore.outOfStockAlerts.length > 5" class="text-muted-foreground italic">
                  +{{ productsStore.outOfStockAlerts.length - 5 }} autres...
                </li>
              </ul>
            </div>

            <!-- Stock faible -->
            <div v-if="productsStore.lowStockAlerts.length > 0">
              <div class="flex items-center gap-2 text-xs font-medium text-orange-600 mb-1">
                <AlertCircle class="w-4 h-4" />
                Stock faible ({{ productsStore.lowStockAlerts.length }})
              </div>
              <ul class="text-xs space-y-1 ml-6">
                <li v-for="alert in productsStore.lowStockAlerts.slice(0, 5)" :key="`${alert.product.id}-${alert.variations?.[0]?.name || ''}`" class="text-muted-foreground">
                  {{ alert.product.name }}
                  <span v-if="alert.variations && alert.variations.length > 0" class="text-orange-600 font-medium">
                    <template v-for="(variation, index) in alert.variations" :key="variation.name">
                      {{ index > 0 ? ', ' : '' }}{{ variation.name }} ({{ variation.stock }})
                    </template>
                  </span>
                  <span v-else class="text-orange-600 font-medium">
                    ({{ alert.product.stock ?? 0 }} restant{{ (alert.product.stock ?? 0) > 1 ? 's' : '' }})
                  </span>
                </li>
                <li v-if="productsStore.lowStockAlerts.length > 5" class="text-muted-foreground italic">
                  +{{ productsStore.lowStockAlerts.length - 5 }} autres...
                </li>
              </ul>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Animation pour l'entrée/sortie de l'alerte */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.2s ease-in;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* Animation pour l'expansion/réduction du contenu */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 500px;
  opacity: 1;
}
</style>
