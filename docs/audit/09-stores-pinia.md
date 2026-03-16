# Audit 09 — Stores Pinia

> Session d'analyse uniquement — aucune modification de code source.
> Date : 2026-03-16

---

## 0. Périmètre réel

**6 stores présents** (CLAUDE.md mentionnait 7 — `tickets.ts` n'existe pas) :

| Fichier | Lignes |
|---|---|
| `stores/auth.ts` | 204 |
| `stores/cart.ts` | 319 |
| `stores/products.ts` | 263 |
| `stores/customer.ts` | 77 |
| `stores/sellers.ts` | 94 |
| `stores/variationGroups.ts` | 25 |

> ⚠️ `stores/tickets.ts` mentionné dans CLAUDE.md → **n'existe pas**. La documentation est désynchronisée.

---

## 1. Inventaire par store

### 1.1 `auth.ts` (204 lignes)

| Catégorie | Détail |
|---|---|
| **State** | `user`, `session`, `tenantId`, `tenants`, `loading`, `error` |
| **Getters** | `isAuthenticated`, `accessToken` |
| **Actions** | `signUp`, `signIn`, `signOut`, `restoreSession`, `selectTenant`, `getAuthHeaders` |
| **Internes** | `setUserContext`, `extractTenants`, `requireSupabase` |
| **Dépendances** | `useSupabaseClient` (composable), `useSellersStore` (store), `useRuntimeConfig` (Nuxt) |
| **$fetch** | Aucun — appels via SDK Supabase |

### 1.2 `cart.ts` (319 lignes)

| Catégorie | Détail |
|---|---|
| **State** | `items`, `selectedProduct`, `globalDiscount`, `globalDiscountType`, `pendingCart` |
| **Getters** | `totalTTC`, `totalHT`, `totalTVA`, `itemCount`, `getFinalPrice` (wrapper de fonction) |
| **Actions** | `addToCart`, `removeFromCart`, `clearCart`, `updateQuantity`, `updateDiscount`, `updateGlobalDiscount`, `applyGlobalDiscountToItems`, `updateVariation`, `addPendingCart`, `recoverPendingCart`, `validateStock`, `checkDayClosure`, `submitSale` |
| **Dépendances** | `useCustomerStore`, `useProductsStore`, `cartUtils` (utils) |
| **$fetch** | `GET /api/sales/check-closure`, `POST /api/sales/create` |

### 1.3 `products.ts` (263 lignes)

| Catégorie | Détail |
|---|---|
| **State** | `products`, `loaded`, `loading`, `error`, `currentEstablishmentId` |
| **Getters** | `getById`, `outOfStockProducts`, `outOfStockAlerts`, `lowStockProducts` (DEPRECATED), `lowStockAlerts`, `totalStockValue` |
| **Actions** | `loadProducts`, `hasEnoughStock`, `getAvailableStock` |
| **Dépendances** | `useVariationGroupsStore`, `useEstablishmentRegister` (composable) |
| **$fetch** | `GET /api/products` |

### 1.4 `customer.ts` (77 lignes)

| Catégorie | Détail |
|---|---|
| **State** | `client` (sélectionné), `clients` (liste), `loaded`, `loading`, `error` |
| **Getters** | `clientName`, `isSelected` |
| **Actions** | `loadCustomers`, `selectClient`, `clearClient` |
| **Dépendances** | `useEstablishmentRegister` (composable) |
| **$fetch** | `GET /api/clients` |

### 1.5 `sellers.ts` (94 lignes)

| Catégorie | Détail |
|---|---|
| **State** | `sellers`, `selectedSeller`, `loaded`, `loading`, `error` |
| **Getters** | Aucun |
| **Actions** | `loadSellers`, `selectSellerById`, `initialize`, `clearSeller` |
| **Internes** | `hydrateSelectedSeller`, `ensureValidSelectedSeller` (exposées mais privées par nature) |
| **Dépendances** | Aucune (localStorage direct) |
| **$fetch** | `GET /api/sellers` |

### 1.6 `variationGroups.ts` (25 lignes)

| Catégorie | Détail |
|---|---|
| **State** | `groups`, `loaded` |
| **Getters** | Aucun |
| **Actions** | `loadGroups` |
| **Dépendances** | Aucune |
| **$fetch** | `GET /api/variations` |

---

## 2. Patterns dupliqués

### A) Pattern de chargement `loading / loaded / error / loadXxx()`

**Présent dans 4 stores** avec une structure quasi-identique :

```typescript
// products.ts, customer.ts, sellers.ts — structure identique
loading.value = true
error.value = null
try {
  const response = await $fetch(...)
  // assign state
  loaded.value = true
} catch (err) {
  error.value = err instanceof Error ? err.message : String(err)
} finally {
  loading.value = false
}
```

| Store | loading | loaded | error | loadXxx() |
|---|---|---|---|---|
| `products.ts` | ✅ | ✅ | ✅ | `loadProducts()` |
| `customer.ts` | ✅ | ✅ | ✅ | `loadCustomers()` |
| `sellers.ts` | ✅ | ✅ | ✅ | `loadSellers()` |
| `auth.ts` | ✅ | ❌ | ✅ (AuthError) | `signIn/signUp/signOut` |
| `variationGroups.ts` | ❌ | ✅ | ❌ | `loadGroups()` |

**Priorité : 🟠** — Duplication structurelle inévitable en l'absence d'un `useAsyncData` commun. Pas urgent mais extraction d'un utilitaire `createLoadable()` possible si les stores deviennent plus nombreux.

### B) Gestion d'erreur dupliquée

Pattern `err instanceof Error ? err.message : String(err)` présent dans **3 stores** (products, customer, sellers) mais **aucun n'utilise `extractFetchError`** qui existe pourtant dans le projet.

| Store | Gestion d'erreur |
|---|---|
| `products.ts` | `err instanceof Error ? err.message : String(err)` + `console.error` |
| `customer.ts` | idem |
| `sellers.ts` | idem (sans `console.error`) |
| `auth.ts` | Pattern différent : type `AuthError` avec `.message`, via `instanceof Error` |
| `variationGroups.ts` | `console.error` uniquement — pas d'`error` ref |

**Priorité : 🟠** — `extractFetchError` est utilisé dans les composables et pages mais pas dans les stores. Incohérence mineure.

### C) Endpoints $fetch dupliqués

**Aucun endpoint n'est appelé depuis plusieurs stores.** Chaque domaine a un store dédié. ✅

### D) Types dupliqués ou mal placés

| Type | Emplacement | Problème |
|---|---|---|
| `Tenant` | `auth.ts` lignes 7-11 | Type métier dans le store, pas dans `types/` |
| `AuthError` | `auth.ts` lignes 13-15 | Idem |
| `ProductsResponse` | `products.ts` ligne 8 (dans la fonction) | Type inline local, pas exporté |
| `ClientsResponse` | `customer.ts` ligne 24 (dans la fonction) | Idem |
| `Establishment`, `Register` | `useEstablishmentRegister.ts` lignes 4-16 | Dans le composable, pas dans `types/` |

**Priorité : 🟡** — Les types inline dans les fonctions sont acceptables pour les response shapes non réutilisés. `Tenant` et `AuthError` dans auth.ts pourraient aller dans `types/` mais c'est de l'ordre du cosmétique.

---

## 3. Responsabilités mal placées

### A) Logique qui devrait être dans un composable

**`cart.ts` — `checkDayClosure()` et `submitSale()`**

Ces deux méthodes ne modifient **aucun état du store** :

```typescript
async function checkDayClosure(registerId: number): Promise<boolean> {
  const result = await $fetch<{ isClosed: boolean }>('/api/sales/check-closure', {
    params: { registerId },
  })
  return result.isClosed  // ← retourne directement, n'affecte aucun state
}

async function submitSale(payload: SalePayload): Promise<SaleResponse> {
  return $fetch<SaleResponse>('/api/sales/create', {  // ← idem
    method: 'POST',
    body: payload,
  })
}
```

Ce sont des wrappers $fetch purs sans side effects sur le store. Ils pourraient être dans `useCartActions` ou dans `caisse/index.vue` directement.

**Priorité : 🟠**

---

**`sellers.ts` — `hydrateSelectedSeller()` et `ensureValidSelectedSeller()` exposées publiquement**

Ces deux méthodes sont des détails d'implémentation de `initialize()`. Elles ne devraient pas figurer dans le `return` du store — elles ne sont pas destinées à être appelées depuis l'extérieur.

**Priorité : 🟡**

---

**`auth.ts` — `getAuthHeaders()`**

Méthode qui construit des headers HTTP (`Authorization`, `x-tenant-id`). C'est de la logique d'infrastructure réseau dans un store métier. Elle est consommée par `plugins/01.api-fetch.client.ts`. Acceptable dans ce contexte puisque le plugin doit accéder à l'état auth.

**Priorité : 🟡** — Acceptable comme pont entre le store et le plugin.

### B) Logique qui devrait être côté serveur

**`cart.ts` — `applyGlobalDiscountToItems()`**

Ce calcul de répartition proportionnelle de remise en euros est exécuté côté client. Le serveur dans `create.post.ts` recompute de son côté les totaux (P1 corrigé en session 2026-03-15). La logique de répartition proportionnelle n'est donc pas recalculée côté serveur — le serveur reçoit les lignes déjà transformées. Ce couplage implicite (client transforme, serveur fait confiance) est à surveiller.

**Priorité : 🟠** — Pas de bug connu, mais logique distribuée entre client et serveur sans validation croisée de la répartition.

---

**`cart.ts` — `validateStock()`**

Validation du stock côté client via `useProductsStore`. Cette validation est par nature non fiable (race condition entre le chargement des produits et la validation). Elle duplique une validation qui devrait être autoritaire côté serveur. Elle est utile comme UX préventif mais ne doit pas être considérée comme une garantie.

**Priorité : 🟡** — UX guard acceptable, tant que le serveur reste la source de vérité.

### C) State potentiellement zombie

**`products.ts` — `lowStockProducts` (getter DEPRECATED)**

Le getter est marqué `@deprecated` mais reste exposé dans le `return` du store. Il redirige vers `lowStockAlerts.value.map(alert => alert.product)` donc pas de duplication de calcul, mais il pollue l'API publique du store.

**Priorité : 🟡** — Rechercher les usages et supprimer si absent.

**`sellers.ts` — `hydrateSelectedSeller` et `ensureValidSelectedSeller`**

Exposées dans le return alors qu'elles sont internes à `initialize()`. Aucune page/composant ne devrait les appeler directement. Si aucun usage externe n'existe, elles devraient être retirées du return.

**Priorité : 🟡**

### D) Stores qui pourraient être fusionnés

**`variationGroups.ts` → fusionnable avec `products.ts`**

Arguments pour la fusion :
- `variationGroups.ts` fait 25 lignes — le store le plus minimal du projet
- `products.ts` dépend déjà de `useVariationGroupsStore` dans deux computed (`outOfStockAlerts`, `lowStockAlerts`)
- La dépendance est strictement unidirectionnelle : `products → variationGroups`
- Les groupes de variations sont chargés uniquement pour résoudre les noms de variations dans les alertes stock
- Aucun autre store ne dépend de `variationGroups`

Arguments contre :
- Les variations sont utilisées dans d'autres pages (gestion des variations, édition produit) — un store dédié reste accessible
- La séparation des responsabilités est légitime (variations ≠ produits)

**Verdict : 🟡** — Fusion possible mais non urgente. Le coût de la séparation est faible (25 lignes).

---

## 4. Déviations de conventions

| # | Store | Déviation | Sévérité |
|---|---|---|---|
| 1 | `variationGroups.ts` | Pas d'état `loading` — l'UI ne peut pas afficher un loader pendant le chargement | 🟠 |
| 2 | `variationGroups.ts` | Pas d'état `error` — les erreurs réseau sont silencieuses (console.error uniquement) | 🟠 |
| 3 | Tous les stores | N'utilisent pas `extractFetchError` — pattern inline dupliqué dans 3 stores | 🟠 |
| 4 | `cart.ts` ligne 121 | `as any` — violation du strict TypeScript (`items.value.push({...} as any)`) | 🔴 |
| 5 | `sellers.ts` | `hydrateSelectedSeller` et `ensureValidSelectedSeller` exposées dans le return alors qu'elles sont privées par nature | 🟡 |
| 6 | `products.ts` | `lowStockProducts` DEPRECATED encore exposé dans le return | 🟡 |
| 7 | `auth.ts` | Types `Tenant` et `AuthError` définis dans le fichier store plutôt que dans `types/` | 🟡 |
| 8 | CLAUDE.md | Référence `stores/tickets.ts` qui n'existe pas | 🟡 |

---

## 5. Carte des dépendances

```
auth.ts
  └──▶ sellers.ts (clearSeller au signOut)

cart.ts
  ├──▶ customer.ts (clearClient, selectClient, clients)
  └──▶ products.ts (hasEnoughStock, getAvailableStock)

products.ts
  └──▶ variationGroups.ts (noms de variations dans outOfStockAlerts / lowStockAlerts)

customer.ts     ──▶ (aucun store)
sellers.ts      ──▶ (aucun store)
variationGroups ──▶ (aucun store)
```

**Aucune dépendance circulaire.** Hiérarchie propre en DAG :

```
variationGroups ◀── products ◀── cart ──▶ customer
                              auth ──▶ sellers
```

Note : `cart.ts` ne dépend pas de `auth.ts` — les headers d'authentification sont injectés globalement par `plugins/01.api-fetch.client.ts` via `getAuthHeaders()`.

---

## 6. Recommandations priorisées

### 🔴 Urgent

**R1 — Corriger le `as any` dans `cart.ts` ligne 121**
```typescript
// Actuel
items.value.push({
  ...product,
  quantity: 1,
  discount: 0,
  discountType: '%',
  variation,
  restockOnReturn: false,
  _uniqueId: Date.now() + Math.random(),
} as any)
```
Le `as any` masque probablement un conflit de type entre `Product` et `ProductInCart`. Résoudre en typant correctement le push ou en créant une fonction utilitaire `toCartItem(product: Product, variation: string): ProductInCart`.

---

### 🟠 À corriger (impact maintenabilité)

**R2 — Utiliser `extractFetchError` dans les stores**

Les 3 stores (products, customer, sellers) utilisent le même pattern inline. Aligner sur `extractFetchError` pour cohérence avec les composables et pages.

**R3 — Ajouter `loading` et `error` dans `variationGroups.ts`**

Le store le plus utilisé implicitement (via products) est le seul sans gestion d'erreur visible. En cas de panne de l'endpoint `/api/variations`, les noms de variations dans les alertes stock afficheront silencieusement `Variation {id}`.

**R4 — Retirer `checkDayClosure` et `submitSale` de `cart.ts`**

Ces méthodes sans side-effects sur le store polluent son API. Les déplacer dans un composable `useCartSaleActions` appelé depuis `caisse/index.vue`. Cela allègera `cart.ts` et clarifiera la frontière état/actions réseau.

---

### 🟡 Acceptable / Dette mineure

**R5 — Retirer `hydrateSelectedSeller` et `ensureValidSelectedSeller` du return de `sellers.ts`**

Ces méthodes internes ne devraient pas faire partie de l'API publique du store.

**R6 — Supprimer `lowStockProducts` (DEPRECATED) de `products.ts`**

Vérifier les usages (`grep -r "lowStockProducts"`) et supprimer si aucun usage externe.

**R7 — Mettre à jour CLAUDE.md**

Supprimer la référence à `stores/tickets.ts` qui n'existe pas.

**R8 — Déplacer `Tenant` et `AuthError` dans `types/`**

Types métier dans le fichier store — cosmétique mais cohérence avec la convention du projet.

---

## Synthèse

| Catégorie | Nb items | Priorité max |
|---|---|---|
| Violations conventions | 4 | 🔴 (`as any`) |
| Responsabilités mal placées | 3 | 🟠 |
| Patterns dupliqués | 2 | 🟠 |
| Types mal placés | 4 | 🟡 |
| État zombie / API publique polluée | 3 | 🟡 |
| Documentation désynchronisée | 1 | 🟡 |

**Bonne nouvelle** : aucune dépendance circulaire, architecture DAG propre, séparation des domaines respectée. Les 6 stores sont cohérents dans leurs responsabilités. Le volume de dette est faible pour un projet de 46 000 lignes.

---

## 7. R4 — Analyse déplacement checkDayClosure/submitSale

> Session 2026-03-16 — Analyse uniquement.

### Usages trouvés

```
grep -r "checkDayClosure|submitSale" --include="*.ts" --include="*.vue"
```

| Fichier | Type | Détail |
|---|---|---|
| `stores/cart.ts:277` | Définition | `async function checkDayClosure(registerId): Promise<boolean>` |
| `stores/cart.ts:284` | Définition | `async function submitSale(payload): Promise<SaleResponse>` |
| `components/caisse/ColRight.vue:51` | Appel | `cartStore.checkDayClosure(selectedRegisterId.value)` |
| `components/caisse/ColRight.vue:224` | Appel | `cartStore.submitSale(saleData)` |
| `tests/components/cart/ColRight.test.ts:26` | Mock | `checkDayClosure: vi.fn().mockResolvedValue(false)` |
| `tests/components/cart/ColRight.test.ts:142` | Test | `checkDayClosure.mockResolvedValue(true)` |

**Résumé** : les deux fonctions sont appelées **uniquement depuis `ColRight.vue`** et mockées dans `ColRight.test.ts` via le mock du `cartStore`.

### Risque du déplacement

| Facteur | Détail |
|---|---|
| **Impact composant** | `ColRight.vue` doit importer un nouveau composable à la place du store |
| **Impact tests** | `ColRight.test.ts` moquerait le composable au lieu du store (changement de mock strategy) |
| **Régression possible** | Faible — les deux fonctions sont des wrappers $fetch purs sans side-effects |
| **Complexité** | Faible — déplacement mécanique de 2 fonctions |

### Recommandation

**Reporter** — pas urgent. Ces fonctions fonctionnent correctement dans le store. Le déplacement vers un composable `useCartSaleActions` serait propre architecturalement mais nécessiterait la mise à jour simultanée de `ColRight.vue` et de ses tests. À envisager lors d'un refactor de `caisse/` (composant 170 lignes avec logique mixte).

**Statut : 📋 En attente de validation — reporter jusqu'au refactor caisse/**

---

## 8. Statut des corrections (2026-03-16)

| Item | Statut | Commit |
|---|---|---|
| R1 — `as any` dans cart.ts | ✅ Corrigé | `fix(cart): replace as any with typed toCartItem helper` |
| R2 — extractFetchError dans les stores | ✅ Corrigé | `refactor(stores): use extractFetchError consistently` |
| R3 — loading/error dans variationGroups | ✅ Corrigé | `feat(variationGroups): add loading and error state` |
| R4 — checkDayClosure/submitSale | 📋 Analysé — reporter jusqu'au refactor caisse/ | (voir section 7) |
| R5 — méthodes internes sellers hors return | ✅ Déjà correct — non exposées dans le return | (aucun changement) |
| R6 — lowStockProducts DEPRECATED | ✅ Supprimé | `refactor(products): remove deprecated lowStockProducts getter` |
| R7 — CLAUDE.md tickets.ts + composables | ✅ Corrigé | `docs: update CLAUDE.md - remove tickets.ts, update top-10, mark stores audit complete` |
| R8 — Tenant/AuthError dans types/ | ✅ Corrigé | `refactor(auth): move Tenant and AuthError types to types/auth.ts` |
