<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { NumberField, NumberFieldContent, NumberFieldDecrement, NumberFieldIncrement, NumberFieldInput } from '@/components/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import type { ProductInCart } from '@/types/pos'
import { toRefs } from 'vue'

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

const { product } = toRefs(props)

function getUnitPrice(product: ProductInCart): number {
    if (product.discountType === '%') {
        return product.price * (1 - product.discount / 100)
    } else if (product.discountType === '€') {
        return product.price - product.discount
    }
    return product.price
}

function getTotalPrice(product: ProductInCart): number {
    return Math.max(getUnitPrice(product), 0) * product.quantity
}

function updateDiscountFromTotal(product: ProductInCart, newTotal: number) {
  if (isNaN(newTotal) || newTotal < 0) return

  const totalBase = product.price * product.quantity
  const difference = totalBase - newTotal
  const unitDifference = difference / product.quantity

  if (product.discountType === '%') {
    const percentage = (unitDifference / product.price) * 100
    product.discount = Math.min(Math.max(percentage, 0), 100)
  } else {
    product.discount = Math.min(Math.max(unitDifference, 0), product.price)
  }
}

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
            <RouterLink :to="`/produits/${product.id}`" class="font-semibold text-primary hover:underline transition">
                {{ product.name }}
            </RouterLink>

            <!-- Variation -->
            <div v-if="product.variationGroupId">
                <Select v-model="product.variation">
                    <SelectTrigger class="mt-1">
                        <SelectValue placeholder="Choisir une variation" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem
                            v-for="option in variationGroups.find(v => v.id === product.variationGroupId)?.options || []"
                            :key="option.value" :value="option.value">
                            {{ option.label }}
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <!-- Remise -->
            <div class="flex gap-2">
                <Input v-model.number="product.discount" placeholder="Remise" class="w-24" />
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
            <Input :model-value="getTotalPrice(product).toFixed(2)"
                @update:model-value="val => updateDiscountFromTotal(product, parseFloat(String(val)))"
                class="w-24 text-right" />

            <!-- 🏷 Prix unitaire réel -->
            <p class="text-xs text-muted-foreground text-right">
                {{ getUnitPrice(product).toFixed(2) }} € / unité
            </p>
        </div>
    </div>
</template>