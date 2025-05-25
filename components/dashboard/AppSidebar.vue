<script setup lang="ts">
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
  Frame,
  LifeBuoy,
  Map,
  PieChart,
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
const data = {
  user: {
    name: 'Yohan Marcel',
    email: 'yohanmarcel@gmail.com',
    avatar: '/avatars/shadcn.jpg',
  },
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
          title: 'Historique',
          url: '#',
        },
        {
          title: 'Synthèse journée',
          url: '#',
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
          url: '#',
        },
        {
          title: 'Catégories',
          url: '#',
        },
        {
          title: 'Variations',
          url: '#',
        },
        {
          title: 'Promotions',
          url: '#',
        },
        {
          title: 'Imprimer étiquette',
          url: '#',
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
          url: '#',
        },
        {
          title: 'Mailing / SMS',
          url: '#',
        },
        {
          title: 'Fusion',
          url: '#',
        },
      ],
    },
    {
      title: 'Mouvements de stock',
      url: '#',
      icon: MoveRight,
      items: [
        {
          title: 'Mouvements libre',
          url: '#',
        },
        {
          title: 'Ajustements',
          url: '#',
        },
        {
          title: 'Commandes fournisseurs',
          url: '#',
        },
        {
          title: 'Réceptions fournisseurs',
          url: '#',
        },
        {
          title: 'Inventaire',
          url: '#',
        },
        {
          title: 'État des stocks',
          url: '#',
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
        },
        {
          title: 'Catalogue',
          url: '#',
        },
        {
          title: 'Vendeur',
          url: '#',
        },
        {
          title: 'Analyse',
          url: '#',
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
          title: 'Team',
          url: '#',
        },
        {
          title: 'Billing',
          url: '#',
        },
        {
          title: 'Limits',
          url: '#',
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: 'Aide',
      url: '#',
      icon: LifeBuoy,
    },
    {
      title: 'Feedback',
      url: '#',
      icon: Send,
    },
  ],
  projects: [
    {
      name: 'Design Engineering',
      url: '#',
      icon: Frame,
    },
    {
      name: 'Sales & Marketing',
      url: '#',
      icon: PieChart,
    },
    {
      name: 'Travel',
      url: '#',
      icon: Map,
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
            <a href="/dashboard">
              <div
                class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Command class="size-4" />
              </div>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-semibold">Acme Inc</span>
                <span class="truncate text-xs">Enterprise</span>
              </div>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <NavMain :items="data.navMain" />
      <NavSecondary :items="data.navSecondary" class="mt-auto" />
    </SidebarContent>
    <SidebarFooter>
      <NavUser :user="data.user" />
    </SidebarFooter>
  </Sidebar>
</template>