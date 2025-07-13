<script setup lang="ts">
import { ref } from 'vue'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserRoundPlus, X, User, List } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu'

const pendingTickets = 3

const selectedClient = ref<null | { name: string; city: string }>(
    { name: 'Jean Dupont', city: 'Cavaillon' }
)

function deselectClient() {
    selectedClient.value = null
}

function openClientCard() {
  console.log('Fiche client')
}

function openClientHistory() {
  console.log('Historique client')
} 
</script>


<template>
  <div class="max-w-xs mx-auto space-y-4">
                <!-- Sélecteur vendeur -->
                <div>
                    <label class="text-sm font-semibold">Vendeur</label>
                    <Select defaultValue="">
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
</template>