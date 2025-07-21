<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { GalleryVerticalEnd, ChevronDown, Settings2 } from 'lucide-vue-next'


const selected = ref('Caisse 1') // valeur par défaut
</script>

<template>
    <header class="flex h-16 items-center justify-between px-4 border-b">
        <!-- Gauche : Logo -->
        <div class="flex items-center gap-2">
            <a href="/dashboard" class="flex items-center gap-2 font-medium">
                <div class="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <GalleryVerticalEnd class="size-4" />
                </div>
                FymPOS
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
</template>