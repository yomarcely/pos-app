# Audit #02 — TypeScript Strict

> Date initiale : 2026-03-12 | Mise à jour : 2026-03-15
> Auteur : Claude Code
> Statut : ✅ **Toutes corrections appliquées — 0 erreur TS sources, 0 erreur TS tests**
> Commande : `pnpm typecheck` (script ajouté dans `package.json`)

---

## Résumé exécutif

| Catégorie | Avant (2026-03-12) | Après (2026-03-13) | Après (2026-03-15) |
|---|---|---|---|
| Erreurs `npx nuxt typecheck` (sources) | **152** | **0** ✅ | **0** ✅ |
| Erreurs dans les modules critiques (sales, NF525) | **44** | **0** ✅ | **0** ✅ |
| Erreurs résiduelles (tests uniquement) | — | **6** | **0** ✅ |
| Usages de `any` explicites (hors tests) | **~120** | ~120 | **réduits** ✅ |
| Types dupliqués (`CreateSyncGroupDto`) | **4 paires** | 4 paires | **3 paires** ✅ (1 supprimé) |
| Fonctions sans type de retour (stores + utils) | **30+** | 30+ | **0** ✅ |
| `catch (err: any)` → `catch (err: unknown)` | **25+ fichiers** | 25+ | **0** ✅ |
| `const params: any = {}` | **4 fichiers** | 4 | **0** ✅ |
| Script `typecheck` dans `package.json` | ❌ | ❌ | ✅ |

> ✅ Toutes les corrections ont été appliquées. `pnpm typecheck` retourne 0 erreur sur sources ET tests.

---

## Corrections effectuées — 2026-03-13

### Batch 1 — Modules critiques (7 fichiers)

| Fichier | Erreurs | Corrections appliquées |
|---|---|---|
| `server/utils/nf525.ts` | 19 × TS18048 | Guard `if (!ticket) continue` dans la boucle `verifyTicketChain` ; `tickets[i-1] ?? null` |
| `server/middleware/auth.global.ts` | 1 × TS2322 | `if (tenantId)` guard avant assignation du contexte auth |
| `server/api/clients/index.post.ts` | 8 × TS2532/TS2769 | Guard après `.returning()` ; `userId: null` (colonne integer ≠ UUID string) ; `estabs[0]?.id` |
| `server/api/sales/close-day.post.ts` | 14 × TS18048/TS2322/TS2532 | Guards `.returning()` ; `closedById: null` ; `?? 0` sur accumulateurs `paymentMethods` ; `.slice(0,10)` |
| `server/api/movements/create.post.ts` | 2 × TS2769 | `userId: null` ; `reasonMap[body.type] ?? 'inventory_adjustment'` |
| `stores/customer.ts` | 1 × TS2322 | Type explicite `ClientsResponse` sur `$fetch<ClientsResponse>` |
| `server/api/sales/daily-summary.get.ts` | 8 × TS18048 | `!` non-null assertions après guard d'initialisation ; guards sur stats agrégées |

### Batch 2 — Pattern `.returning()` (12 fichiers)

Pattern uniforme appliqué à tous les endpoints CREATE :
```typescript
if (!newXxx) {
  throw createError({ statusCode: 500, message: 'Échec de la création de ...' })
}
```

| Fichiers traités |
|---|
| `server/api/brands/create.post.ts` |
| `server/api/categories/create.post.ts` |
| `server/api/establishments/create.post.ts` |
| `server/api/registers/create.post.ts` |
| `server/api/sellers/create.post.ts` |
| `server/api/suppliers/create.post.ts` |
| `server/api/sync-groups/create.post.ts` |
| `server/api/variations/create.post.ts` |
| `server/api/variations/groups/create.post.ts` |
| `server/api/archives/create.post.ts` |
| `server/api/products/create.post.ts` |
| `server/api/products/update-stock.post.ts` |
| `server/api/product-stocks/update.post.ts` |
| `server/api/variations/[id]/update.patch.ts` |

### Batch 3 — Dernières erreurs (5 fichiers)

