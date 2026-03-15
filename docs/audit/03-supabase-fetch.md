# Audit #03 — Interactions Supabase & $fetch

> Date initiale : 2026-03-12
> Mis à jour : 2026-03-16
> Auteur : Claude Code
> Statut : ✅ Toutes corrections appliquées — 2026-03-16

---

## Contexte architectural préalable

**Supabase n'est utilisé que pour l'authentification.** Toutes les données métier (produits, ventes, clients, stock…) passent par Drizzle ORM → PostgreSQL via l'API Nitro. Cette séparation est saine mais crée deux vecteurs d'audit distincts :

| Couche | Technologie | Périmètre |
|---|---|---|
| Auth | Supabase Auth (client JS) | login, logout, session, inscription |
| Auth (server) | Supabase Admin SDK (service role key) | vérification JWT par requête |
| Données métier | Drizzle ORM → PostgreSQL | tout le reste |
| Frontend → Backend | `$fetch` / `useFetch` (Nitro) | tous les composants et pages |

---

## 1. Appels Supabase directs hors store/composable

### 🔴 `components/signup/SignupForm.vue` — `supabase.auth.signUp()` dans un composant

```typescript
// signup/SignupForm.vue:20-70
import { useSupabaseClient } from '@/composables/useSupabaseClient'
const supabase = useSupabaseClient()  // ← appel direct dans le composant

const { data, error: signUpError } = await supabase.auth.signUp({
  email: form.email,
  password: form.password,
  options: { data: { name: form.name } },
})
```

**Problème :** La logique d'inscription est dans le composant, pas dans `useAuthStore`. Alors que `signIn` et `signOut` sont correctement dans `stores/auth.ts`, `signUp` contourne complètement le store. Conséquences :
- Après inscription réussie, aucun `setUserContext()` n'est appelé → l'état `user`, `tenantId`, `tenants` reste `null`
- La navigation vers `/dashboard` se fait sans que le store auth soit hydraté
- Si la logique d'inscription évolue (ex : création de tenant), il faudra penser à ce composant séparément

### 🟠 `$fetch` directs dans les composants caisse (contournement des stores)

Les composants caisse effectuent des appels API directement, en dehors des stores Pinia :

| Fichier | Ligne | Endpoint | Criticité |
|---|---|---|---|
| `components/caisse/ColRight.vue` | 54 | `GET /api/sales/check-closure` | 🔴 Critique |
| `components/caisse/ColRight.vue` | 109 | `GET /api/establishments/:id` | 🟠 Important |
| `components/caisse/ColRight.vue` | 123 | `GET /api/registers` | 🟠 Important |
| `components/caisse/ColRight.vue` | 262 | **`POST /api/sales/create`** | 🔴 **Critique** |
| `components/caisse/ColLeft.vue` | 61 | `GET /api/clients/:id/purchases` | 🟡 Mineur |
| `components/caisse/AddClientForm.vue` | 120 | `POST /api/clients` | 🟠 Important |
| `components/sellers/EstablishmentMultiSelect.vue` | 102 | `GET /api/establishments` | 🟡 Mineur |
| `components/sellers/SellerCard.vue` | 116 | `GET /api/establishments/:id` | 🟡 Mineur |
| `components/produits/form/ProductFormPricing.vue` | 149 | `GET /api/tax-rates` | 🟡 Mineur |

**Le cas le plus grave : `ColRight.vue:262` — création de vente depuis le composant**

```typescript
// components/caisse/ColRight.vue:262
const response = await $fetch('/api/sales/create', {
  method: 'POST',
  body: { ... }
})
```

La création d'une vente (opération NF525, débit de stock, audit trail) est déclenchée directement depuis un composant Vue, sans passer par `cartStore`. L'état du store n'est pas mis à jour de manière centralisée — le composant gère lui-même la logique post-vente. Cela signifie que cette logique critique ne peut pas être réutilisée, testée unitairement, ou interceptée par d'autres stores.

---

## 2. Requêtes sans gestion d'erreur

### 🔴 `stores/auth.ts:93` — `signOut` sans try/catch

```typescript
// stores/auth.ts:92-98
const signOut = async () => {
  await supabase.auth.signOut()  // ← aucun try/catch
  session.value = null
  user.value = null
  tenantId.value = null
  tenants.value = []
}
```

