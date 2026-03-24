<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Input } from '@/components/ui/input'
import {
    NumberField, NumberFieldContent, NumberFieldDecrement,
    NumberFieldIncrement, NumberFieldInput
} from '@/components/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X } from 'lucide-vue-next'
import { useCartStore } from '@/stores/cart'
import { useVariationGroupsStore } from '@/stores/variationGroups'

import type { ProductInCart } from '@/types'

const cartStore = useCartStore()
const variationStore = useVariationGroupsStore()
// Computed réactif pour que le template se re-rende quand les groupes chargent
const variationGroups = computed(() => variationStore.groups)

const props = defineProps<{
    product: ProductInCart;
    isLocked?: boolean;
}>()

const emit = defineEmits<{
    (e: 'remove', id: number, variation: string): void
}>()

const stock = computed(() => {
    if (props.product.variationGroupIds?.length && props.product.variation) {
        // Trouver l'ID de la variation à partir de son nom
        const variationId = getVariationIdByName(props.product.variation)
        if (variationId !== null) {
            return Number(props.product.stockByVariation?.[variationId.toString()] ?? 0)
        }
        return 0
    }
    return Number(props.product.stock ?? 0)
})

const stockColor = computed(() => {
    if (stock.value <= 0) return 'bg-red-500'

    // Obtenir le minStock pour ce produit/variation
    let minStock = 5 // Valeur par défaut
    if (props.product.variationGroupIds?.length && props.product.variation) {
        const variationId = getVariationIdByName(props.product.variation)
        if (variationId !== null) {
            minStock = props.product.minStockByVariation?.[variationId.toString()] ?? props.product.minStock ?? 5
        }
    } else {
        minStock = props.product.minStock ?? 5
    }

    if (stock.value <= minStock) return 'bg-orange-400'
    return 'bg-green-500'
})

// Prix final dynamique par produit (hors remise globale)
const finalPrice = computed({
    get() {
        return props.product.discountType === '%'
            ? Math.round(props.product.price * (1 - props.product.discount / 100) * 100) / 100
            : Math.round((props.product.price - props.product.discount) * 100) / 100
    },
    set(newVal: number) {
        const base = props.product.price
        const delta = base - newVal
        const newDiscount = props.product.discountType === '%'
            ? Math.round((delta / base) * 10000) / 100
            : Math.round(delta * 100) / 100

        cartStore.updateDiscount(props.product.id, props.product.variation, newDiscount, props.product.discountType)
    }
})

const previousFinalPrice = ref(finalPrice.value)
const localDiscount = ref(props.product.discount)

// 1. Quand on modifie le prix unitaire final à la main
watch(finalPrice, (newVal) => {
    previousFinalPrice.value = newVal
    const base = props.product.price
    const delta = base - newVal
    const discount = props.product.discountType === '%'
        ? Math.round((delta / base) * 10000) / 100
        : Math.round(delta * 100) / 100

    localDiscount.value = discount
    // (Mise à jour du store déjà effectuée dans finalPrice.set)
})

// 2. Quand on change le type de remise, on recalcule la remise pour garder le même prix final
watch(() => props.product.discountType, (newType, oldType) => {
    const base = props.product.price
    const final = previousFinalPrice.value

    let discount = 0
    if (newType === '%') {
        discount = base !== 0 ? Math.round(((base - final) / base) * 10000) / 100 : 0
    } else if (newType === '€') {
        discount = Math.round((base - final) * 100) / 100
    }

    localDiscount.value = discount
    cartStore.updateDiscount(props.product.id, props.product.variation, discount, newType)
})

// 3. Synchronisation si la remise est modifiée ailleurs
watch(() => props.product.discount, (newVal) => {
    localDiscount.value = newVal
})

const allowOnlyDecimal = (e: KeyboardEvent) => {
    const allowedKeys = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', '.', ',']
    const isDigit = /^[0-9]$/.test(e.key)
    const isAllowed = allowedKeys.includes(e.key) || isDigit
    if (!isAllowed) e.preventDefault()
    const input = e.target as HTMLInputElement
    if ((e.key === '.' || e.key === ',') && (input.value.includes('.') || input.value.includes(','))) {
        e.preventDefault()
    }
}

const isBelowPurchasePrice = computed(() => {
    const achat = props.product.purchasePrice ?? 0
    return finalPrice.value < achat
})

// Fonction pour obtenir le nom d'une variation par son ID
function getVariationNameById(variationId: string | number): string {
    for (const group of variationGroups.value) {
        const variation = group.variations.find((v) => Number(v.id) === Number(variationId))
        if (variation) {
            return variation.name
        }
    }
    return `Variation ${variationId}` // Fallback si non trouvée
}