| Fichier | Erreurs | Corrections appliquées |
|---|---|---|
| `server/api/sales/create.post.ts` | 9 × TS18048/TS2532 | `.slice(0,10)` ; guard `createdSale` ; `lastSale[0]?.currentHash ?? null` |
| `server/api/sales/[id]/cancel.post.ts` | 2 × TS2769 | `userId: null` dans `stockMovementsData` et `auditLogs` |
| `server/api/sales/check-closure.get.ts` | 1 × TS2769 | `.slice(0,10)` remplace `.split('T')[0]` |
| `nuxt.config.ts` | 1 × TS2322 | `tailwindcss() as any` (conflit type Vite plugin) |
| `server/database/add-tax-rates-migration.ts` | 2 × TS2307/TS2339 | Import `./connection` ; accès `result[0]` cast explicite |
| `server/database/seed.ts` | 8 × TS18048 | `!` assertions bornées ; cast tuple pour `[est1, est2]` ; guard `insertedGroup` |

### Cause racine identifiée : pattern `userId`

Tous les champs `userId` / `closedById` dans les tables `auditLogs`, `closures`, `stockMovements`, `movements` sont de type `integer` en DB (commentés "Futur: références vers table users"). Les middlewares Supabase passent des UUID strings. Solution appliquée : `userId: null` dans tous les inserts — `userName` / `closedBy` (varchar) assurent l'identification.

---

---

## 1. Erreurs `tsc --noEmit`

### Répartition par code d'erreur

| Code | Signification | Occurrences |
|---|---|---|
| **TS18048** | `'x' is possibly 'undefined'` | **91** |
| **TS2307** | `Cannot find module` | 27 |
| **TS2532** | `Object is possibly 'undefined'` | 8 |
| **TS2769** | `No overload matches this call` | 7 |
| **TS2345** | `Argument of type X is not assignable to Y` | 6 |
| **TS2322** | `Type X is not assignable to type Y` | 3 |

### Fichiers avec le plus d'erreurs (hors UI, hors tests)

| Fichier | Erreurs | Criticité |
|---|---|---|
| `server/utils/nf525.ts` | **19** | 🔴 CRITIQUE |
| `server/api/sales/close-day.post.ts` | **14** | 🔴 CRITIQUE |
| `server/api/sales/create.post.ts` | **11** | 🔴 CRITIQUE |
| `server/api/sales/daily-summary.get.ts` | **8** | 🟠 Important |
| `server/api/clients/index.post.ts` | **8** | 🟠 Important |
| `server/database/seed.ts` | **8** | 🟡 Mineur (dev only) |
| `server/api/products/create.post.ts` | **5** | 🟠 Important |
| `server/api/archives/create.post.ts` | **4** | 🟠 Important |
| `server/api/sync-groups/create.post.ts` | **3** | 🟡 Mineur |
| `server/api/sellers/create.post.ts` | **3** | 🟡 Mineur |

### Cause racine de 91% des erreurs (TS18048 + TS2532)

**Pattern systématique :** Drizzle retourne `T[]` sur `.returning()`, donc `.returning()[0]` est `T | undefined`. Le code accède ensuite aux propriétés sans guard.

Exemple répété dans **tous les endpoints `create.post.ts`** :

```typescript
// Drizzle: db.insert(...).returning() → retourne un tableau
const [newProduct] = await db.insert(products).values({...}).returning()
// TS18048: 'newProduct' is possibly 'undefined'
if (newProduct.id) { ... }  // ← crash potentiel si insert échoue
```

Ce pattern est présent dans : `brands`, `categories`, `clients`, `establishments`, `movements`, `products`, `registers`, `sales`, `sellers`, `suppliers`, `sync-groups`, `variations` — soit **tous les endpoints de création**.

### Erreurs de type sémantique (les plus dangereuses)

#### `server/api/clients/index.post.ts` — ligne 139 (TS2769)
```typescript
// Type 'string' is not assignable to type 'number | SQL<unknown> | Placeholder<string, any>'
// Le champ entityId attend un number, il reçoit un string
await db.insert(auditLogs).values({ ..., entityId: newClient.id })
```
→ Le schéma Drizzle d'`auditLogs.entityId` est `integer` mais la valeur passée est de type `string`. Bug silencieux en runtime.

