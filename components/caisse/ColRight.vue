<script setup lang="ts">
import { ref, computed, isRef } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { ProductInCart } from '@/types/pos'
import { X, Banknote, CreditCard } from 'lucide-vue-next'

const props = defineProps(['cart'])
const cart = toRef(props, 'cart') as Ref<ProductInCart[]>
const montantRecu = ref(0)
const paymentMode = ref('')

const totalTTC = computed(() =>
    Array.isArray(cart.value)
        ? cart.value.reduce((sum, p) => {
            const basePrice =
                p.discountType === '%'
                    ? p.price * (1 - p.discount / 100)
                    : p.price - p.discount
            return sum + basePrice * p.quantity
        }, 0)
        : 0
)

const totalHT = computed(() => totalTTC.value / 1.2)

const totalTVA = computed(() =>
    cart.value.reduce((sum, p) => {
        const basePrice =
            p.discountType === '%'
                ? p.price * (1 - p.discount / 100)
                : p.price - p.discount

        const tvaRate = p.tva ?? 20
        const tvaAmount = basePrice * (tvaRate / (100 + tvaRate))

        return sum + tvaAmount * p.quantity
    }, 0)
)

function validerVente() {
    if (!paymentMode.value) {
        alert('Veuillez choisir un mode de paiement.')
        return
    }
    // Logique de validation à adapter selon ton système
    console.log('Vente validée', { totalTTC: totalTTC.value, paymentMode: paymentMode.value })
    cart.value = []
    montantRecu.value = 0
    paymentMode.value = ''
}
const payments = ref<{ mode: string; amount: number }[]>([])
const totalPaid = computed(() =>
    payments.value.reduce((sum, p) => sum + p.amount, 0)
)

const balance = computed(() => totalTTC.value - totalPaid.value)

function addPayment(mode: string) {
    if (payments.value.find((p) => p.mode === mode)) return

    const newAmount = balance.value > 0 ? balance.value : 0
    payments.value.push({ mode, amount: parseFloat(newAmount.toFixed(2)) })
}

function removePayment(mode: string) {
    payments.value = payments.value.filter((p) => p.mode !== mode)
}

watch(() => cart.value, (val) => {
    console.log('cart changed →', val)
}, { deep: true })
</script>

<template>
    <div class="space-y-4">
        <!-- 💰 Montant total -->
        <div class="relative rounded-lg w-full h-50 shadow bg-black text-white dark:bg-white dark:text-black p-4">
            <!-- 🔝 Titre Total -->
            <div class="absolute top-2 left-4 text-xl font-medium text-gray-400 dark:text-black">
                Total TTC
            </div>
            <!-- 🎯 Montant TTC -->
            <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div class="text-5xl font-bold text-black dark:text-black">
                    {{ totalTTC.toFixed(2) }} €
                </div>
            </div>
            <!-- ⬆️ TVA -->
            <div class="absolute bottom-8 right-4 text-sm text-gray-400 dark:text-gray-600">
                TVA : {{ totalTVA.toFixed(2) }} €
            </div>
            <!-- ⬇️ HT -->
            <div class="absolute bottom-2 right-4 text-sm text-gray-400 dark:text-gray-600">
                HT : {{ totalHT.toFixed(2) }} €
            </div>
            <!-- ⬇️ Solde ou rendu -->
            <div class="absolute bottom-2 left-4 text-sm font-semibold">
                <span v-if="balance < 0" class="text-red-500">
                    Rendu : {{ Math.abs(balance).toFixed(2) }} €
                </span>
                <span v-else-if="balance > 0" class="text-orange-500">
                    Solde : {{ balance.toFixed(2) }} €
                </span>
            </div>
        </div>

        <!-- 💳 Boutons de paiement -->
        <div class="space-y-2">
            <label class="text-sm font-semibold">Mode de paiement</label>
            <div class="grid grid-cols-2 gap-2">
                <Button variant="outline" @click="addPayment('Espèces')">
                    <Banknote class="w-4 h-4 mr-2" />
                    Espèces
                </Button>
                <Button variant="outline" @click="addPayment('Carte')">
                    <CreditCard class="w-4 h-4 mr-2" />
                    Carte
                </Button>
                <Button variant="outline" @click="addPayment('Autre')">
                    Autre
                </Button>
            </div>
        </div>

        <!-- 📦 Paiements sélectionnés -->
        <div v-if="payments.length > 0" class="space-y-2">
            <div v-for="payment in payments" :key="payment.mode"
                class="relative p-3 border rounded-md bg-white dark:bg-gray-900 shadow-sm">
                <button class="absolute top-2 right-2 text-red-500 hover:text-red-700"
                    @click="removePayment(payment.mode)">
                    <X class="w-4 h-4" />
                </button>
                <div class="text-sm font-semibold mb-2">{{ payment.mode }}</div>
                <Input v-model.number="payment.amount" type="number" class="w-full text-right" min="0" step="0.01" />
            </div>
        </div>
    </div>

    <!-- ✅ Bouton en bas -->
    <div class="pt-4">
        <Button class="w-full text-lg font-semibold">Valider la vente</Button>
    </div>
</template>