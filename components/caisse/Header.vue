<script setup lang="ts">
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { GalleryVerticalEnd, Settings2 } from 'lucide-vue-next'
import EstablishmentSelect from '@/components/shared/EstablishmentSelect.vue'
import RegisterSelect from '@/components/shared/RegisterSelect.vue'
</script>

<template>
    <header class="flex h-16 items-center px-4 border-b">
        <!-- Gauche : Logo -->
        <div class="flex items-center gap-2 flex-1">
            <a href="/dashboard" class="flex items-center gap-2 font-medium">
                <div class="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <GalleryVerticalEnd class="size-4" />
                </div>
                FymPOS
            </a>
        </div>

        <!-- Centre : Select caisse (Dropdown + Tooltip) -->
        <div class="flex items-center justify-center flex-1">
            <RegisterSelect :show-tooltip="true" />
        </div>

        <!-- Droite : Select magasin + settings -->
        <div class="flex items-center gap-2 justify-end flex-1">
            <EstablishmentSelect :show-tooltip="true" />

            <client-only>
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
            </client-only>
        </div>
    </header>
</template>