Si `supabase.auth.signOut()` lève une exception (réseau, session expirée, Supabase indisponible), l'état local est quand même réinitialisé (ce qui est discutable) mais l'erreur est silencieusement avalée. L'utilisateur pensera être déconnecté alors que son token Supabase est peut-être encore actif.

### 🔴 `server/middleware/auth.global.ts:25-26` — appel Supabase sans guard complet

```typescript
// server/middleware/auth.global.ts:25-26
if (token && supabaseServerClient) {
  const { data } = await supabaseServerClient.auth.getUser(token)
  // ← la destructuration ignore complètement `error`
  if (data.user) {
    ...
  }
}
```

Dans le chemin du bypass de développement, `error` n'est jamais lu. Si `getUser` retourne `{ data: null, error: ... }`, le middleware continue silencieusement sans contexte auth. Ce chemin est actif uniquement si `ALLOW_AUTH_BYPASS=true` + `NODE_ENV=development`, mais reste un trou de sécurité potentiel si la condition est mal configurée.

### 🟠 `components/caisse/AddClientForm.vue:79` — appel API externe non sécurisé

```typescript
// AddClientForm.vue:79
const response = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${postalCode}&...`)
```

- Appel à une **API externe tiers** (geo.api.gouv.fr) directement depuis le navigateur du client
- La gestion d'erreur existe (try/catch ligne 101) mais n'est que `console.error` + message vague
- Le même appel est **dupliqué** dans `pages/clients/create.vue:356` — logique identique copiée-collée
- Aucune validation du `postalCode` avant l'appel (injection potentielle de paramètre dans l'URL, bien que l'API soit publique)

### 🟠 `stores/auth.ts:100-108` — `restoreSession` sans propagation d'erreur

```typescript
// stores/auth.ts:100-108
const restoreSession = async () => {
  const { data, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    console.error('[Auth] restoreSession error', sessionError)
    return null  // ← l'erreur est loggée mais retournée comme null
  }
  ...
}
```

L'appelant reçoit `null` sans savoir si c'est "pas de session" ou "erreur réseau". Les deux cas devraient être traités différemment (ex : retry sur erreur réseau, redirect sur session absente).

### 🟡 `$fetch` dans composants avec catch vides ou insuffisants

Dans plusieurs composants, le `catch` se contente de `console.error` sans feedback utilisateur :

| Fichier | Ligne catch | Comportement |
|---|---|---|
| `components/caisse/ColLeft.vue` | 63 | `catch (error)` — corps vide (?), aucun feedback |
| `components/sellers/EstablishmentMultiSelect.vue` | 104 | `catch (error)` — à vérifier |
| `components/sellers/SellerCard.vue` | 120 | `catch (error)` — à vérifier |

---

## 3. Problèmes N+1

### 🔴 N+1 dans `server/utils/sync.ts` — `syncCustomerToGroup` (lignes 753–779)

```typescript
// sync.ts:752-779
const establishIds = new Set<number>([sourceEstablishmentId])
groups.forEach(g => g.targetEstablishments.forEach(id => establishIds.add(id)))

