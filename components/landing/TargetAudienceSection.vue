<template>
  <section class="py-16 md:py-24">
    <div class="container mx-auto px-4">
      <div class="mb-12 text-center">
        <h2 class="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
          Pour qui ?
        </h2>
        <p class="mt-4 text-lg text-gray-600">
          FymPOS s'adapte à tous les commerces
        </p>
      </div>

      <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card v-for="audience in audiences" :key="audience.name" class="border-gray-100 text-center">
          <CardContent class="pt-6">
            <div class="mb-4 text-4xl">{{ audience.icon }}</div>
            <h3 class="font-semibold text-gray-900">{{ audience.name }}</h3>
            <p class="mt-2 text-sm text-gray-500">{{ audience.description }}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const audiences = [
  {
    icon: '🥖',
    name: 'Boulangeries / Pâtisseries',
    description: 'Gestion des variations (pains au chocolat, etc.) et vente rapide'
  },
  {
    icon: '🍽️',
    name: 'Restaurants / Bars',
    description: 'Service rapide, clôture de caisse simplifiée'
  },
  {
    icon: '👗',
    name: 'Boutiques / Retail',
    description: 'Catalogue produits, marques et fournisseurs'
  },
  {
    icon: '🏢',
    name: 'Multi-établissements',
    description: 'Centralisation des données, reporting consolidé'
  }
]
</script>