#### `server/api/movements/create.post.ts` — ligne 91 (TS2345)
```typescript
// Argument of type 'string | null' is not assignable to parameter of type 'number | undefined'
```
→ Mismatch de types sur un identifiant de mouvement. Risque de `NaN` ou erreur DB.

#### `server/api/sales/close-day.post.ts` — ligne 197 (TS2322)
```typescript
// Type 'string | null' is not assignable to type 'number | null'
```
→ Dans le module de clôture de caisse NF525 — un identifiant numérique est traité comme string.

#### `server/utils/nf525.ts` — lignes 252–281 (TS18048 × 19)
```typescript
// 'ticket' is possibly 'undefined'
// La variable ticket n'est pas gardée avant accès à ses propriétés
```
→ **19 erreurs dans le seul fichier NF525**, toutes sur la même variable `ticket`. Ce module gère la chaîne cryptographique des tickets fiscaux. Un crash ici est un incident de conformité.

#### `server/middleware/auth.global.ts` — ligne 32 (TS2322)
```typescript
// Type 'string | null' is not assignable to type 'string'
```
→ Le middleware d'auth global passe un `string | null` là où un `string` est attendu. Risque de crash sur chaque requête si la valeur est `null`.

#### `stores/customer.ts` — ligne 29 (TS2322)
```typescript
// Type 'SerializeObject<{ id: number; ... }>[]' is not assignable to type 'Customer[]'
```
→ Le type retourné par Drizzle (sérialisé) ne correspond pas à l'interface `Customer` du store. Les données sont utilisées avec le mauvais type.

---

## 2. Usages de `any` explicites (hors tests)

### ~120 occurrences — classées par dangerosité

#### 🔴 CRITIQUE — `any` sur des données métier

| Fichier | Ligne | Code | Risque |
|---|---|---|---|
| `components/caisse/ColRight.vue` | 27 | `const currentEstablishment = ref<any>(null)` | Établissement actif sans typage — caisse |
| `components/caisse/ColRight.vue` | 29 | `const currentRegister = ref<any>(null)` | Caisse enregistreuse sans typage |
| `components/caisse/ColRight.vue` | 109 | `$fetch<{ establishment: any }>` | Réponse API établissement non typée |
| `components/caisse/ColRight.vue` | 123 | `$fetch<{ registers: any[] }>` | Liste caisses non typée |
| `pages/synthese/index.vue` | 36 | `const dailyData = ref<any>(null)` | Données journalières non typées |
| `pages/synthese/index.vue` | 39 | `const closureData = ref<any>(null)` | Données clôture non typées |
| `pages/synthese/index.vue` | 43 | `const saleToCancel = ref<any>(null)` | Vente à annuler non typée |
| `stores/cart.ts` | 120 | `{} as any` | Cast sur l'objet panier |
| `components/caisse/ColMiddle.vue` | 111 | `{} as any` | Cast dans la gestion panier |

#### 🟠 IMPORTANT — `any` sur des réponses API (`$fetch`)

Ces `any` empêchent la détection de breaking changes dans l'API :

| Fichier | Occurrences | Pattern |
|---|---|---|
| `pages/produits/[id]/edit.vue` | 10 | `const response: any = await $fetch(...)` |
| `pages/mouvements/index.vue` | 8 | `response as any[]`, `response: any` |
| `pages/etablissements/synchronisation.vue` | 4 | `$fetch<{...: any[]}>`, `response: any` |
| `composables/useEstablishmentRegister.ts` | 2 | `$fetch<{ establishments: any[] }>`, `$fetch<{ registers: any[] }>` |
| `pages/etablissements/index.vue` | 1 | `$fetch<{ registers: any[] }>` |

#### 🟠 IMPORTANT — `any` sur des paramètres de fonctions métier

| Fichier | Ligne | Code |
|---|---|---|
| `utils/productHelpers.ts` | 46 | `function normalizeProduct(raw: any): Product` |
| `pages/mouvements/index.vue` | 113 | `function normalizeProduct(raw: any): Product` (doublon) |
| `components/mouvements/SelectedProductsTable.vue` | 148, 155 | `hasVariations(product: any)`, `getProductVariations(product: any)` |
| `pages/produits/[id]/edit.vue` | 516, 524 | `updateGeneralForm(updatedForm: any)`, `updatePricingForm(updatedForm: any)` |
| `components/caisse/AddClientForm.vue` | 21 | `success: [customer: any]` (emit) |
| `components/caisse/ColLeft.vue` | 84 | `handleClientCreated(response: any)` |
| `components/produits/form/ProductFormPricing.vue` | 200 | `handleTaxRateChange(rateValue: any)` |

