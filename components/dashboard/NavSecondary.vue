<script setup lang="ts">
import type { LucideIcon } from 'lucide-vue-next'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
const props = defineProps<{
  items: {
    title: string
    url: string
    icon: LucideIcon
    disabled?: boolean
  }[]
}>()
</script>
<template>
  <SidebarGroup>
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem v-for="item in items" :key="item.title">
          <SidebarMenuButton
            v-if="item.disabled"
            :disabled="true"
            size="sm"
            class="opacity-50 cursor-not-allowed"
          >
            <component :is="item.icon" />
            <span>{{ item.title }}</span>
          </SidebarMenuButton>
          <SidebarMenuButton v-else as-child size="sm">
            <a :href="item.url">
              <component :is="item.icon" />
              <span>{{ item.title }}</span>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>