// Fonction pour obtenir l'ID d'une variation par son nom
function getVariationIdByName(variationName: string): string | number | null {
    for (const group of variationGroups.value) {
        const variation = group.variations.find((v) => v.name === variationName)
        if (variation) {
            return variation.id
        }
    }
    return null
}

// Quand les groupes chargent après que le produit a été ajouté au panier,
// résoudre le nom de variation si la valeur stockée est vide ou un fallback.
watch(variationGroups, (newGroups) => {
    if (!newGroups.length) return
    if (!props.product.variationGroupIds?.length) return

    const current = props.product.variation
    const isUnresolved = !current || /^Variation \d+$/.test(current)
    if (!isUnresolved) return

    const firstId = props.product.variationGroupIds[0]
    if (firstId === undefined) return

    const resolved = getVariationNameById(firstId)
    if (resolved && !/^Variation \d+$/.test(resolved)) {
        cartStore.updateVariation(props.product.id, current, resolved)
    }
}, { immediate: true })
</script>

<template>
    <div class="relative flex gap-4 p-4 mb-2 rounded-lg shadow-sm border" :class="{
        'opacity-50 pointer-events-none select-none': isLocked,
        'border-2 border-orange-400 bg-orange-400/5': product.quantity < 0
    }">
        <!-- Badge retour -->
        <div v-if="product.quantity < 0" class="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-md">
            <span>RETOUR</span>
            <span class="text-[9px] opacity-90">{{ product.restockOnReturn ? '↻ Restock' : '✕ Sans restock' }}</span>
        </div>

        <!-- ❌ Supprimer -->
        <button @click="emit('remove', product.id, product.variation)"
            class="absolute top-2 right-2 text-gray-400 hover:text-red-500">
            <X class="w-4 h-4" />
        </button>

        <!-- 📦 Quantité + image -->
        <div class="flex flex-col items-center gap-2 w-25">
            <NumberField
                :model-value="product.quantity"
                :min="product.quantity < 0 ? undefined : 1"
                @update:model-value="val => cartStore.updateQuantity(product.id, product.variation, Number(val))"
            >
                <NumberFieldContent>
                    <NumberFieldDecrement />
                    <NumberFieldInput inputmode="numeric" />
                    <NumberFieldIncrement />
                </NumberFieldContent>
            </NumberField>
            <RouterLink :to="`/produits/${product.id}/edit`">
                <img :src="product.image || '/placeholder-product.png'" :alt="product.name" class="w-12 h-12 rounded" />
            </RouterLink>
        </div>

        <!-- 🧾 Détails -->
        <div class="flex-1 space-y-1 text-sm">
            <div class="flex items-center gap-2">
                <RouterLink :to="`/produits/${product.id}/edit`"
                    class="font-semibold text-primary hover:underline transition">
                    {{ product.name }}
                </RouterLink>
                <span
                    class="inline-flex items-center justify-center text-xs text-white font-medium px-1.5 py-0.5 rounded"
                    :class="stockColor" :title="`${stock} en stock`">
                    {{ stock }}
                </span>
            </div>

            <!-- Variations du produit -->
            <div v-if="product.variationGroupIds?.length" class="mt-1">
                <Select :model-value="product.variation" @update:model-value="val => {
                    if (typeof val === 'string') {
                        cartStore.updateVariation(product.id, product.variation, val)
                    }
                }">
                    <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une variation" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem
                            v-for="variationId in product.variationGroupIds"
                            :key="variationId"
                            :value="getVariationNameById(variationId)">
                            {{ getVariationNameById(variationId) }}
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <!-- Remise -->
            <div class="flex gap-2">
                <Input @keydown="allowOnlyDecimal" :model-value="localDiscount === 0 ? '' : localDiscount.toString()"
                    placeholder="Remise" @update:model-value="val => {
                        const num = parseFloat(String(val))
                        const safe = !isNaN(num) ? num : 0
                        localDiscount = safe
                        cartStore.updateDiscount(product.id, product.variation, safe, product.discountType)
                    }" class="w-24" />
                <Select v-model="product.discountType">
                    <SelectTrigger class="w-16">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="%">%</SelectItem>
                        <SelectItem value="€">€</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <!-- 💰 Prix unitaire + total -->
        <div class="flex flex-col items-end justify-end gap-1">
            <label class="text-sm font-semibold block mb-1">Prix unitaire</label>
            <Input @keydown="allowOnlyDecimal" :model-value="finalPrice" @update:model-value="val => {
                const num = parseFloat(String(val))
                if (!isNaN(num)) finalPrice = num
            }" :class="['w-24 text-right', isBelowPurchasePrice ? 'border-red-500 text-red-600' : '']" />
            <p class="text-xs text-muted-foreground text-right">
                Total : {{ (finalPrice * product.quantity).toFixed(2) }} €
            </p>
        </div>
    </div>
</template>
