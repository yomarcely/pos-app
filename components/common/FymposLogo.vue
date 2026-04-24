<template>
  <div :class="containerClass">
    <img 
      :src="logoSrc"
      :class="imageClass"
    />
    <span v-if="showText" :class="textClass">FymPOS</span>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: 'full' | 'icon' | 'white' | 'black'
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}>(), {
  variant: 'full',
  size: 'md',
  showText: true
})

const sizeMap = {
  sm: { container: 'h-6 gap-1', text: 'text-sm', image: 'h-4' },
  md: { container: 'h-8 gap-2', text: 'text-lg', image: 'h-6' },
  lg: { container: 'h-12 gap-3', text: 'text-2xl', image: 'h-8' }
}

const containerClass = computed(() => 
  `flex items-center ${sizeMap[props.size].container}`
)

const textClass = computed(() => 
  `font-semibold tracking-tight text-gray-900 ${sizeMap[props.size].text}`
)

const imageClass = computed(() => 
  `${sizeMap[props.size].image} object-contain`
)

// Placeholder SVG — à remplacer par le vrai logo
const logoSrc = computed(() => {
  const map = {
    full: '/assets/logos/fympos-logo-full.svg',
    icon: '/assets/logos/fympos-icon.svg',
    white: '/assets/logos/fympos-logo-white.svg',
    black: '/assets/logos/fympos-logo-black.svg'
  }
  return map[props.variant]
})
</script>