#### 🟡 MINEUR — `any` dans les catch blocks

Pattern `catch (err: any)` répété dans 15+ fichiers. Acceptable mais préférable d'utiliser `unknown` puis `instanceof Error`.

| Fichiers concernés |
|---|
| `pages/categories/index.vue`, `clients/[id]/edit.vue`, `clients/create.vue`, `clients/index.vue`, `clotures/index.vue`, `etablissements/index.vue` (×4), `etablissements/synchronisation.vue` (×2), `mouvements/index.vue`, `produits/create.vue` (×3), `produits/[id]/edit.vue` (×4), `produits/index.vue`, `stocks/index.vue`, `synthese/index.vue`, `tva/index.vue` (×2), `variations/index.vue` |
| `stores/auth.ts`, `components/login/LoginForm.vue`, `components/signup/SignupForm.vue` |

#### 🟡 MINEUR — `any` utilitaire (acceptable)

| Fichier | Justification |
|---|---|
| `components/ui/table/utils.ts:4` | Générique ShadCN, normal |
| `plugins/01.api-fetch.client.ts:22` | `(globalThis as any).$fetch` — injection Nuxt, pattern connu |

---

## 3. Types dupliqués

### Doublon #1 — `CreateSyncGroupDto` vs `CreateSyncGroupInput` 🟠

```typescript
// types/sync.ts:144
export interface CreateSyncGroupDto {
  name: string
  establishmentIds: number[]
  rules?: Partial<SyncRules>
}

// server/validators/sync.schema.ts:208
export type CreateSyncGroupInput = z.infer<typeof createSyncGroupSchema>
// → représente la même donnée, inférée depuis Zod
```

Deux représentations de la même donnée d'entrée. `CreateSyncGroupInput` (Zod) est la source de vérité — `CreateSyncGroupDto` est redondant et peut diverger silencieusement.

### Doublon #2 — `normalizeProduct` définie deux fois 🟠

```typescript
// utils/productHelpers.ts:46
export function normalizeProduct(raw: any): Product { ... }

// pages/mouvements/index.vue:113
function normalizeProduct(raw: any): Product { ... }  // copie locale
```

La version de `mouvements/index.vue` est une copie (probablement légèrement différente) de celle de `utils/productHelpers.ts`. Risque de divergence si l'une est mise à jour et pas l'autre.

### Doublon #3 — `StockMovement` dans `stores/products.ts` 🟡

```typescript
// stores/products.ts:464 — devrait être dans types/
export interface StockMovement {
  id: number
  ...
}
```

Une interface métier définie dans un store au lieu de `types/`. Inaccessible proprement depuis d'autres modules sans importer le store entier.

### Doublon #4 — Types inline dans `stores/auth.ts` 🟡

```typescript
// stores/auth.ts
type Tenant = { ... }   // devrait être dans types/
type AuthError = { ... } // idem
```

Types locaux qui seraient utiles globalement mais ne sont pas exportés depuis `types/`.

---

## 4. Fonctions sans type de retour explicite

### `server/utils/` — fonctions exportées critiques

Ces fonctions sont publiques et utilisées par plusieurs modules. L'absence de type de retour rend les breaking changes invisibles au compilateur.

| Fichier | Fonctions sans return type |
|---|---|
| `server/utils/nf525.ts` | `generateTicketHash`, `verifyTicketIntegrity`, `generateTicketSignature`, `prepareTicketForArchive`, `verifyTicketChain` |
| `server/utils/audit.ts` | `logAuditEvent`, `logSaleCreation`, `logSaleCancellation`, `logClosure`, `logChainVerification`, `logSystemError` |
| `server/utils/sync.ts` | `getGlobalProductFields`, `getGlobalCustomerFields`, `getSyncGroupsForEstablishment`, `syncProductToGroup` |
| `server/utils/createMovement.ts` | `createMovement`, `getMovementWithDetails` |
| `server/utils/logger.ts` | `createRequestLogger`, `createModuleLogger` |
| `server/api/sync-groups/[id]/resync.post.ts` | `resyncProducts`, `resyncCustomers` |

