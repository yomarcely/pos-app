<template>
  <div class="min-h-screen bg-white">
    <!-- Header avec composants shadcn -->
    <header class="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
      <div class="container mx-auto flex h-16 items-center justify-between px-4">
        <CommonFymposLogo variant="full" size="sm" show-text />
        <div class="flex items-center gap-4">
          <Button variant="ghost" as-child>
            <NuxtLink to="/login">Connexion</NuxtLink>
          </Button>
          <Button as-child class="bg-emerald-700 hover:bg-emerald-800">
            <NuxtLink to="/signup">Essai gratuit</NuxtLink>
          </Button>
        </div>
      </div>
    </header>

    <main>
      <LandingHeroSection />
      <LandingProblemSolutionSection />
      <LandingFeaturesSection />
      <LandingTargetAudienceSection />
      <LandingTestimonialsSection />
      <LandingCTASection />
    </main>

    <LandingFooterSection />
  </div>
</template>

<script setup lang="ts">
useHead({
  title: 'FymPOS — Find your Motion | La caisse nouvelle génération',
  meta: [
    {
      name: 'description',
      content: 'Logiciel de caisse moderne, conforme NF525, multi-établissements. Gérez vos ventes, stocks et clients en un seul outil.'
    }
  ]
})
</script>