<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import NavMain from './NavMain.vue'
import NavProjects from './NavProjects.vue'
import NavSecondary from './NavSecondary.vue'
import NavUser from './NavUser.vue'
import OnboardingChecklist from './OnboardingChecklist.vue'
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
  variant: 'floating',
  collapsible: 'icon',
})

const authStore = useAuthStore()
const { canAccess } = useUserRole()
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
          title: 'Marques',
          url: '/marques',
        },
        {
          title: 'Fournisseurs',
          url: '/fournisseurs',
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
          url: '/mouvements/reception',
        },
        {
          title: 'Inventaire',
          url: '/mouvements/inventaire',
        },
        {
          title: 'Historique',
          url: '/mouvements/historique',
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
      minRole: 'manager',
      items: [
        {
          title: 'Chiffre d\'affaires',
          url: '/statistiques/ca',
        },
        {
          title: 'Vendeurs',
          url: '/statistiques/vendeurs',
        },
        {
          title: 'Produits',
          url: '/statistiques/produits',
        },
        {
          title: 'Rapports comptables',
          url: '/rapports',
        },
      ],
    },
    {
      title: 'Paramètres',
      url: '#',
      icon: Settings2,
      minRole: 'manager',
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
          minRole: 'admin',
        },
        {
          title: 'Fidélité',
          url: '/parametres/fidelite',
          minRole: 'admin',
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

// Masquage RBAC : on retire les sous-items et groupes dont le rôle minimum
// dépasse celui de l'utilisateur. Le 403 serveur (assertRole) reste la vraie
// barrière ; ceci n'est qu'un confort d'UI. Un groupe sans item visible (et
// sans page propre) est masqué entièrement.
const navMain = computed(() =>
  data.navMain
    .filter(group => canAccess((group as { minRole?: 'admin' | 'manager' | 'cashier' }).minRole ?? 'cashier'))
    .map(group => ({
      ...group,
      items: group.items?.filter(item =>
        canAccess((item as { minRole?: 'admin' | 'manager' | 'cashier' }).minRole ?? 'cashier')
      ),
    }))
    .filter(group => group.url !== '#' || (group.items?.length ?? 0) > 0)
)
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
      <NavMain :items="navMain" />
      <NavSecondary :items="data.navSecondary" class="mt-auto" />
    </SidebarContent>
    <SidebarFooter>
      <OnboardingChecklist />
      <NavUser :user="user" />
    </SidebarFooter>
  </Sidebar>
</template>
