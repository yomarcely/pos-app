<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import NavMain from './NavMain.vue'
import NavProjects from './NavProjects.vue'
import NavSecondary from './NavSecondary.vue'
import NavUser from './NavUser.vue'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  type SidebarProps,
} from '@/components/ui/sidebar'
import {
  Command,
  LifeBuoy,
  Send,
  Settings2,
  ShoppingCart,
  Package,
  Users,
  BarChart,
  MoveRight,
} from 'lucide-vue-next'

const props = withDefaults(defineProps<SidebarProps>(), {
  variant: 'inset',
})

const authStore = useAuthStore()
const isClient = ref(false)

onMounted(() => {
  isClient.value = true
})

const user = computed(() => {
  if (!isClient.value) {
    return {
      name: 'Utilisateur',
      email: '',
      avatar: '/avatars/shadcn.jpg',
    }
  }
  return {
    name: authStore.user?.user_metadata?.name || authStore.user?.email?.split('@')[0] || 'Utilisateur',
    email: authStore.user?.email || '',
    avatar: authStore.user?.user_metadata?.avatar_url || '/avatars/shadcn.jpg',
  }
})

const data = {
  navMain: [
    {
      title: 'Ventes',
      url: '#',
      icon: ShoppingCart,
      items: [
        {
          title: 'Nouvelle vente',
          url: '/caisse',
        },
        {
          title: 'Synthèse journée',
          url: '/synthese',
        },
        {
          title: 'Historique clôtures',
          url: '/clotures',
        },
      ],
    },
    {
      title: 'Catalogue',
      url: '#',
      icon: Package,
      items: [
        {
          title: 'Listing',
          url: '/produits',
        },
        {
          title: 'Catégories',
          url: '/categories',
        },
        {
          title: 'Variations',
          url: '/variations',
        },
        {
          title: 'Promotions',
          url: '#',
          disabled: true,
        },
        {
          title: 'Imprimer étiquette',
          url: '#',
          disabled: true,
        },
      ],
    },
    {
      title: 'Clients',
      url: '#',
      icon: Users,
      items: [
        {
          title: 'Listing',
          url: '/clients',
        },
        {
          title: 'Mailing / SMS',
          url: '#',
          disabled: true,
        },
        {
          title: 'Fusion',
          url: '#',
          disabled: true,
        },
      ],
    },
    {
      title: 'Mouvements de stock',
      url: '#',
      icon: MoveRight,
      items: [
        {
          title: 'Mouvements',
          url: '/mouvements',
        },
        {
          title: 'Réceptions fournisseurs',
          url: '#',
          disabled: true,
        },
        {
          title: 'Inventaire',
          url: '#',
          disabled: true,
        },
        {
          title: 'Historique',
          url: '#',
          disabled: true,
        },
        {
          title: 'État des stocks',
          url: '/stocks',
        },
      ],
    },
    {
      title: 'Statistiques',
      url: '#',
      icon: BarChart,
      items: [
        {
          title: 'Chiffre d\'affaire',
          url: '#',
          disabled: true,
        },
        {
          title: 'Catalogue',
          url: '#',
          disabled: true,
        },
        {
          title: 'Vendeur',
          url: '#',
          disabled: true,
        },
        {
          title: 'Analyse',
          url: '#',
          disabled: true,
        },
      ],
    },
    {
      title: 'Paramètres',
      url: '#',
      icon: Settings2,
      items: [
        {
          title: 'General',
          url: '#',
        },
        {
          title: 'Vendeurs',
          url: '/vendeurs',
        },
        {
          title: 'Etablissements',
          url: '/etablissements',
        },
        {
          title: 'TVA',
          url: '/tva',
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: 'Aide',
      url: '#',
      icon: LifeBuoy,
      disabled: true,
    },
    {
      title: 'Feedback',
      url: '#',
      icon: Send,
      disabled: true,
    },
  ],
}
</script>
<template>
  <Sidebar v-bind="props">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" as-child>
            <NuxtLink to="/dashboard">
              <div
                class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Command class="size-4" />
              </div>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-semibold">Acme Inc</span>
                <span class="truncate text-xs">Enterprise</span>
              </div>
            </NuxtLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <NavMain :items="data.navMain" />
      <NavSecondary :items="data.navSecondary" class="mt-auto" />
    </SidebarContent>
    <SidebarFooter>
      <NavUser :user="user" />
    </SidebarFooter>
  </Sidebar>
</template>
