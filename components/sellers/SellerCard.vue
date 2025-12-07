<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3 flex-1">
          <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User class="w-5 h-5 text-primary" />
          </div>
          <div class="flex-1">
            <CardTitle class="text-lg">{{ seller.name }}</CardTitle>
            <CardDescription v-if="seller.code" class="mt-1">
              Code: {{ seller.code }}
            </CardDescription>
            <div v-if="establishments.length > 0" class="mt-2 flex flex-wrap gap-1">
              <Badge
                v-for="establishment in establishments"
                :key="establishment.id"
                variant="outline"
                class="text-xs"
              >
                <Building2 class="w-3 h-3 mr-1" />
                {{ establishment.name }}
              </Badge>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Badge :variant="seller.isActive ? 'default' : 'secondary'">
            {{ seller.isActive ? 'Actif' : 'Inactif' }}
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon">
                <MoreVertical class="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @click="$emit('edit', seller)">
                <Pencil class="w-4 h-4 mr-2" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="seller.isActive"
                @click="$emit('toggle-status', seller)"
              >
                <CircleOff class="w-4 h-4 mr-2" />
                Désactiver
              </DropdownMenuItem>
              <DropdownMenuItem
                v-else
                @click="$emit('toggle-status', seller)"
              >
                <CircleCheck class="w-4 h-4 mr-2" />
                Activer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                class="text-destructive"
                @click="$emit('delete', seller)"
              >
                <Trash2 class="w-4 h-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </CardHeader>
  </Card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { User, MoreVertical, Pencil, Trash2, CircleOff, CircleCheck, Building2 } from 'lucide-vue-next'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Seller {
  id: number
  name: string
  code: string | null
  isActive: boolean
}

interface Establishment {
  id: number
  name: string
}

const props = defineProps<{
  seller: Seller
}>()

defineEmits<{
  edit: [seller: Seller]
  delete: [seller: Seller]
  'toggle-status': [seller: Seller]
}>()

const establishments = ref<Establishment[]>([])
const loading = ref(true)

async function loadEstablishments() {
  try {
    loading.value = true
    const response = await $fetch<{ establishments: Establishment[] }>(
      `/api/sellers/${props.seller.id}/establishments`
    )
    establishments.value = response.establishments || []
  } catch (error) {
    console.error('Erreur lors du chargement des établissements:', error)
    establishments.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => props.seller,
  () => {
    loadEstablishments()
  },
  { immediate: true }
)
</script>