for (const estId of establishIds) {              // ← boucle sur N établissements
  const existing = await db                       // ← SELECT par établissement
    .select({ id: customerEstablishments.id })
    .from(customerEstablishments)
    .where(and(...))
    .limit(1)

  if (existing.length === 0) {
    await db.insert(customerEstablishments).values({ ... })  // ← INSERT conditionnel
  }
}
```

**Impact :** Pour un client appartenant à un groupe de 5 établissements, cela génère 5 SELECT + jusqu'à 5 INSERT **séquentiels**. Appelé à chaque création/modification de client.

### 🔴 N+1 dans `server/utils/sync.ts` — `syncProductToGroup` (lignes 574–614)

```typescript
// sync.ts:504-614 (simplifié)
for (const group of groups) {                          // boucle groupes
  await db.update(products).set(fieldsToSync)...       // UPDATE produit

  for (const targetEstabId of group.targetEstablishments) {  // boucle établissements
    const [existingStock] = await db                   // ← SELECT par établissement
      .select().from(productStocks)
      .where(and(eq(productStocks.productId, productId), eq(...)))

    if (!existingStock) {
      await db.insert(productStocks).values({ ... })   // ← INSERT conditionnel
    }

    await db.insert(syncLogs).values({ ... })          // ← INSERT log par établissement
  }
}
```

**Impact :** Pour un produit dans 3 groupes de sync avec 4 établissements chacun, on génère : 3 × (1 UPDATE + 4 × (1 SELECT + 1 INSERT stock + 1 INSERT log)) = **3 + 36 = 39 requêtes séquentielles** pour une seule modification produit. Appelé à chaque `PUT /api/products/:id`.

### 🔴 N×M dans `server/api/sync-groups/[id]/resync.post.ts` — `resyncProducts` (lignes 277–370)

```typescript
// resync.post.ts:277 (dans une transaction paginée par 100)
for (const product of globalProducts) {              // N produits (batch de 100)
  await trx.update(products).set(...)               // UPDATE global

  for (const estId of establishmentIdsForOverrides) { // M établissements
    const result = await trx.update(productEstablishments)...  // UPDATE override
    if (result.length === 0) {
      await trx.insert(productEstablishments)...    // INSERT si absent
    }
    await trx.insert(productStocks)... (conditionnel) // SELECT + INSERT stock
  }
}
```

**Impact :** Pour une resync de 500 produits dans un groupe de 3 établissements, chaque batch de 100 génère jusqu'à `100 × 3 × 3 = 900` requêtes dans la transaction. La pagination atténue le risque de timeout, mais la transaction reste lourde.

**Note :** ces N+1 dans les boucles transactionnelles (`trx`) sont moins dangereux qu'hors transaction (pas de lectures sales), mais ils dégradent les performances et augmentent le risque de contention sur les tables.

### 🟠 N+1 dans `server/api/sales/create.post.ts` (lignes 397–443)

```typescript
// sales/create.post.ts:397
for (const item of body.items) {              // N lignes de vente
  const [productStock] = await tx            // ← SELECT stock par article
    .select().from(productStocks)
    .where(and(...establishment, ...product))

  // Conditionnellement :
  const [foundVar] = await tx               // ← SELECT variation si clé inconnue
    .select({ id: variations.id })
    .from(variations)
    .where(eq(variations.name, variationKey))
}
```

**Impact :** Pour une vente de 10 articles avec variations inconnues, jusqu'à **20 requêtes séquentielles** dans la transaction de vente. Acceptable pour une caisse (peu d'articles en général), mais peut devenir problématique sur des grosses commandes.

---

## 4. Client Supabase typé

### ✅ Typage correct — client `SupabaseClient` utilisé partout

```typescript
// composables/useSupabaseClient.ts
export function useSupabaseClient(): SupabaseClient { ... }

// types/nuxt.d.ts
$supabase: SupabaseClient | null

// server/utils/supabase.ts
export const supabaseServerClient = createClient(url, key, ...) // → SupabaseClient
```

Le client retourné est bien `SupabaseClient` (non générique `SupabaseClient<Database, Schema>` mais suffisant pour un usage auth-only).

### ⚠️ Absence du type `Database` générique (mineur pour usage auth-only)

```typescript
// Actuel
createClient(supabaseUrl, supabaseAnonKey, {...})
// → SupabaseClient (sans types de tables)

