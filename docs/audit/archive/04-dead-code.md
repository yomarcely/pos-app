# Audit #04 — Code mort et duplications

> Date : 2026-03-12 (mis à jour 2026-03-15)
> Auteur : Claude Code
> Statut : ✅ Audit complet — S1–S5 supprimés, F1 déjà fait, F2 exécuté, G1/G2/G3 branchés, G4 supprimé

---

## 1. Fonctions exportées jamais appelées

### ❌ MORT — `createRequestLogger` et `createModuleLogger`

**Fichier :** `server/utils/logger.ts:57-70`

```typescript
export function createRequestLogger(path: string, method: string) { ... }  // ligne 57
export function createModuleLogger(module: string) { ... }                   // ligne 64
```

Ces deux fonctions sont définies et exportées, mais **aucune importation n'existe dans tout le projet**. Le logger `logger` (export par défaut du même fichier) est utilisé partout via `import { logger } from '~/server/utils/logger'` — les factory functions ont été écrites mais jamais adoptées.

**Recommandation : supprimer** — aucun usage, aucun test.

---

### ❌ MORT — `getMovementWithDetails`

**Fichier :** `server/utils/createMovement.ts:51`

```typescript
export async function getMovementWithDetails(movementId: number) { ... }
```

Définie et exportée, mais **jamais importée** nulle part dans `server/api/`, `server/utils/`, `pages/`, `stores/` ou `tests/`. La fonction `createMovement` du même fichier est bien utilisée, mais pas celle-ci.

**Recommandation : supprimer** — dead export, 0 usage confirmé.

---

### ❌ MORT — `prepareTicketForArchive`

**Fichier :** `server/utils/nf525.ts:184`

```typescript
export function prepareTicketForArchive(ticket: ...) { ... }
```

Définie et exportée, mais **jamais importée** dans aucun fichier. Le module d'archivage (`server/api/archives/create.post.ts`) importe `generateArchiveHash` (utilisé), mais ignore `prepareTicketForArchive`.

**Recommandation : supprimer avec précaution** — vérifier si une feature d'archivage est prévue. Si le format d'archive est stable, cette fonction devrait être utilisée dans `archives/create.post.ts`. Sinon : supprimer.

---

### ❌ MORT — `logSystemError`

**Fichier :** `server/utils/audit.ts:247`

```typescript
export async function logSystemError(params: { ... }) { ... }
```

Définie et exportée, mais **jamais appelée** dans aucun endpoint ni utilitaire. Les 4 autres fonctions du même fichier (`logSaleCreation`, `logSaleCancellation`, `logClosure`, `logChainVerification`) sont toutes utilisées.

**Recommandation : garder ou supprimer selon intention** — la fonction a du sens (logging d'erreurs système dans la piste d'audit NF525), mais elle n'est pas branchée. Si le monitoring des erreurs critiques est prévu, l'appeler dans les `catch` des endpoints critiques. Sinon : supprimer.

---

## 2. Composants Vue jamais utilisés

### ✅ Aucun composant custom mort confirmé

Tous les composants non-ShadCN (`components/` hors `ui/`) sont référencés dans au moins une page ou un autre composant. Nuxt 4 auto-importe les composants, ce qui rend la détection exhaustive uniquement via recherche de nom de balise.

Deux composants méritent surveillance :

| Composant | Fichier | Usages | Note |
|---|---|---|---|
| `CategoryTreeItem` | `components/categories/CategoryTreeItem.vue` | 1 (récursif uniquement) | Utilisé seulement par lui-même → vérifier s'il est monté quelque part |
| `SaleTicketItem` | `components/synthese/SaleTicketItem.vue` | 2 | Utilisé dans `DailySummaryStats` + tests — à garder |

---

## 3. Stores Pinia : état et actions jamais utilisés en production

### ❌ MORT — `stores/tickets.ts` — store entier sans consommateur

**Fichier :** `stores/tickets.ts`

```typescript
export const useTicketsStore = defineStore('tickets', {
  state: () => ({ tickets: [], nextId: 1 }),
  getters: { ticketCount: state => state.tickets.length },
  actions: { addTicket(), removeTicket(), resumeTicket() }
})
```

`useTicketsStore` n'est **importé dans aucun composant, aucune page, ni aucun autre store** du projet. Il n'existe que dans les tests (`tests/stores/ticketsStore.test.ts`).

> ⚠️ Note : `ticketCount` **dans le schéma DB** (`server/database/schema.ts:611`) est bien utilisé — c'est un champ de la table `closures`, sans lien avec ce store frontend.

**Le store semble être un vestige d'une feature de "paniers suspendus"** qui a ensuite migré vers `stores/cart.ts` avec le concept de `pendingCart`. Les deux couvrent le même besoin.

