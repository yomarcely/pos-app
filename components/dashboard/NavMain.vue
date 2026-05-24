<script setup lang="ts">
import { ref } from 'vue'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { useSidebar } from '@/components/ui/sidebar/utils'
import { ChevronRight, type LucideIcon } from 'lucide-vue-next'

const { state } = useSidebar()

const props = defineProps<{
  items: {
    title: string
    url: string
    icon: LucideIcon
    isActive?: boolean
    badge?: string | number | null
    items?: {
      title: string
      url: string
      disabled?: boolean
      badge?: string | number | null
    }[]
  }[]
}>()

// Créer un ref pour suivre l'état ouvert/fermé de chaque menu
const openStates = ref<Record<string, boolean>>(
  props.items.reduce((acc, item) => {
    acc[item.title] = item.isActive || false
    return acc
  }, {} as Record<string, boolean>)
)

// En mode sidebar collapsed, un clic sur l'icône doit naviguer vers le premier
// sous-item navigable (non disabled et avec une vraie URL), au lieu de seulement
// toggler le sous-menu (invisible en mode icon).
function firstNavigableSubItem(item: { items?: { url: string; disabled?: boolean }[] }) {
  return item.items?.find(sub => !sub.disabled && sub.url && sub.url !== '#')
}
</script>
<template>
  <SidebarGroup>
    <SidebarGroupLabel>Platform</SidebarGroupLabel>
    <SidebarMenu>
      <Collapsible
        v-for="item in items"
        :key="item.title"
        v-model:open="openStates[item.title]"
        class="group/collapsible"
      >
        <SidebarMenuItem>
          <!-- Mode collapsed + sous-items navigables : lien direct vers le premier -->
          <SidebarMenuButton
            v-if="state === 'collapsed' && firstNavigableSubItem(item)"
            :tooltip="item.title"
            as-child
          >
            <NuxtLink :to="firstNavigableSubItem(item)!.url">
              <component :is="item.icon" />
              <span>{{ item.title }}</span>
            </NuxtLink>
          </SidebarMenuButton>

          <!-- Mode expanded + sous-items : trigger qui ouvre le sous-menu -->
          <CollapsibleTrigger v-else-if="item.items?.length" as-child>
            <SidebarMenuButton :tooltip="item.title">
              <component :is="item.icon" />
              <span>{{ item.title }}</span>
              <span
                v-if="item.badge"
                class="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 text-[10px] font-semibold text-white"
              >
                {{ item.badge }}
              </span>
              <ChevronRight
                class="transition-transform duration-200"
                :class="[item.badge ? 'ml-1' : 'ml-auto', { 'rotate-90': openStates[item.title] }]"
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>

          <!-- Pas de sous-items : lien direct vers item.url -->
          <SidebarMenuButton v-else as-child :tooltip="item.title">
            <NuxtLink :to="item.url">
              <component :is="item.icon" />
              <span>{{ item.title }}</span>
            </NuxtLink>
          </SidebarMenuButton>
          <CollapsibleContent v-if="item.items?.length">
            <SidebarMenuSub>
              <SidebarMenuSubItem v-for="subItem in item.items" :key="subItem.title">
                <SidebarMenuSubButton
                  v-if="subItem.disabled"
                  :disabled="true"
                  class="opacity-50 cursor-not-allowed"
                >
                  <span>{{ subItem.title }}</span>
                </SidebarMenuSubButton>
                <SidebarMenuSubButton v-else as-child>
                  <NuxtLink :to="subItem.url">
                    <span>{{ subItem.title }}</span>
                  </NuxtLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    </SidebarMenu>
  </SidebarGroup>
</template>
