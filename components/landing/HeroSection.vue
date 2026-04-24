<template>
  <section class="relative overflow-hidden bg-gradient-to-b from-white to-gray-50 py-16 md:py-24 lg:py-32">
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
      <div class="mt-8 flex flex-col gap-4 sm:flex-row">
        <Button size="lg" class="bg-emerald-700 hover:bg-emerald-800 text-white" as-child>
          <NuxtLink to="/signup">
            Commencer l'essai gratuit
            <span class="ml-2">→</span>
          </NuxtLink>
        </Button>
        <Button size="lg" variant="outline">
          Voir la démo
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

      <!-- Mockup placeholder -->
      <div class="mt-16 w-full max-w-5xl">
        <div class="aspect-video rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center shadow-2xl ring-1 ring-gray-200">
          <span class="text-gray-400">🎬 Mockup de l'interface caisse</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// Pas d'imports spécifiques, Button est auto-importé par shadcn-nuxt
</script>