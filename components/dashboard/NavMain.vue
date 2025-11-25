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
import { ChevronRight, type LucideIcon } from 'lucide-vue-next'

const props = defineProps<{
  items: {
    title: string
    url: string
    icon: LucideIcon
    isActive?: boolean
    items?: {
      title: string
      url: string
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
          <CollapsibleTrigger v-if="item.items?.length" as-child>
            <SidebarMenuButton :tooltip="item.title">
              <component :is="item.icon" />
              <span>{{ item.title }}</span>
              <ChevronRight
                class="ml-auto transition-transform duration-200"
                :class="{ 'rotate-90': openStates[item.title] }"
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <SidebarMenuButton v-else as-child :tooltip="item.title">
            <a :href="item.url">
              <component :is="item.icon" />
              <span>{{ item.title }}</span>
            </a>
          </SidebarMenuButton>
          <CollapsibleContent v-if="item.items?.length">
            <SidebarMenuSub>
              <SidebarMenuSubItem v-for="subItem in item.items" :key="subItem.title">
                <SidebarMenuSubButton as-child>
                  <a :href="subItem.url">
                    <span>{{ subItem.title }}</span>
                  </a>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    </SidebarMenu>
  </SidebarGroup>
</template>