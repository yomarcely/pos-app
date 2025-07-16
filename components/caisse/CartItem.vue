<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Input } from '@/components/ui/input'
import {
    NumberField, NumberFieldContent, NumberFieldDecrement,
    NumberFieldIncrement, NumberFieldInput
} from '@/components/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import type { ProductInCart } from '@/types/pos'

const props = defineProps<{
    product: ProductInCart
    variationGroups: {
        id: string
        name: string
        options: { label: string; value: string }[]
    }[]
}>()

const emit = defineEmits<{
    (e: 'remove', id: number): void
}>()

// Stock dynamique selon la variation sélectionnée
const stock = computed(() => {
    if (props.product.variationGroupIds && props.product.variationGroupIds.length > 0) {
        const selectedKey = props.product.variation // exemple : '0.15'
        const stockMap = props.product.stockByVariation ?? {}
        return stockMap[selectedKey] ?? 0
    } else {
        return props.product.stock ?? 0
    }
})

const stockColor = computed(() => {
    if (stock.value <= 0) return 'bg-red-500'
    if (stock.value < 5) return 'bg-orange-400'
    return 'bg-green-500'
})

// Prix final
const finalPrice = ref(getFinalPriceFromProduct())
const isEditingPrice = ref(false)
const isEditingDiscount = ref(false)

function getFinalPriceFromProduct(): number {
    const p = props.product
    return p.discountType === '%'
        ? Math.round((p.price * (1 - p.discount / 100)) * 100) / 100
        : Math.round((p.price - p.discount) * 100) / 100
}

watch(() => props.product.discount, (newVal) => {
    if (isEditingDiscount.value) {
        finalPrice.value = props.product.discountType === '%'
            ? Math.round((props.product.price * (1 - newVal / 100)) * 100) / 100
            : Math.round((props.product.price - newVal) * 100) / 100
    }
})

watch(finalPrice, (newVal) => {
    if (isEditingPrice.value) {
        const base = props.product.price
        const delta = base - newVal
        props.product.discount = props.product.discountType === '%'
            ? Math.round((delta / base) * 10000) / 100
            : Math.round(delta * 100) / 100
    }
})

watch(() => props.product.discountType, () => {
    const base = props.product.price
    const delta = base - finalPrice.value
    props.product.discount = props.product.discountType === '%'
        ? Math.round((delta / base) * 10000) / 100
        : Math.round(delta * 100) / 100
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
</script>

<template>
    <div class="relative flex gap-4 p-4 mb-2 rounded-lg shadow-sm border">
        <!-- ❌ Supprimer -->
        <button @click="emit('remove', product.id)" class="absolute top-2 right-2 text-gray-400 hover:text-red-500">
            <X class="w-4 h-4" />
        </button>

        <!-- 📦 Quantité + image -->
        <div class="flex flex-col items-center gap-2 w-25">
            <NumberField v-model.number="product.quantity" class="w-full text-center">
                <NumberFieldContent>
                    <NumberFieldDecrement />
                    <NumberFieldInput />
                    <NumberFieldIncrement />
                </NumberFieldContent>
            </NumberField>
            <RouterLink :to="`/produits/${product.id}`">
                <img :src="product.image" :alt="product.name" class="w-12 h-12 rounded" />
            </RouterLink>
        </div>

        <!-- 🧾 Détails -->
        <div class="flex-1 space-y-1 text-sm">
            <!-- Nom + Stock -->
            <div class="flex items-center gap-2">
                <RouterLink :to="`/produits/${product.id}`"
                    class="font-semibold text-primary hover:underline transition">
                    {{ product.name }}
                </RouterLink>
                <span
                    class="inline-flex items-center justify-center text-xs text-white font-medium px-1.5 py-0.5 rounded"
                    :class="stockColor" :title="`${stock} en stock`">
                    {{ stock }}
                </span>
            </div>

            <!-- Groupes de variation -->
            <div v-if="product.variationGroupIds && product.variationGroupIds.length > 0" class="flex gap-2 mt-1">
                <div v-for="groupId in product.variationGroupIds" :key="groupId" class="flex-1">
                    <Select v-model="product.variation">
                        <SelectTrigger>
                            <SelectValue :placeholder="groupId" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem v-for="option in variationGroups.find(v => v.id === groupId)?.options || []"
                                :key="option.value" :value="option.value">
                                {{ option.label }}
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <!-- Remise -->
            <div class="flex gap-2">
                <Input @keydown="allowOnlyDecimal"
                    :model-value="product.discount === 0 ? '' : product.discount.toString()" placeholder="Remise"
                    @focus="isEditingDiscount = true" @blur="() => { isEditingDiscount = false }" @update:model-value="val => {
                        const num = parseFloat(String(val))
                        product.discount = !isNaN(num) ? num : 0
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
            <Input @keydown="allowOnlyDecimal" :model-value="finalPrice.toString()" @focus="isEditingPrice = true"
                @blur="() => { isEditingPrice = false }" @update:model-value="val => {
                    const num = parseFloat(String(val))
                    if (!isNaN(num)) {
                        finalPrice = num
                    }
                }" :class="[
                    'w-24 text-right',
                    isBelowPurchasePrice ? 'border-red-500 text-red-600' : ''
                ]" />
            <p class="text-xs text-muted-foreground text-right">
                Total : {{ (finalPrice * props.product.quantity).toFixed(2) }} €
            </p>
        </div>
    </div>
</template>