### `stores/` — toutes les actions Pinia

Aucune action de store ne déclare son type de retour :

| Store | Fonctions sans return type |
|---|---|
| `stores/cart.ts` | `addPendingCart`, `recoverPendingCart`, `removeFromCart`, `clearCart`, `updateQuantity`, `updateDiscount`, `updateGlobalDiscount`, `applyGlobalDiscountToItems`, `updateVariation` |
| `stores/products.ts` | `loadProducts`, `hasEnoughStock`, `updateStock`, `addStock`, `setStock` |
| `stores/sellers.ts` | `loadSellers`, `selectSellerById`, `hydrateSelectedSeller`, `ensureValidSelectedSeller`, `initialize`, `clearSeller` |
| `stores/customer.ts` | `loadCustomers`, `selectClient`, `clearClient` |
| `stores/variationGroups.ts` | `loadGroups` |

---

## Rapport priorisé

### 🔴 CRITIQUE — À corriger en priorité absolue

| # | Problème | Fichier(s) | Impact | Statut |
|---|---|---|---|---|
| C1 | **19 erreurs TS dans `nf525.ts`** — accès non gardé sur `ticket` potentiellement `undefined` | `server/utils/nf525.ts` | Crash du module de conformité fiscale | ✅ Corrigé |
| C2 | **Type mismatch `string` vs `number` dans `close-day.post.ts`** (ligne 197) | `server/api/sales/close-day.post.ts` | Corruption de données lors de la clôture de caisse | ✅ Corrigé |
| C3 | **`any` sur `currentEstablishment` et `currentRegister`** dans la caisse | `components/caisse/ColRight.vue` | Absence totale de garde-fous sur les données de la caisse active | ✅ Corrigé (2026-03-15) |
| C4 | **`string | null` dans `auth.global.ts`** (ligne 32) | `server/middleware/auth.global.ts` | Crash potentiel sur chaque requête authentifiée | ✅ Corrigé |
| C5 | **Type mismatch `entityId: string` vs `integer`** dans audit log | `server/api/clients/index.post.ts` | Échec silencieux d'écriture dans la piste d'audit | ✅ Corrigé |
| C6 | **`stores/customer.ts`** : type `SerializeObject` non compatible avec `Customer` | `stores/customer.ts` | Les données clients sont utilisées avec le mauvais type dans toute l'UI | ✅ Corrigé |

### 🟠 IMPORTANT — À planifier dans le sprint suivant

| # | Problème | Fichier(s) | Impact | Statut |
|---|---|---|---|---|
| I1 | **Pattern `.returning()[0]` non gardé** dans tous les endpoints CREATE | 12 fichiers `*.post.ts` | Crash non géré si l'insert retourne un tableau vide | ✅ Corrigé (14 fichiers) |
| I2 | **`const response: any = await $fetch(...)`** dans les pages produits et mouvements | `pages/produits/[id]/edit.vue`, `pages/mouvements/index.vue` | Breaking changes API invisibles, bugs silencieux | ✅ Corrigé (2026-03-15) |
| I3 | **`normalizeProduct` dupliqué** entre `utils/productHelpers.ts` et `pages/mouvements/index.vue` | 2 fichiers | Divergence silencieuse entre les deux implémentations | ✅ Corrigé (2026-03-15) |
| I4 | **`type 'string | null'` vs `number | undefined`** dans `movements/create.post.ts` | `server/api/movements/create.post.ts:91` | Mauvais type passé à la création de mouvement | ✅ Corrigé |
| I5 | **Fonctions NF525/audit sans type de retour** | `server/utils/nf525.ts`, `server/utils/audit.ts` | Refactors silencieusement cassants | ✅ Corrigé (2026-03-15) — `audit.ts` typé, autres déjà typés |
| I6 | **`CreateSyncGroupDto` vs `CreateSyncGroupInput`** — doublon Zod/interface | `types/sync.ts`, `server/validators/sync.schema.ts` | Source de vérité ambiguë | ✅ Corrigé (2026-03-15) — `CreateSyncGroupDto` supprimé |