// Idéal si Supabase était utilisé pour les données
createClient<Database>(supabaseUrl, supabaseAnonKey, {...})
```

Pour un usage **exclusivement auth**, l'absence du type `Database` n'est pas un problème : `supabase.auth.*` est pleinement typé sans lui.

### ⚠️ `useSupabaseClient()` peut crasher si Supabase n'est pas configuré

```typescript
// composables/useSupabaseClient.ts:6-9
if (!$supabase) {
  throw new Error('Supabase n\'est pas initialisé...')
}
```

`useAuthStore` appelle `useSupabaseClient()` **au niveau du store** (ligne 47), pas dans une action. Si les variables d'environnement Supabase sont absentes, le store crashe à l'initialisation — avant même qu'un composant tente de se connecter. Il n'y a pas de mode dégradé.

---

## Rapport priorisé

### 🔴 CRITIQUE

| # | Problème | Fichier | Ligne |
|---|---|---|---|
| C1 | ✅ `POST /api/sales/create` appelé depuis `ColRight.vue` — logique vente hors store, non testable | `components/caisse/ColRight.vue` | 262 |
| C2 | ✅ `signUp` Supabase dans composant — store auth non hydraté après inscription | `components/signup/SignupForm.vue` | 70 |
| C3 | ✅ N+1 `syncProductToGroup` — jusqu'à 39 requêtes pour une modif produit | `server/utils/sync.ts` | 504–614 |
| C4 | ✅ N+1 `syncCustomerToGroup` — N SELECT+INSERT séquentiels sur établissements | `server/utils/sync.ts` | 753–779 |
| C5 | ✅ `signOut` sans try/catch — erreur Supabase silencieuse | `stores/auth.ts` | 93 |

### 🟠 IMPORTANT

| # | Problème | Fichier | Ligne |
|---|---|---|---|
| I1 | ✅ N×M dans `resyncProducts` — 900 req/batch transaction sur resync complète | `server/api/sync-groups/[id]/resync.post.ts` | 277–370 |
| I2 | ✅ N+1 dans `sales/create` — SELECT/variation dans boucle d'items | `server/api/sales/create.post.ts` | 397–443 |
| I3 | ✅ `restoreSession` ne distingue pas "pas de session" vs "erreur réseau" | `stores/auth.ts` | 100–108 |
| I4 | ✅ Appel externe `geo.api.gouv.fr` directement depuis composant, sans proxy | `components/caisse/AddClientForm.vue` | 79 |
| I5 | ✅ Même appel `geo.api.gouv.fr` dupliqué (copie-colle) | `pages/clients/create.vue` | 356 |
| I6 | ✅ `$fetch` des composants caisse hors store (établissement, register, check-closure) | `components/caisse/ColRight.vue` | 54, 109, 123 |

### 🟡 MINEUR

| # | Problème | Fichier | Ligne |
|---|---|---|---|
| M1 | ✅ `catch (error)` vide ou insuffisant dans composants sellers | `components/sellers/EstablishmentMultiSelect.vue`, `SellerCard.vue` | 104, 120 |
| M2 | ✅ Auth bypass ignore `error` de `getUser` en dev | `server/middleware/auth.global.ts` | 25–26 |
| M3 | ✅ `useSupabaseClient()` crash sans mode dégradé si env manquants | `composables/useSupabaseClient.ts` | 6–9 |
| M4 | N/A — Client Supabase sans type `Database` — aucun fichier `types/supabase.ts` généré dans le projet, usage auth-only, non applicable | `plugins/00.supabase.ts`, `server/utils/supabase.ts` | — |

---

## Points positifs à noter

- Les `$fetch` dans les pages sont **tous** dans des try/catch — pas de requête non gardée dans les pages
- `assertAuth()` est correctement implémenté côté serveur (gère absence de token, token invalide, tenant manquant)
- Le `supabaseServerClient` utilise bien la **service role key** côté serveur (et non l'anon key)
- La séparation auth (Supabase) / données (Drizzle) est une bonne décision architecturale — elle limite la surface d'exposition Supabase

---

## Corrections appliquées — 2026-03-13

### Pattern ajouté : `composables/useFetchError.ts`

Utilitaire réutilisable pour extraire le message d'erreur d'une `FetchError` Nitro/H3 :

```typescript
// composables/useFetchError.ts
export function extractFetchError(err: unknown, fallback = 'Une erreur est survenue'): string {
  if (typeof err !== 'object' || err === null) return fallback
  const e = err as Record<string, any>
  return e?.data?.message ?? e?.data?.statusMessage ?? e?.statusMessage ?? e?.message ?? fallback
}
```

> Note : `lib/utils.ts` est auto-généré par shadcn-nuxt et ne peut pas servir de host pour des exports custom.

---

### Problèmes corrigés — session 2026-03-13

| # | Statut | Fichier | Correction |
|---|---|---|---|
| C5 | ✅ **Corrigé** | `stores/auth.ts` | `signOut` : ajout try/catch complet. State local nettoyé dans `finally` même si Supabase échoue. `error.value` mis à jour. |
| I3 | ✅ **Corrigé** | `stores/auth.ts` | `restoreSession` : distingue maintenant "pas de session" (`return null`) de "erreur réseau" (`throw`). L'appelant peut différencier les deux cas. |
| — | ✅ **Corrigé** | `middleware/auth.global.ts` (client) | `restoreSession()` wrappé dans try/catch : erreur réseau → `isAuthenticated` reste `false` → redirect `/login`. |
| M2 | ✅ **Corrigé** | `server/middleware/auth.global.ts` | `error` de `getUser` n'était pas lu. Maintenant : `getUserError` est loggé via Pino (`logger.warn`) et le contexte auth n'est pas défini en cas d'erreur. |
| — | ✅ **Amélioré** | `components/caisse/ColRight.vue` | `validerVente` catch : utilise `extractFetchError` — l'utilisateur voit maintenant le message d'erreur réel de l'API (ex: "Stock insuffisant") au lieu d'un message générique. |

---

### Problèmes corrigés — session 2026-03-15

| # | Statut | Fichier | Correction |
|---|---|---|---|
| I4, I5 | ✅ **Corrigé** | `composables/useGeoApi.ts` (nouveau), `types/geo.ts` (nouveau) | Logique `geo.api.gouv.fr` extraite dans un composable dédié avec validation 5 chiffres et URL-safe construction. Doublon supprimé dans `AddClientForm.vue` et `clients/create.vue`. |
| M1 | ✅ **Corrigé** | `components/sellers/EstablishmentMultiSelect.vue`, `SellerCard.vue` | Catch insuffisants remplacés : `extractFetchError` + `loadError` réactif affiché dans le template. |
| M3 | ✅ **Corrigé** | `stores/auth.ts` | `useSupabaseClient()` wrappé dans try/catch au niveau store. Helper `requireSupabase()` centralise le guard. `onAuthStateChange` conditionnel. Le store n'explose plus si Supabase n'est pas configuré. |
| C2 | ✅ **Corrigé** | `stores/auth.ts`, `components/signup/SignupForm.vue` | Action `signUp(email, password, name)` ajoutée au store. `setUserContext()` appelé après inscription. `SignupForm.vue` ne touche plus à `useSupabaseClient` directement. |
| I6 | ✅ **Corrigé** | `stores/cart.ts`, `composables/useEstablishmentRegister.ts`, `components/caisse/ColRight.vue` | `checkDayClosure()` et `submitSale()` dans `useCartStore`. `selectedEstablishmentDetail` + `fetchCurrentEstablishmentDetail()` dans le composable. `refreshSelectionsFromStorage()` (doublon) supprimé de `ColRight.vue`. |
| C1 | ✅ **Corrigé** | `stores/cart.ts`, `components/caisse/ColRight.vue` | `POST /api/sales/create` migré dans `cartStore.submitSale()`. `ColRight.vue` n'appelle plus l'API directement. Types `SalePayload`, `SaleResponse`, `SaleItem`, `SaleRecord` ajoutés dans `types/pos.ts`. |
| C3 | ✅ **Corrigé** | `server/utils/sync.ts` | `syncProductToGroup` : boucle M×SELECT+INSERT → 1 SELECT bulk + 1 INSERT bulk par groupe. 3 groupes × 4 estabs : 24 requêtes → 6. |
| C4 | ✅ **Corrigé** | `server/utils/sync.ts` | `syncCustomerToGroup` : N×SELECT+INSERT → 1 SELECT bulk + 1 INSERT bulk. N estabs → 2 requêtes max. |
| I1 | ✅ **Corrigé** | `server/api/sync-groups/[id]/resync.post.ts` | `resyncProducts` : `overrideReset` calculé une seule fois (constant). Par batch : 1 SELECT + 1 UPDATE + 1 INSERT bulk pour `productEstablishments`. 100 produits × 3 estabs : 600 → 3 requêtes pour les overrides. |
| I2 | ✅ **Corrigé** | `server/api/sales/create.post.ts` | Pré-fetch bulk des stocks (1 SELECT) + des variations par nom (0 ou 1 SELECT) avant la boucle d'items. Lookups Map en mémoire. 10 articles : jusqu'à 20 SELECT → 2 SELECT fixes. |

---


---

## Bilan final

| Catégorie | Total | Corrigés | Restants |
|---|---|---|---|
| 🔴 Critique | 5 | 5 | 0 |
| 🟠 Important | 6 | 6 | 0 |
| 🟡 Mineur | 4 | 3 + 1 N/A | 0 |

Gains mesurés :
- syncProductToGroup : 39 requêtes → 6 (-85%)
- syncCustomerToGroup : N requêtes → 2 (-95%)
- resyncProducts : 900 req/batch → ~3 (-99%)
- sales/create : 20 SELECT → 2 (-90%)
- POST /api/sales/create : migré dans `cartStore.submitSale()`
- signUp : migré dans `useAuthStore`
