<script lang="ts" setup>
import { GalleryVerticalEnd, ChevronDown, Settings2, UserRoundPlus, Banknote, CreditCard, X, User, List, Search, Barcode } from 'lucide-vue-next'
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Input
} from '@/components/ui/input'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'
import {
    NumberField,
    NumberFieldContent,
    NumberFieldDecrement,
    NumberFieldIncrement,
    NumberFieldInput,
} from '@/components/ui/number-field'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Combobox, ComboboxAnchor, ComboboxEmpty, ComboboxGroup, ComboboxInput, ComboboxItem, ComboboxTrigger, ComboboxList } from '@/components/ui/combobox'


const selected = ref('Caisse 1') // valeur par défaut
const pendingTickets = 3


function openClientCard() {
    console.log('Fiche client')
}

function openClientHistory() {
    console.log('Historique client')
}

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

const images = import.meta.glob('@/assets/img/*', {
  eager: true,
  import: 'default'
}) as Record<string, string>

const products = ref([
    {
        id: 1,
        name: 'Freeze Fruit du Dragon 50ml',
        quantity: 1,
        price: 14.90,
        discount: 0,
        discountType: '%',
        variation: '',
        image: images['/assets/img/freeze-dragon.png']
    },
    {
        id: 2,
        name: 'Booster 50/50',
        quantity: 2,
        price: 1,
        discount: 0,
        discountType: '€',
        variation: '',
        image: images['/assets/img/booster.png']
    },
    {
        id: 3,
        name: '-20 GeekVape Serie Z',
        quantity: 4,
        price: 3.5,
        discount: 0,
        discountType: '%',
        variationGroupId: 'resistance',
        variation: '',
        image: images['/assets/img/series-z.png']
    },
    {
        id: 4,
        name: '-20 GeekVape Serie Z',
        quantity: 1,
        price: 3.5,
        discount: 100,
        discountType: '%',
        variationGroupId: 'resistance',
        variation: '',
        image: images['/assets/img/series-z.png']
    },
    {
        id: 5,
        name: 'GeekVape Z nano 2',
        quantity: 1,
        price: 24.90,
        discount: 0,
        discountType: '%',
        variationGroupId: 'color',
        variation: 'noir',
        image: images['/assets/img/z-nano.png']
    },
    {
        id: 6,
        name: 'Pulp Cerise Glacée 10ml',
        quantity: 1,
        price: 5.90,
        discount: 0,
        discountType: '%',
        variationGroupId: 'nicotine',
        variation: '6mg',
        image: images['/assets/img/pulp-cerise.png']
    },
])

function removeProduct(id: number) {
    products.value = products.value.filter(p => p.id !== id)
}

function addPayment(mode: string) {
    if (payments.value.find((p) => p.mode === mode)) return

    const newAmount = balance.value > 0 ? balance.value : 0
    payments.value.push({ mode, amount: parseFloat(newAmount.toFixed(2)) })
}

function removePayment(mode: string) {
    payments.value = payments.value.filter((p) => p.mode !== mode)
}

const totalTTC = computed(() =>
    products.value.reduce((sum, product) => {
        let unitPrice = product.price

        if (product.discountType === '%') {
            unitPrice -= product.price * product.discount / 100
        } else if (product.discountType === '€') {
            unitPrice -= product.discount
        }

        return sum + Math.max(unitPrice, 0) * product.quantity
    }, 0)
)

const totalHT = computed(() => totalTTC.value / 1.2)

const payments = ref<{ mode: string; amount: number }[]>([])
const totalPaid = computed(() =>
    payments.value.reduce((sum, p) => sum + p.amount, 0)
)

const balance = computed(() => totalTTC.value - totalPaid.value)

function getProductTotal(product: {
    price: number
    quantity: number
    discount: number
    discountType: string
}) {
    const { price, quantity, discount, discountType } = product

    let unitPrice = price

    if (discountType === '%') {
        unitPrice = price - (price * discount / 100)
    } else if (discountType === '€') {
        unitPrice = price - discount
    }

    return Math.max(unitPrice, 0) * quantity
}

const selectedClient = ref<null | { name: string; city: string }>(
    { name: 'Jean Dupont', city: 'Cavaillon' }
)

function deselectClient() {
    selectedClient.value = null
}

const frameworks = [
    { value: 'next.js', label: 'Next.js' },
    { value: 'sveltekit', label: 'SvelteKit' },
    { value: 'nuxt', label: 'Nuxt' },
    { value: 'remix', label: 'Remix' },
    { value: 'astro', label: 'Astro' },
]
</script>