**Recommandation : supprimer** — après vérification que `pendingCart` dans `cart.ts` couvre bien tous les cas d'usage envisagés.

---

### ❌ MORT — `stockHistory` dans `stores/products.ts`

**Fichier :** `stores/products.ts:17`

```typescript
const stockHistory = ref<StockMovement[]>([])
// ... alimenté en interne par updateStock(), addStock(), setStock()
// Exporté ligne 434 : return { ..., stockHistory }
```

Le store alimente `stockHistory` en interne et l'exporte, mais **aucune page ou composant ne le lit depuis le store**. La page `pages/produits/[id]/edit.vue` a sa **propre variable locale** `stockHistory` (ligne 482) remplie via `$fetch('/api/products/:id/stock-history')` — elle n'utilise pas celle du store.

Conséquence : `updateStock()`, `addStock()`, `setStock()` poussent dans un tableau que personne ne lit.

**Recommandation : supprimer `stockHistory` du store** — le tracking d'historique se fait via l'API, pas via l'état client. Si un besoin temps-réel existe, utiliser le store proprement en connectant la page.

---

### ❌ MORT (production) — `validateStock` dans `stores/cart.ts`

**Fichier :** `stores/cart.ts:253`

```typescript
function validateStock(): { valid: boolean; errors: string[] } { ... }
```

Définie et exportée dans le store, **jamais appelée depuis un composant ou une page**. Elle n'existe que dans `tests/cartStore.test.ts:61`. La vérification de stock avant achat se fait côté serveur dans `sales/create.post.ts`, pas côté client via cette fonction.

**Recommandation : garder** — la validation côté client est une bonne pratique défensive (UX), même si la validation serveur est la source de vérité. Mais il faudra **l'appeler** avant la soumission de vente dans `ColRight.vue` pour qu'elle serve à quelque chose.

---

### ⚠️ INEXPLOITÉ — `clearSeller` dans `stores/sellers.ts`

**Fichier :** `stores/sellers.ts:69`

```typescript
function clearSeller() { ... }  // exportée ligne 91
```

Jamais appelée en dehors des tests (`tests/stores/sellersStore.test.ts:45`). Aucun composant ni page ne l'invoque. La déconnexion du vendeur n'est pas gérée côté UI.

**Recommandation : garder** — la fonction est utile et cohérente avec le domaine. Elle devrait être appelée lors du `signOut` ou de la fermeture de caisse. C'est une lacune fonctionnelle, pas du code mort à supprimer.

---

## 4. Logique dupliquée

### ❌ DUPLICATION EXACTE — `normalizeProduct`

**Lieu 1 :** `utils/productHelpers.ts:46`
**Lieu 2 :** `pages/mouvements/index.vue:113`

La fonction est copiée **octet pour octet** dans `pages/mouvements/index.vue`. La page ne fait pas `import { normalizeProduct } from '@/utils/productHelpers'` — elle redéfinit localement une copie identique.

```typescript
// utils/productHelpers.ts:46 ET pages/mouvements/index.vue:113 — identiques
function normalizeProduct(raw: any): Product {
  const normalizedVariationIds = Array.isArray(raw.variationGroupIds)
    ? raw.variationGroupIds.map((id: any) => {
        const numericId = Number(id)
        return Number.isFinite(numericId) ? numericId : String(id)
      })
    : []
  // ... suite identique
}
```

**Recommandation : fusionner** — supprimer la version locale dans `mouvements/index.vue` et importer depuis `utils/productHelpers.ts`. Fix en 2 lignes : ajouter l'import, supprimer la définition locale.

---

### ❌ DUPLICATION — `hasVariations` redéfinie dans deux endroits

**Lieu 1 :** `utils/productHelpers.ts:33`
```typescript
export function hasVariations(product: Product): boolean { ... }
```

**Lieu 2 :** `components/mouvements/SelectedProductsTable.vue:148`
```typescript
function hasVariations(product: any): boolean { ... }
```

La version locale dans `SelectedProductsTable.vue` réimplémente la même logique avec `any` au lieu d'utiliser le type `Product`. Elle n'importe pas depuis `productHelpers`.

**Recommandation : fusionner** — remplacer la version locale par un import depuis `utils/productHelpers.ts`. Bonus : le paramètre `any` devient `Product`.

---

### ❌ DUPLICATION — `stockHistory` en double (store vs local)

**Lieu 1 :** `stores/products.ts:17` — `stockHistory` alimenté par `updateStock()`, `addStock()`, `setStock()`
**Lieu 2 :** `pages/produits/[id]/edit.vue:482` — `const stockHistory = ref<any[]>([])` alimenté par `$fetch('/api/products/:id/stock-history')`

Deux sources de données pour le même concept, aucune ne lit l'autre. La page ignore le store, le store ignore l'API. En pratique, seule la version de la page est affichée à l'utilisateur.

