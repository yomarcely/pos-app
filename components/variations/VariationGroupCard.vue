<template>
  <Card class="hover:shadow-lg transition-shadow">
    <CardHeader>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-accent rounded-lg">
            <Layers class="w-5 h-5" />
          </div>
          <div>
            <CardTitle class="text-xl">{{ group.name }}</CardTitle>
            <CardDescription>{{ group.variations.length }} variation(s)</CardDescription>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="sm" @click="$emit('add-variation', group)">
            <Plus class="w-4 h-4 mr-1" />
            Ajouter une variation
          </Button>
          <Button variant="ghost" size="sm" @click="$emit('edit-group', group)">
            <Edit class="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" @click="$emit('delete-group', group)">
            <Trash2 class="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <!-- Liste des variations -->
      <div v-if="group.variations.length > 0" class="flex flex-wrap gap-2">
        <div
          v-for="variation in group.variations"
          :key="variation.id"
          class="flex items-center gap-2 px-3 py-2 bg-accent rounded-lg hover:bg-accent/80 transition-colors"
        >
          <span class="font-medium">{{ variation.name }}</span>
          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              class="h-6 w-6"
              @click="$emit('edit-variation', variation, group)"
            >
              <Edit class="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="h-6 w-6"
              @click="$emit('delete-variation', variation)"
            >
              <Trash2 class="w-3 h-3 text-destructive" />
            </Button>
          </div>
        </div>
      </div>
      <div v-else class="text-center py-8 text-muted-foreground">
        Aucune variation dans ce groupe
      </div>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Plus, Edit, Trash2, Layers } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Variation {
  id: number
  name: string
  sortOrder: number
}

interface VariationGroup {
  id: number
  name: string
  variations: Variation[]
}

defineProps<{
  group: VariationGroup
}>()

defineEmits<{
  'add-variation': [group: VariationGroup]
  'edit-group': [group: VariationGroup]
  'delete-group': [group: VariationGroup]
  'edit-variation': [variation: Variation, group: VariationGroup]
  'delete-variation': [variation: Variation]
}>()
</script>
