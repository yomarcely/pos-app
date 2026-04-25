<template>
  <section class="py-16 md:py-24">
    <div class="container mx-auto px-4">
      <!-- En-tête -->
      <div class="mb-12 text-center">
        <h2 class="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
          Tout ce dont vous avez besoin
        </h2>
        <p class="mt-4 text-lg text-gray-600">
          Une solution complète, simple et conforme
        </p>
      </div>

      <!-- Grille de fonctionnalités -->
      <div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <Card v-for="feature in features" :key="feature.title" class="border-gray-100 hover:shadow-lg transition-shadow duration-300">
          <CardHeader>
            <div class="mb-4 text-3xl">{{ feature.icon }}</div>
            <CardTitle class="text-xl">{{ feature.title }}</CardTitle>
            <CardDescription>
              {{ feature.description }}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const features = [
  {
    icon: '🧾',
    title: 'Caisse intuitive',
    description: 'Interface de vente rapide, recherche produits instantanée, gestion des variations.'
  },
  {
    icon: '📦',
    title: 'Stock multi-lieu',
    description: 'Mouvements, alertes stock bas, inventaires, synchronisation entre établissements.'
  },
  {
    icon: '👥',
    title: 'Clients & fidélité',
    description: 'Fiche client, historique d\'achats, remises automatiques, points de fidélité.'
  },
  {
    icon: '📊',
    title: 'Conformité NF525',
    description: 'Clôtures de caisse, journal des ventes inaltérable, piste d\'audit intégrée.'
  },
  {
    icon: '🔄',
    title: 'Multi-établissements',
    description: 'Une seule plateforme, plusieurs caisses, sync temps réel.'
  },
  {
    icon: '🔒',
    title: 'RGPD & Sécurité',
    description: 'Données chiffrées, anonymisation client, hébergement en France.'
  }
]
</script>