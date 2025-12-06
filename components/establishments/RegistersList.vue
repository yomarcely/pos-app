<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <h4 class="font-semibold text-sm">Caisses ({{ registers.length }})</h4>
      <Button size="sm" variant="outline" @click="$emit('add-register')">
        <Plus class="w-3 h-3 mr-1" />
        Ajouter
      </Button>
    </div>

    <div v-if="registers.length === 0" class="text-sm text-muted-foreground py-4 text-center border rounded-lg">
      Aucune caisse configurée
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="register in registers"
        :key="register.id"
        class="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition"
      >
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
            <CreditCard class="w-4 h-4 text-primary" />
          </div>
          <div>
            <div class="font-medium text-sm">{{ register.name }}</div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Badge :variant="register.isActive ? 'default' : 'secondary'" class="text-xs">
            {{ register.isActive ? 'Actif' : 'Inactif' }}
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon" class="h-8 w-8">
                <MoreVertical class="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @click="$emit('edit-register', register)">
                <Pencil class="w-3 h-3 mr-2" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="register.isActive"
                @click="$emit('toggle-register', register)"
              >
                <CircleOff class="w-3 h-3 mr-2" />
                Désactiver
              </DropdownMenuItem>
              <DropdownMenuItem
                v-else
                @click="$emit('toggle-register', register)"
              >
                <CircleCheck class="w-3 h-3 mr-2" />
                Activer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                class="text-destructive"
                @click="$emit('delete-register', register)"
              >
                <Trash2 class="w-3 h-3 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Plus, CreditCard, MoreVertical, Pencil, Trash2, CircleOff, CircleCheck } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Register {
  id: number
  establishmentId: number
  name: string
  isActive: boolean
}

defineProps<{
  registers: Register[]
}>()

defineEmits<{
  'add-register': []
  'edit-register': [register: Register]
  'delete-register': [register: Register]
  'toggle-register': [register: Register]
}>()
</script>
