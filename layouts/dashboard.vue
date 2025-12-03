<script lang="ts">
export const description = 'An inset sidebar with secondary navigation.'
export const iframeHeight = '800px'
</script>
<script setup lang="ts">
import { computed } from 'vue'
import AppSidebar from '~/components/dashboard/AppSidebar.vue'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

const route = useRoute()

// Mapping des routes vers des labels lisibles
const routeLabels: Record<string, string> = {
  '/dashboard': 'Tableau de bord',
  '/caisse': 'Caisse',
  '/synthese': 'Synthèse journée',
  '/clotures': 'Historique clôtures',
  '/produits': 'Catalogue',
  '/produits/create': 'Nouveau produit',
  '/categories': 'Catégories',
  '/variations': 'Variations',
  '/stocks': 'État des stocks',
  '/mouvements': 'Mouvements de stock',
  '/clients': 'Clients',
  '/clients/create': 'Nouveau client',
}

// Générer le fil d'Ariane dynamique
const breadcrumbs = computed(() => {
  const path = route.path
  const segments = path.split('/').filter(Boolean)
  const items: { label: string; path: string }[] = []

  // Toujours ajouter Dashboard en premier
  items.push({ label: 'Dashboard', path: '/dashboard' })

  // Construire le chemin progressivement
  let currentPath = ''
  for (const segment of segments) {
    if (segment === 'dashboard') continue // Skip car déjà ajouté

    currentPath += `/${segment}`

    // Gérer les routes dynamiques (ex: /produits/123/edit)
    if (!isNaN(Number(segment))) {
      // C'est un ID, on peut le skip ou le remplacer
      continue
    }

    const label = routeLabels[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1)
    items.push({ label, path: currentPath })
  }

  return items
})
</script>
<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <header class="flex h-16 shrink-0 items-center gap-2">
        <div class="flex items-center gap-2 px-4">
          <SidebarTrigger class="-ml-1" />
          <Separator orientation="vertical" class="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <template v-for="(item, index) in breadcrumbs" :key="item.path">
                <BreadcrumbItem v-if="index < breadcrumbs.length - 1">
                  <BreadcrumbLink :href="item.path">
                    {{ item.label }}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbItem v-else>
                  <BreadcrumbPage>
                    {{ item.label }}
                  </BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator v-if="index < breadcrumbs.length - 1" />
              </template>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <slot />
    </SidebarInset>
  </SidebarProvider>
</template>