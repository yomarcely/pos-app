<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 class="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle class="text-lg">{{ establishment.name }}</CardTitle>
            <CardDescription class="mt-1">
              <span v-if="establishment.city">{{ establishment.city }}</span>
              <span v-if="establishment.city && establishment.siret"> • </span>
              <span v-if="establishment.siret">SIRET: {{ formatSiret(establishment.siret) }}</span>
            </CardDescription>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Badge :variant="establishment.isActive ? 'default' : 'secondary'">
            {{ establishment.isActive ? 'Actif' : 'Inactif' }}
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon">
                <MoreVertical class="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @click="$emit('edit', establishment)">
                <Pencil class="w-4 h-4 mr-2" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="establishment.isActive"
                @click="$emit('toggle-status', establishment)"
              >
                <CircleOff class="w-4 h-4 mr-2" />
                Désactiver
              </DropdownMenuItem>
              <DropdownMenuItem
                v-else
                @click="$emit('toggle-status', establishment)"
              >
                <CircleCheck class="w-4 h-4 mr-2" />
                Activer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                class="text-destructive"
                @click="$emit('delete', establishment)"
              >
                <Trash2 class="w-4 h-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </CardHeader>

    <CardContent>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <!-- Adresse -->
        <div v-if="establishment.address || establishment.postalCode || establishment.city">
          <div class="font-semibold text-muted-foreground mb-1 flex items-center gap-2">
            <MapPin class="w-4 h-4" />
            Adresse
          </div>
          <div class="text-foreground">
            <div v-if="establishment.address">{{ establishment.address }}</div>
            <div v-if="establishment.postalCode || establishment.city">
              {{ establishment.postalCode }} {{ establishment.city }}
            </div>
            <div v-if="establishment.country">{{ establishment.country }}</div>
          </div>
        </div>

        <!-- Contact -->
        <div v-if="establishment.phone || establishment.email">
          <div class="font-semibold text-muted-foreground mb-1 flex items-center gap-2">
            <Phone class="w-4 h-4" />
            Contact
          </div>
          <div class="text-foreground space-y-1">
            <div v-if="establishment.phone">{{ establishment.phone }}</div>
            <div v-if="establishment.email">{{ establishment.email }}</div>
          </div>
        </div>

        <!-- Informations légales -->
        <div v-if="establishment.siret || establishment.naf || establishment.tvaNumber" class="md:col-span-2">
          <div class="font-semibold text-muted-foreground mb-1 flex items-center gap-2">
            <FileText class="w-4 h-4" />
            Informations légales
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-foreground">
            <div v-if="establishment.siret">
              <span class="text-muted-foreground">SIRET:</span> {{ formatSiret(establishment.siret) }}
            </div>
            <div v-if="establishment.naf">
              <span class="text-muted-foreground">NAF:</span> {{ establishment.naf }}
            </div>
            <div v-if="establishment.tvaNumber">
              <span class="text-muted-foreground">TVA:</span> {{ establishment.tvaNumber }}
            </div>
          </div>
        </div>

        <!-- Caisses -->
        <div v-if="registers && registers.length > 0" class="md:col-span-2 pt-4 border-t">
          <RegistersList
            :registers="registers"
            @add-register="$emit('add-register', establishment)"
            @edit-register="$emit('edit-register', $event)"
            @delete-register="$emit('delete-register', $event)"
            @toggle-register="$emit('toggle-register', $event)"
          />
        </div>
        <div v-else class="md:col-span-2 pt-4 border-t">
          <RegistersList
            :registers="[]"
            @add-register="$emit('add-register', establishment)"
            @edit-register="$emit('edit-register', $event)"
            @delete-register="$emit('delete-register', $event)"
            @toggle-register="$emit('toggle-register', $event)"
          />
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Building2, MoreVertical, Pencil, Trash2, CircleOff, CircleCheck, MapPin, Phone, FileText } from 'lucide-vue-next'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import RegistersList from './RegistersList.vue'

interface Establishment {
  id: number
  name: string
  address: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  phone: string | null
  email: string | null
  siret: string | null
  naf: string | null
  tvaNumber: string | null
  isActive: boolean
}

interface Register {
  id: number
  establishmentId: number
  name: string
  isActive: boolean
}

defineProps<{
  establishment: Establishment
  registers?: Register[]
}>()

defineEmits<{
  edit: [establishment: Establishment]
  delete: [establishment: Establishment]
  'toggle-status': [establishment: Establishment]
  'add-register': [establishment: Establishment]
  'edit-register': [register: Register]
  'delete-register': [register: Register]
  'toggle-register': [register: Register]
}>()

function formatSiret(siret: string | null): string {
  if (!siret) return ''
  // Format: 123 456 789 00010
  return siret.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4')
}
</script>
