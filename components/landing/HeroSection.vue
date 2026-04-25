<template>
  <section class="relative overflow-hidden bg-gradient-to-b from-white to-gray-50 py-16 md:py-24 lg:py-32">
    <!-- Décorations de fond subtle -->
    <svg class="pointer-events-none absolute right-0 top-0 -z-10 hidden w-1/2 opacity-20 md:block" viewBox="0 0 600 600" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="g1" x1="0" x2="1">
          <stop offset="0" stop-color="#34D399" stop-opacity="0.15"/>
          <stop offset="1" stop-color="#06B6D4" stop-opacity="0.05"/>
        </linearGradient>
      </defs>
      <circle cx="420" cy="80" r="220" fill="url(#g1)" />
    </svg>

    <div class="container mx-auto px-4 flex flex-col items-center text-center">
      <!-- Logo + slogan -->
      <div class="mb-8">
        <div class="flex justify-center">
          <CommonFymposLogo variant="full" size="lg" show-text />
        </div>
        <p class="mt-3 text-xl font-medium text-amber-600">
          Find your Motion
        </p>
      </div>

      <!-- Titre -->
      <h1 class="max-w-4xl text-4xl font-bold tracking-tight text-gray-900 md:text-6xl lg:text-7xl">
        La caisse qui fait bouger
        <span class="text-emerald-700">votre commerce</span>
      </h1>

      <!-- Sous-titre -->
      <p class="mt-6 max-w-2xl text-lg text-gray-600 md:text-xl">
        Conforme NF525, multi-établissements, simple et puissante.
        Gérez vos ventes, stocks et clients en un seul outil.
      </p>

      <!-- CTA -->
      <div class="mt-8 flex flex-col gap-4 sm:flex-row items-center">
        <Button size="lg" class="bg-emerald-700 hover:bg-emerald-800 text-white" as-child>
          <NuxtLink to="/signup">
            Commencer l'essai gratuit
            <span class="ml-2">→</span>
          </NuxtLink>
        </Button>
        <Button size="lg" variant="outline" as-child class="border-gray-200">
          <NuxtLink to="/demo">Voir la démo</NuxtLink>
        </Button>
      </div>

      <!-- Badges de confiance -->
      <div class="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
        <span class="flex items-center gap-1">
          <span class="text-emerald-600">✓</span> Conforme NF525
        </span>
        <span class="flex items-center gap-1">
          <span class="text-emerald-600">✓</span> RGPD
        </span>
        <span class="flex items-center gap-1">
          <span class="text-emerald-600">✓</span> Multi-établissements
        </span>
        <span class="flex items-center gap-1">
          <span class="text-emerald-600">✓</span> Support France
        </span>
      </div>

      <!-- Mockup placeholder (amélioré) -->
      <div class="mt-16 w-full max-w-5xl">
        <div class="aspect-video rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center shadow-2xl ring-1 ring-gray-200 transform transition-transform duration-500 hover:-translate-y-2">
          <div class="text-center text-gray-400">
            <div class="text-4xl mb-2">🎬</div>
            <div class="opacity-90">Mockup de l'interface caisse</div>
            <div class="mt-3 text-sm text-gray-400">(aperçu interactif — cliquez sur "Voir la démo")</div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// Pas d'imports spécifiques, Button est auto-importé par shadcn-nuxt
</script>