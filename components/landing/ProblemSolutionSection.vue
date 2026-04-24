<template>
  <section class="bg-gray-50 py-16 md:py-24">
    <div class="container mx-auto px-4">
      <div class="grid gap-12 md:grid-cols-2 md:gap-16">
        <!-- Problème -->
        <div>
          <div class="mb-4 inline-flex rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
            Le problème
          </div>
          <h3 class="text-2xl font-bold text-gray-900 md:text-3xl">
            Des logiciels de caisse complexes, chers et qui ne se parlent pas
          </h3>
          <ul class="mt-6 space-y-3 text-gray-600">
            <li class="flex gap-2">
              <span class="text-red-500">✗</span> Interface datée et peu intuitive
            </li>
            <li class="flex gap-2">
              <span class="text-red-500">✗</span> Multi-établissements = multi-abonnements
            </li>
            <li class="flex gap-2">
              <span class="text-red-500">✗</span> Conformité NF525 mal gérée
            </li>
            <li class="flex gap-2">
              <span class="text-red-500">✗</span> Aucune synchro entre les caisses
            </li>
          </ul>
        </div>

        <!-- Solution -->
        <div>
          <div class="mb-4 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
            La solution
          </div>
          <h3 class="text-2xl font-bold text-gray-900 md:text-3xl">
            FymPOS réunit tout dans une interface moderne
          </h3>
          <ul class="mt-6 space-y-3 text-gray-600">
            <li class="flex gap-2">
              <span class="text-emerald-600">✓</span> Interface pensée pour la vitesse en caisse
            </li>
            <li class="flex gap-2">
              <span class="text-emerald-600">✓</span> Un abonnement, tous vos établissements
            </li>
            <li class="flex gap-2">
              <span class="text-emerald-600">✓</span> Conformité NF525 intégrée et automatisée
            </li>
            <li class="flex gap-2">
              <span class="text-emerald-600">✓</span> Synchronisation temps réel
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>