<template>
    <header class="flex h-16 items-center justify-between px-4 border-b">
        <!-- Gauche : Logo -->
        <div class="flex items-center gap-2">
            <a href="/dashboard" class="flex items-center gap-2 font-medium">
                <div class="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <GalleryVerticalEnd class="size-4" />
                </div>
                POS App
            </a>
        </div>

        <!-- Centre : Select caisse (transparent) -->
        <div class="flex-1 flex justify-center">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger>
                        <DropdownMenu>
                            <DropdownMenuTrigger class="flex items-center gap-1">
                                {{ selected }}
                                <ChevronDown class="h-4 w-4" />
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="start">
                                <DropdownMenuItem @click="selected = 'Caisse 1'">Caisse 1</DropdownMenuItem>
                                <DropdownMenuItem @click="selected = 'Caisse 2'">Caisse 2</DropdownMenuItem>
                                <DropdownMenuItem @click="selected = 'Caisse 3'">Caisse 3</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Séléction du numéro de caisse</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>

        <!-- Droite : Select magasin + settings -->
        <div class="flex items-center gap-2">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger>
                        <Select defaultValue="shop-paris">
                            <SelectTrigger class="px-3">
                                <SelectValue placeholder="Magasin" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="shop-paris">Shop - Paris</SelectItem>
                                    <SelectItem value="shop-marseille">Shop - Marseille</SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Séléction du point de vente</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger>
                        <Button variant="ghost" size="icon">
                            <Settings2 />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Paramètres Caisse</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    </header>
    <div class="h-[calc(100vh-4rem)] grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-4 p-4 overflow-hidden">
        <!-- ⬅️ Colonne gauche : Vendeur / Client / Raccourcis -->
        <aside class="p-4 h-full rounded-lg shadow bg-muted/50">
            <div class="max-w-xs mx-auto space-y-4">
                <!-- Sélecteur vendeur -->
                <div>
                    <label class="text-sm font-semibold">Vendeur</label>
                    <Select defaultValue="yohan">
                        <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un vendeur" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="yohan">Yohan</SelectItem>
                            <SelectItem value="mary">Mary</SelectItem>
                            <SelectItem value="jade">Jade</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <!-- Client -->
                <div>
                    <label class="text-sm font-semibold">Client</label>
                    <Input placeholder="Recherche client" />

                    <div v-if="selectedClient"
                        class="relative mt-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm shadow-sm">
                        <!-- Croix -->
                        <button @click="deselectClient" class="absolute top-1 right-1 text-gray-400 hover:text-red-500">
                            <X class="w-4 h-4" />
                        </button>

                        <div class="flex items-center justify-between pr-2">
                            <div class="flex flex-col leading-tight text-sm">
                                <span class="font-medium">{{ selectedClient.name }}</span>
                                <span class="text-xs text-gray-500">{{ selectedClient.city }}</span>
                            </div>

                            <div class="flex items-center gap-2 pr-1">
                                <button @click="openClientCard" class="text-gray-600 hover:text-gray-900">
                                    <User class="w-6 h-6" />
                                </button>
                                <button @click="openClientHistory" class="text-gray-600 hover:text-gray-900">
                                    <List class="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <Button variant="outline" class="mt-2">
                        <UserRoundPlus />
                    </Button>
                </div>

                <!-- Remise -->
                <div>
                    <label class="text-sm font-semibold">Remise globale</label>
                    <div class="flex gap-2 mt-1">
                        <Input placeholder="0" class="w-full" />
                        <Select defaultValue="%">
                            <SelectTrigger class="w-20">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="%">%</SelectItem>
                                <SelectItem value="€">€</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <!-- Mise en attente / Reprise -->
                <div class="flex gap-2">
                    <Button class="flex-1" variant="outline">Mise en attente</Button>
                    <Button class="flex-1" variant="secondary">
                        Reprise
                        <Badge class="ml-2 bg-red-500" variant="default">{{ pendingTickets }}</Badge>
                    </Button>
                </div>

                <!-- Grille de raccourcis -->
                <div>
                    <label class="text-sm font-semibold mb-1 block">Raccourcis</label>
                    <div class="grid grid-cols-3 gap-2">
                        <ContextMenu v-for="n in 24" :key="n">
                            <ContextMenuTrigger>
                                <Button class="h-12 rounded text-sm w-full" variant="secondary">
                                    Vide
                                </Button>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                                <ContextMenuItem>Créer un raccourci produit</ContextMenuItem>
                                <ContextMenuItem>Créer un raccourci client</ContextMenuItem>
                                <ContextMenuSeparator />
                                <ContextMenuItem>Autre action</ContextMenuItem>
                            </ContextMenuContent>
                        </ContextMenu>
                    </div>
                </div>
            </div>
        </aside>

        <!-- 🟨 Colonne centrale : Scan / Produits -->
        <main class="p-4 rounded-lg shadow space-y-4 overflow-hidden bg-muted/50 h-full">
            <!-- Inputs scan + recherche -->
            <div class="flex gap-2">
                <Tabs default-value="barcode">
                    <div class="flex items-center gap-2">
                        <!-- Onglets -->
                        <TabsList class="flex gap-1 w-auto">
                            <TabsTrigger value="barcode">
                                <Barcode class="w-4 h-4" />
                            </TabsTrigger>
                            <TabsTrigger value="search">
                                <Search class="w-4 h-4" />
                            </TabsTrigger>
                        </TabsList>

                        <!-- Contenu des tabs (input actif) -->
                        <div class="flex-1">
                            <TabsContent value="barcode">
                                <Input placeholder="Scanner un code-barres" class="w-full" />
                            </TabsContent>
                            <TabsContent value="search">
                                <Combobox by="label">
                                        <ComboboxAnchor>
                                            <div class="relative w-full max-w-sm items-center">
                                                <ComboboxInput :display-value="(val) => val?.label ?? ''"
                                                    placeholder="Select language..." />
                                                <ComboboxTrigger
                                                    class="absolute end-0 inset-y-0 flex items-center justify-center px-3">
                                                </ComboboxTrigger>
                                            </div>
                                        </ComboboxAnchor>

                                    <ComboboxList>
                                        <ComboboxEmpty>
                                            Nothing found.
                                        </ComboboxEmpty>

                                        <ComboboxGroup>
                                            <ComboboxItem v-for="framework in frameworks" :key="framework.value"
                                                :value="framework">
                                                {{ framework.label }}
                                            </ComboboxItem>
                                        </ComboboxGroup>
                                    </ComboboxList>
                                </Combobox>
                            </TabsContent>
                        </div>
                    </div>
                </Tabs>
            </div>

            <!-- Liste des produits -->
            <ScrollArea class="h-[calc(100vh-180px)] w-full rounded-md p-4">
                <p v-if="products.length === 0" class="text-gray-500 text-sm text-center italic">
                    Aucun produit scanné
                </p>
                <div v-for="product in products" :key="product.id"
                    class="relative flex gap-4 p-4 mb-2 rounded-lg shadow-sm border">
                    <!-- ❌ Supprimer -->
                    <button @click="removeProduct(product.id)"
                        class="absolute top-2 right-2 text-gray-400 hover:text-red-500">
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
                        <img :src="product.image" :alt="product.name" class="w-12 h-12 rounded" />
                    </div>

                    <!-- 🧾 Détails -->
                    <div class="flex-1 space-y-1 text-sm">
                        <RouterLink :to="`/produits/${product.id}`"
                            class="font-semibold text-primary hover:underline transition">
                            {{ product.name }}
                        </RouterLink>

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

                        <!-- Variation (si disponible) -->
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
                    </div>

                    <!-- 💰 Prix unitaire + total -->
                    <div class="flex flex-col items-end justify-end gap-1">
                        <!-- Prix modifiable -->
                        <Input v-model.number="product.price" placeholder="Prix" class="w-24 text-right" />

                        <!-- Total calculé -->
                        <div class="text-sm font-bold text-gray-700 dark:text-gray-300">
                            Total : {{ getProductTotal(product).toFixed(2) }} €
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </main>

        <!-- 🟦 Colonne droite : Total / Paiement -->
        <aside class="flex flex-col justify-between h-full rounded-lg shadow bg-muted/50 p-4">
            <!-- 🧩 Partie haute : contenu paiement -->
            <div class="space-y-4">
                <!-- 💰 Montant total -->
                <div
                    class="relative rounded-lg w-full h-50 shadow bg-black text-white dark:bg-white dark:text-black p-4">
                    <!-- 🔝 Titre Total -->
                    <div class="absolute top-2 left-4 text-xl font-medium text-gray-400 dark:text-black">
                        Total
                    </div>
                    <!-- 🎯 Montant TTC -->
                    <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <div class="text-5xl font-bold text-black dark:text-black">
                            {{ totalTTC.toFixed(2) }} €
                        </div>
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
                        <Input v-model.number="payment.amount" type="number" class="w-full text-right" min="0"
                            step="0.01" />
                    </div>
                </div>
            </div>

            <!-- ✅ Bouton en bas -->
            <div class="pt-4">
                <Button class="w-full text-lg font-semibold">Valider la vente</Button>
            </div>
        </aside>
    </div>
</template>
