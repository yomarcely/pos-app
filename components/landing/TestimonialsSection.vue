<template>
  <section class="bg-gray-50 py-16 md:py-24">
    <div class="container mx-auto px-4">
      <div class="mb-12 text-center">
        <h2 class="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
          Ils font confiance a FymPOS
        </h2>
        <p class="mt-4 text-lg text-gray-600">
          Des commercants qui gagnent du temps tous les jours.
        </p>
      </div>

      <div class="grid gap-6 md:grid-cols-3">
        <Card
          v-for="testimonial in testimonials"
          :key="testimonial.name"
          class="border-gray-100 hover:shadow-lg transition-shadow duration-300"
        >
          <CardHeader>
            <div class="flex items-center justify-between">
              <div>
                <CardTitle class="text-base">{{ testimonial.name }}</CardTitle>
                <CardDescription>{{ testimonial.business }}</CardDescription>
              </div>
              <div class="text-amber-400 text-sm">★★★★★</div>
            </div>
          </CardHeader>
          <CardContent>
            <p class="text-sm leading-relaxed text-gray-600 italic">
              “{{ testimonial.quote }}”
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const testimonials = [
  {
    name: 'Sophie L.',
    business: 'Boulangerie a Nantes',
    quote: 'On a reduit le temps de passage en caisse et la cloture est enfin simple.'
  },
  {
    name: 'Karim M.',
    business: 'Restaurant a Lyon',
    quote: 'La gestion multi-etablissements nous fait gagner un temps enorme.'
  },
  {
    name: 'Camille R.',
    business: 'Boutique a Paris',
    quote: 'Interface claire, equipe autonome en 1 jour, et support tres reactif.'
  }
]
</script>