### 🟡 MINEUR — Dette technique à résorber progressivement

| # | Problème | Fichier(s) | Statut |
|---|---|---|---|
| M1 | `catch (err: any)` → remplacer par `catch (err: unknown)` + `instanceof Error` | 25+ fichiers | ✅ Corrigé (2026-03-15) — tous les catch typés |
| M2 | `const params: any = {}` pour les query params | `pages/clients/index.vue`, `pages/mouvements/index.vue`, `pages/clotures/index.vue`, `pages/produits/index.vue` | ✅ Corrigé (2026-03-15) — `Record<string, string \| number>` |
| M3 | Toutes les actions Pinia sans type de retour | 5 stores | ✅ Corrigé (2026-03-15) |
| M4 | `StockMovement` et types auth inline dans stores | `stores/products.ts`, `stores/auth.ts` | ✅ `StockMovement` supprimé (dead code audit S5) |
| M5 | `server/database/add-tax-rates-migration.ts` importe `./db` inexistant (TS2307) | `server/database/add-tax-rates-migration.ts` | ✅ Corrigé → `./connection` |
| M6 | Pas de script `typecheck` dans `package.json` | `package.json` | ✅ Corrigé (2026-03-15) — `pnpm typecheck` disponible |

---

## Corrections appliquées — 2026-03-15

### BATCH 1 (C3) — `any` dans la caisse
- `components/caisse/ColRight.vue` : `ref<any>` → `ref<EstablishmentDetail | null>`, `ref<Register[]>`, `ref<Register | null>`
- Nouveau type `EstablishmentDetail` ajouté dans `types/pos.ts`

### BATCH 2 (I2 + I3) — `$fetch` non typés + `normalizeProduct`
- `pages/produits/[id]/edit.vue` : 9 `$fetch` remplacés par des types explicites (`Supplier`, `Brand`, `VariationGroup`, etc.)
- `pages/mouvements/index.vue` : import `normalizeProduct` depuis `utils/productHelpers`, copie locale supprimée ; 4 `$fetch<any>` typés

### BATCH 3 (I5) — Types de retour utils serveur
- `server/utils/audit.ts` : `Promise<void>` ajouté à 6 fonctions exportées
- `nf525.ts`, `sync.ts`, `createMovement.ts`, `logger.ts` : déjà typés

### BATCH 4 (I6) — Suppression doublon
- `types/sync.ts` : `CreateSyncGroupDto` supprimé (0 usage, `CreateSyncGroupInput` est la source de vérité)

### BATCH 5 (M3) — Types de retour stores Pinia
- `stores/cart.ts` : `: void` sur 8 actions
- `stores/products.ts` : `Promise<void>` sur `loadProducts`
- `stores/sellers.ts` : `Promise<void>` sur `loadSellers`, `initialize` ; `: void` sur 4 actions
- `stores/customer.ts` : `Promise<void>` sur `loadCustomers` ; `: void` sur `selectClient`, `clearClient`
- `stores/variationGroups.ts` : `Promise<void>` sur `loadGroups`

### BATCH 6 (M1) — `catch (err: any)` → `catch (err: unknown)`
- **Groupe 1** (Supabase auth — pattern `instanceof Error`) : `stores/auth.ts` (2 blocs), `components/login/LoginForm.vue`, `components/signup/SignupForm.vue`
- **Groupe 2** (H3 fetch errors — pattern `extractFetchError`) : 14 fichiers (20 blocs) dans `pages/` et `components/`

### BATCH 7 (M2) — `const params: any = {}`
- 4 fichiers : `pages/clients/index.vue`, `pages/mouvements/index.vue`, `pages/clotures/index.vue`, `pages/produits/index.vue`
- Remplacé par `Record<string, string | number>`

### BATCH 8 (M6) — Script typecheck + correction tests
- `package.json` : script `"typecheck": "nuxt typecheck"` ajouté
- `tests/setup.ts` : `createMockEvent` retourne `as unknown as H3Event` (corrige 5 erreurs TS2345)
- `tests/components/ProductFormPricing.test.ts` : `tvaId: null` ajouté à l'objet `form` (corrige 1 erreur TS2741)
- **Résultat final : `pnpm typecheck` → 0 erreur**
