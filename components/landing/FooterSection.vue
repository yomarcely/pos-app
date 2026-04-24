<template>
  <footer class="border-t bg-gray-50 py-12">
    <div class="container mx-auto px-4">
      <div class="grid gap-8 md:grid-cols-4">
        <div>
          <CommonFymposLogo variant="full" size="sm" show-text />
          <p class="mt-4 text-sm text-gray-500">
            Find your Motion — La caisse qui fait bouger votre commerce.
          </p>
        </div>

        <div>
          <h4 class="font-semibold text-gray-900">Produit</h4>
          <ul class="mt-4 space-y-2 text-sm text-gray-600">
            <li><NuxtLink to="/features" class="hover:text-emerald-700">Fonctionnalités</NuxtLink></li>
            <li><NuxtLink to="/pricing" class="hover:text-emerald-700">Tarifs</NuxtLink></li>
            <li><NuxtLink to="/demo" class="hover:text-emerald-700">Démo</NuxtLink></li>
          </ul>
        </div>

        <div>
          <h4 class="font-semibold text-gray-900">Support</h4>
          <ul class="mt-4 space-y-2 text-sm text-gray-600">
            <li><NuxtLink to="/docs" class="hover:text-emerald-700">Documentation</NuxtLink></li>
            <li><NuxtLink to="/contact" class="hover:text-emerald-700">Contact</NuxtLink></li>
            <li><a href="mailto:support@fympos.com" class="hover:text-emerald-700">support@fympos.com</a></li>
          </ul>
        </div>

        <div>
          <h4 class="font-semibold text-gray-900">Légal</h4>
          <ul class="mt-4 space-y-2 text-sm text-gray-600">
            <li><NuxtLink to="/legal/mentions" class="hover:text-emerald-700">Mentions légales</NuxtLink></li>
            <li><NuxtLink to="/legal/privacy" class="hover:text-emerald-700">Politique de confidentialité</NuxtLink></li>
            <li><NuxtLink to="/legal/cookies" class="hover:text-emerald-700">Gestion des cookies</NuxtLink></li>
          </ul>
        </div>
      </div>

      <div class="mt-12 border-t pt-8 text-center text-sm text-gray-500">
        <p>&copy; {{ new Date().getFullYear() }} FymPOS. Tous droits réservés.</p>
      </div>
    </div>
  </footer>
</template>