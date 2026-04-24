<template>
  <section class="bg-emerald-700 py-16 md:py-24">
    <div class="container mx-auto px-4 text-center">
      <h2 class="text-3xl font-bold text-white md:text-4xl">
        Prêt à faire bouger votre commerce ?
      </h2>
      <p class="mt-4 text-lg text-emerald-100">
        Essayez FymPOS gratuitement pendant 14 jours, sans carte bancaire.
      </p>
      <div class="mt-8">
        <Button size="lg" variant="secondary" class="bg-white text-emerald-700 hover:bg-gray-100" as-child>
          <NuxtLink to="/signup">
            Commencer l'essai gratuit
            <span class="ml-2">→</span>
          </NuxtLink>
        </Button>
      </div>
    </div>
  </section>
</template>