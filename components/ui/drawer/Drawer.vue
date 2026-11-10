<script lang="ts" setup>
import type { DrawerRootEmits, DrawerRootProps } from "vaul-vue"
import { useForwardPropsEmits } from "reka-ui"
import { DrawerRoot } from "vaul-vue"

const props = withDefaults(defineProps<DrawerRootProps>(), {
  shouldScaleBackground: true,
})

const emits = defineEmits<DrawerRootEmits>()

// `as DrawerRootProps` : annotation de type uniquement, sans effet à l'exécution.
// DrawerRootProps (vaul-vue) contient `fadeFromIndex?: never` ; combiné à withDefaults,
// vue-tsc infère `never` pour `props`, donc `forwarded` n'est plus un objet et le
// `v-bind="forwarded"` du template échoue en TS2698.
const forwarded = useForwardPropsEmits(props as DrawerRootProps, emits)
</script>

<template>
  <DrawerRoot
    v-slot="slotProps"
    data-slot="drawer"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </DrawerRoot>
</template>