**Recommandation : supprimer `stockHistory` du store** (voir section 3 ci-dessus). Le tracking de l'historique doit rester côté API — c'est la source de vérité. La variable locale de la page est correcte.

---

### ⚠️ DUPLICATION STRUCTURELLE — Pattern de chargement dans les stores

Les 4 stores + le composable utilisent le même squelette :

```typescript
async function loadXXX() {
  if (loading.value) return          // guard
  loading.value = true
  try {
    const response = await $fetch('/api/xxx')
    state.value = response.xxx || []
    loaded.value = true
  } catch (err) {
    error.value = { message: ... }
  } finally {
    loading.value = false
  }
}
```

| Fichier | Fonction |
|---|---|
| `stores/products.ts:25` | `loadProducts()` |
| `stores/customer.ts:16` | `loadCustomers()` |
| `stores/sellers.ts:15` | `loadSellers()` |
| `stores/variationGroups.ts:9` | `loadGroups()` |
| `composables/useEstablishmentRegister.ts:42` | `loadEstablishments()` |
| `composables/useEstablishmentRegister.ts:56` | `loadRegisters()` |

**Recommandation : garder en l'état** — ce pattern est idiomatique en Pinia et Vue. Créer un helper générique (`createLoadAction()`) serait une sur-abstraction pour 6 fonctions. La duplication est structurelle mais chaque instance a des paramètres différents (endpoint, champ de réponse, logique post-load).

---

## Récapitulatif priorisé

### 🔴 Supprimer — confirmé sans utilité

| # | Élément | Fichier | Ligne | Justification | Statut |
|---|---|---|---|---|---|
| S1 | `createRequestLogger()` | `server/utils/logger.ts` | 57 | 0 import, 0 test | ✅ Supprimé 2026-03-13 |
| S2 | `createModuleLogger()` | `server/utils/logger.ts` | 64 | 0 import, 0 test | ✅ Supprimé 2026-03-13 |
| S3 | `getMovementWithDetails()` | `server/utils/createMovement.ts` | 51 | 0 import, 0 test | ✅ Supprimé 2026-03-13 (import `stockMovements` orphelin retiré) |
| S4 | `useTicketsStore` (store entier) | `stores/tickets.ts` | — | 0 usage en production, remplacé par `pendingCart` dans `cart.ts` | ✅ Fichier supprimé 2026-03-13 (+ `tests/stores/ticketsStore.test.ts`) |
| S5 | `stockHistory` + `updateStock` + `addStock` + `setStock` + `revertStockForSale` + types `StockMovement`/`StockMovementReason` | `stores/products.ts` | 17, 109–283, 434, 456–476 | Jamais appelé depuis un composant/page — la page `produits/[id]/edit.vue` a sa propre source via API | ✅ Supprimé 2026-03-13 (tests orphelins retirés de `productsStore.test.ts`) |

### 🟠 Fusionner — duplications à éliminer

| # | Élément | Fichiers | Action | Statut |
|---|---|---|---|---|
| F1 | `normalizeProduct()` | `utils/productHelpers.ts:46` ← `pages/mouvements/index.vue:113` | Supprimer copie locale, ajouter import | ✅ Déjà fait (import présent, pas de définition locale) |
| F2 | `hasVariations()` | `utils/productHelpers.ts:33` ← `components/mouvements/SelectedProductsTable.vue:148` | Supprimer copie locale, ajouter import | ✅ Exécuté 2026-03-15 (adaptateur mince délégant à productHelpers — type `any` conservé pour compatibilité avec `types/product.Product.stock?: number`) |

### 🟡 Garder — avec action complémentaire recommandée

| # | Élément | Fichier | Ligne | Recommandation |
|---|---|---|---|---|
| G1 | `validateStock()` | `stores/cart.ts` | 253 | ✅ Branché 2026-03-15 — appelé dans `ColRight.vue:validerVente()` avant `submitSale`, affiche les erreurs de stock via `toast.error` |
| G2 | `clearSeller()` | `stores/sellers.ts` | 69 | ✅ Branché 2026-03-15 — appelé dans `stores/auth.ts:signOut()` (bloc `finally`, garantit le nettoyage même en cas d'erreur Supabase) |
| G3 | `logSystemError()` | `server/utils/audit.ts` | 247 | ✅ Branché 2026-03-15 — ajouté dans les `catch` de `sales/create.post.ts` et `sales/close-day.post.ts`. Note : `verifyTicketChain` est une fonction synchrone pure sans catch interne — pas de catch à brancher. |
| G4 | `prepareTicketForArchive()` + interface `ArchivedTicket` | `server/utils/nf525.ts` | 184 | ✅ Supprimé 2026-03-15 — sur-ensemble couvert par `archives/create.post.ts`, interface non référencée nulle part |
