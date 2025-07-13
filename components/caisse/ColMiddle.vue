<script setup lang="ts">
import { ref, watch, computed, type Ref } from 'vue'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import CartItem from './CartItem.vue'
import { Combobox, ComboboxAnchor, ComboboxInput, ComboboxTrigger, ComboboxList, ComboboxItem } from '@/components/ui/combobox'
import { Barcode } from 'lucide-vue-next'
import type { ProductBase, ProductInCart } from '@/types/pos'

const props = defineProps<{
    cart: any
    products: ProductBase[]
}>()

const Products = computed(() => props.products)
const barcodeInput = ref('')
const rawCart = isRef(props.cart) ? props.cart : ref(props.cart)
const cart = rawCart as Ref<ProductInCart[]>
const selectedProduct = ref<ProductBase | null>(null)

watch(selectedProduct, (product) => {
    if (product) {
        console.log('✅ Produit sélectionné :', product)
        addToCart(product)
        console.log('🛒 Cart après ajout :', cart.value)
        selectedProduct.value = null
    }
})

type VariationOption = { label: string; value: string }

type VariationGroup = {
    id: string
    name: string
    options: VariationOption[]
}
const variationGroups: VariationGroup[] = [
    {
        id: 'color',
        name: 'Couleur',
        options: [
            { label: 'Noir', value: 'noir' },
            { label: 'Bleu', value: 'bleu' },
            { label: 'Vert', value: 'vert' }
        ]
    },
    {
        id: 'nicotine',
        name: 'Taux de nicotine',
        options: [
            { label: '0mg', value: '0mg' },
            { label: '3mg', value: '3mg' },
            { label: '6mg', value: '6mg' }
        ]
    },
    {
        id: 'resistance',
        name: 'Résistance',
        options: [
            { label: '0.15Ω', value: '0.15' },
            { label: '0.2Ω', value: '0.2' }
        ]
    }
]

function searchByBarcode() {
    const found = Products.value.find(p => p.barcode === barcodeInput.value)
    if (found) addToCart(found)
    barcodeInput.value = ''
}

function removeFromCart(id: number) {
    cart.value = cart.value.filter(p => p.id !== id)
}

function addToCart(product: ProductBase) {
    if (!rawCart?.value) {
        console.error('⛔ rawCart.value est undefined')
        return
    }

    const existing = rawCart.value.find(
        (p: ProductInCart) => p.id === product.id && p.variation === ''
    )

    if (existing) {
        existing.quantity += 1
    } else {
        rawCart.value.push({
            ...product,
            quantity: 1,
            discount: 0,
            discountType: '€',
            variation: ''
        })
    }

    console.log('✅ Panier après ajout :', rawCart.value)
}
</script>

<template>
    <div class="flex justify-center gap-4 w-full">
        <!-- 📷 Input scan code-barres avec icône -->
        <div class="w-full max-w-sm">
            <label class="text-sm font-semibold block mb-1">Scan</label>
            <div class="relative">
                <Barcode class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input v-model="barcodeInput" placeholder="Scanner un code-barres" class="w-full pl-10"
                    @keyup.enter="searchByBarcode" />
            </div>
        </div>

        <!-- 🔍 Recherche produit avec combobox -->
        <div class="w-full max-w-sm">
            <label class="text-sm font-semibold block mb-1">Recherche</label>
            <Combobox v-model="selectedProduct" :options="Products" :option-value="(p: ProductBase) => p.id"
                :option-label="(p: ProductBase) => p.name" :get-option-value="(p: ProductBase) => p.id"
                :get-option-label="(p: ProductBase) => p.name">
                <ComboboxAnchor>
                    <div class="relative w-full items-center rounded-md border">
                        <ComboboxInput placeholder="Rechercher un produit" class="w-full" />
                        <ComboboxTrigger class="absolute right-0 inset-y-0 px-3" />
                    </div>
                </ComboboxAnchor>

                <ComboboxList>
                    <ComboboxEmpty>Aucun résultat</ComboboxEmpty>
                    <ComboboxGroup>
                        <ComboboxItem v-for="item in Products" :key="item.id" :value="item">
                            <div class="flex items-center gap-2">
                                <img :src="item.image" class="w-6 h-6 rounded" />
                                <span class="flex-1">{{ item.name }}</span>
                                <span class="text-sm text-gray-500">{{ item.price.toFixed(2) }} €</span>
                            </div>
                        </ComboboxItem>
                    </ComboboxGroup>
                </ComboboxList>
            </Combobox>
        </div>
    </div>

    <!-- Liste des produits -->
    <ScrollArea class="h-[calc(100vh-180px)] w-full rounded-md p-4">
        <CartItem v-for="product in cart" :key="product.id" :product="product" :variation-groups="variationGroups"
            @remove="removeFromCart" />
    </ScrollArea>
</template>