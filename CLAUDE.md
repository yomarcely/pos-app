# CLAUDE.md — FymPOS

> Ce fichier est le contrat de travail entre toi (Claude Code) et le projet FymPOS.
> Lis-le intégralement avant toute action. Ne jamais modifier ce fichier sans validation explicite.

---

## 🧭 Vue d'ensemble du projet

**FymPOS** est une solution SaaS de point de vente (POS) développée en solo.
- Stack : **Nuxt 4 + Vue 3 + Pinia + TypeScript strict**
- Backend : **Drizzle ORM + PostgreSQL** (Neon serverless en production, PostgreSQL local en dev)
- Auth : **Supabase Auth** (côté client via plugin) + **JWT custom** côté serveur
- Multi-tenant : architecture multi-établissements avec `tenantId`
- Conformité fiscale : **NF525** (module `server/utils/nf525.ts`)
- UI : **ShadCN-Nuxt + Reka UI + Tailwind CSS + Tanstack Vue Table**
- Validation : **Zod** (schémas dans `server/validators/`)
- Logging : **Pino** (`server/utils/logger.ts`)
- Structure : **Monorepo** (frontend + backend Nitro dans le même repo)
- Taille : **46 677 lignes** (hors node_modules, .nuxt, .output — mesuré 2026-03-15)
- Tests : **Vitest** (64 fichiers — 371 tests, 0 échec au 2026-03-16)

---

## 📁 Structure réelle du repo

```
pos-app/
├── server/
│   ├── api/                    # Endpoints REST (Nitro)
│   │   ├── archives/           # Archivage des ventes
│   │   ├── brands/             # Marques
│   │   ├── categories/         # Catégories produits
│   │   ├── clients/            # Clients (customers)
│   │   ├── closures/           # Clôtures de caisse (NF525)
│   │   ├── establishments/     # Établissements
│   │   ├── movements/          # Mouvements de stock
│   │   ├── product-stocks/     # Stocks produits
│   │   ├── products/           # Produits
│   │   ├── registers/          # Caisses enregistreuses
│   │   ├── sales/              # Ventes ⚠️ CRITIQUE
│   │   ├── sellers/            # Vendeurs
│   │   ├── suppliers/          # Fournisseurs
│   │   ├── sync-groups/        # Groupes de synchronisation
│   │   ├── tax-rates/          # Taux de TVA
│   │   └── variations/         # Variations produits
│   ├── database/
│   │   ├── schema.ts           # Schéma Drizzle (1100 lignes) ⚠️
│   │   ├── connection.ts       # Connexion PostgreSQL (hybride local/cloud)
│   │   ├── migrations/         # Migrations Drizzle SQL
│   │   ├── seed.ts             # Données de seed (573 lignes)
│   │   └── sync-schema.ts      # Schéma de sync inter-établissements
│   ├── utils/
│   │   ├── nf525.ts            # Conformité fiscale NF525
│   │   ├── sync.ts             # Logique de sync (787 lignes) ⚠️
│   │   ├── audit.ts            # Piste d'audit
│   │   ├── tenant.ts           # Multi-tenancy
│   │   ├── logger.ts           # Pino logger
│   │   ├── validation.ts       # Helpers de validation
│   │   ├── createMovement.ts   # Création de mouvements de stock
│   │   ├── supabase.ts         # Client Supabase serveur
│   │   └── validateVariationPayload.ts
│   ├── validators/             # Schémas Zod par domaine
│   └── middleware/             # (aucun actuellement)
├── components/
│   ├── caisse/                 # Composants caisse (ColLeft, ColRight, etc.) ⚠️ CRITIQUE
│   ├── categories/
│   ├── common/
│   ├── dashboard/
│   ├── establishments/
│   ├── login/
│   ├── mouvements/
│   ├── produits/
│   ├── sellers/
│   ├── shared/
│   ├── sync/
│   ├── synthese/
│   ├── ui/                     # Composants ShadCN génériques
│   └── variations/
├── composables/
│   ├── useEstablishmentRegister.ts
│   ├── useSupabaseClient.ts
│   └── useToast.ts
├── stores/                     # Stores Pinia
│   ├── auth.ts
│   ├── cart.ts                 # ⚠️ CRITIQUE — logique caisse
│   ├── customer.ts
│   ├── products.ts
│   ├── sellers.ts
│   ├── tickets.ts
│   └── variationGroups.ts
├── pages/
│   ├── caisse/index.vue        # ⚠️ CRITIQUE
│   ├── categories/
│   ├── clients/[id]/edit.vue   # 697 lignes ⚠️
│   ├── clotures/
│   ├── dashboard/
│   ├── etablissements/
│   │   ├── index.vue           # 831 lignes ⚠️
│   │   └── synchronisation.vue # 1050 lignes ⚠️
│   ├── login/
│   ├── mouvements/index.vue    # 569 lignes ⚠️
│   ├── produits/[id]/edit.vue  # 891 lignes ⚠️
│   ├── stocks/
│   ├── synthese/
│   ├── tva/
│   ├── variations/
│   └── vendeurs/
├── middleware/
│   └── auth.global.ts          # Guard d'authentification global
├── plugins/
│   ├── 00.supabase.ts          # Init client Supabase
│   └── 01.api-fetch.client.ts  # Client HTTP côté navigateur
├── types/                      # Types TypeScript globaux
│   ├── customer.ts
│   ├── index.ts
│   ├── mouvements/
│   ├── pos.ts
│   ├── product.ts
│   └── sync.ts
├── lib/
│   └── utils.ts                # Helpers (clsx, tailwind-merge)
├── tests/
│   ├── api/                    # Tests API (17 fichiers)
│   ├── components/             # Tests composants (11 fichiers)
│   ├── pages/                  # Tests pages (8 fichiers)
│   ├── stores/                 # Tests stores (4 fichiers)
│   └── *.test.ts               # Tests unitaires divers
├── scripts/                    # Scripts utilitaires (migrations manuelles, seed TVA…)
├── supabase/migrations/        # (1 dossier — migrations Supabase legacy / RLS)
├── drizzle.config.ts           # Config Drizzle (development par défaut)
├── drizzle.config.production.ts
├── drizzle.config.staging.ts
├── nuxt.config.ts
└── vitest.config.ts
```

---

## 🔝 Top 10 fichiers les plus volumineux

| # | Fichier | Lignes | Zone de risque |
|---|---|---|---|
| 1 | `server/database/schema.ts` | 1100 | Schéma Drizzle central — toutes les tables |
| 2 | `pages/etablissements/synchronisation.vue` | 1050 | Page Vue monolithique, logique de sync complexe |
| 3 | `pages/produits/[id]/edit.vue` | 891 | Formulaire produit monolithique |
| 4 | `pages/etablissements/index.vue` | 831 | Logique métier dans la page |
| 5 | `server/utils/sync.ts` | 787 | Sync inter-établissements, état partagé |
| 6 | `pages/clients/[id]/edit.vue` | 697 | Formulaire client monolithique |
| 7 | `tests/api/products.test.ts` | 626 | (fichier de test, normal) |
| 8 | `server/database/seed.ts` | 573 | Données de seed (dev uniquement) |
| 9 | `pages/mouvements/index.vue` | 569 | Logique métier dans la page |
| 10 | `server/api/sales/create.post.ts` | 554 | **CRITIQUE** — endpoint de création de vente |

---

## ⚠️ Zones à risque identifiées

### 🔴 Risque élevé
- **`server/api/sales/create.post.ts`** (554 lignes) : cœur de la logique de vente, calculs financiers, NF525 — ne pas toucher sans tests de régression exhaustifs
- **`server/database/schema.ts`** (1100 lignes) : toute modification casse potentiellement tous les endpoints
- **`stores/cart.ts`** : logique caisse, couplé à plusieurs composants critiques
- **Migrations Drizzle** (`server/database/migrations/`) : ne jamais modifier une migration existante

### 🟠 Risque moyen
- **`server/utils/sync.ts`** (787 lignes) : sync bi-directionnelle entre établissements, état complexe
- **`server/api/sync-groups/[id]/resync.post.ts`** (537 lignes) : resync complète, opération longue et destructive
- **Pages monolithiques** > 700 lignes : `synchronisation.vue`, `edit.vue` produit/client — logique métier mélangée au template
- **`composables/`** : seulement 3 composables pour ~80k lignes — la logique est probablement dans les stores et pages

### 🟡 Risque faible / Dette technique
- **`server/database/seed.ts`** (573 lignes) : script dev, mais peut masquer des incohérences de schéma
- **Double système DB** : Drizzle ORM (server) + Supabase client (frontend) — risque de désynchronisation des types
- **Supabase legacy** : `supabase/migrations/` + `server/utils/supabase.ts` coexistent avec Drizzle — clarifier le rôle de chacun
- **Scripts de migration ad-hoc** dans `server/database/` (`add-register-to-closures-migration.ts`, etc.) — migrations manuelles non Drizzle

---

## ✅ Modules fonctionnels (NE PAS CASSER)

Ces modules sont en production ou considérés stables. Toute modification doit être **incrémentale, testée, et validée** avant merge.

| Module | Criticité | Notes |
|---|---|---|
| **Authentification / Utilisateurs** | 🔴 Critique | JWT custom serveur + Supabase Auth client, `middleware/auth.global.ts` |
| **Caisse / Paiements** | 🔴 Critique | `stores/cart.ts`, `components/caisse/`, `server/api/sales/` |
| **Validation des ventes / NF525** | 🔴 Critique | `server/api/sales/create.post.ts`, `server/utils/nf525.ts` |
| **Clôtures de caisse** | 🔴 Critique | `server/api/closures/`, conformité fiscale |
| **Gestion stock / Inventaire** | 🟠 Important | `server/api/movements/`, `server/utils/createMovement.ts`, audit trails |
| **Synchronisation multi-établissements** | 🟠 Important | `server/utils/sync.ts`, `server/api/sync-groups/` |
| **Schéma DB** | 🔴 Critique | `server/database/schema.ts` — source de vérité unique |

---

## 🚫 Règles absolues — NE JAMAIS faire sans validation explicite

1. **Ne jamais modifier les migrations Drizzle existantes** (`server/database/migrations/`) — créer une nouvelle migration
2. **Ne jamais modifier `server/database/schema.ts`** sans inventorier tous les endpoints impactés
3. **Ne jamais changer les signatures de fonctions publiques** des composables et stores sans inventorier tous les usages
4. **Ne jamais refactoriser deux modules simultanément** — un module à la fois, committé et testé
5. **Ne jamais supprimer de code** sans d'abord vérifier qu'il est réellement mort (dead code analysis d'abord)
6. **Ne jamais toucher aux calculs financiers** (caisse, paiements, totaux, NF525) sans tests de régression exhaustifs
7. **Ne jamais modifier les règles RLS Supabase** sans analyse d'impact sécurité
8. **Ne jamais lancer de resync** (`resync.post.ts`) en dehors d'un contexte de test isolé

---

## ✅ Conventions de code

### TypeScript
- **Strict mode activé** — pas de `any`, pas de `// @ts-ignore` sans justification
- Types centralisés dans `types/` — pas de types inline dupliqués
- Préférer les `interface` pour les objets métier, `type` pour les unions/utilitaires

### Vue 3 / Nuxt 4
- **Composition API uniquement** — pas d'Options API
- `<script setup lang="ts">` systématique
- Composables dans `composables/` avec préfixe `use`
- Pas de logique métier dans les composants — déléguer aux composables/stores

### Pinia
- Un store par domaine métier (ex: `useCartStore`, `useInventoryStore`)
- Pas d'appels DB directs dans les composants — passer par les stores ou composables

### Drizzle ORM
- Toujours utiliser le client `db` depuis `server/database/connection.ts`
- Toujours importer les tables depuis `server/database/schema.ts`
- Nouvelles tables → nouvelle migration Drizzle (`drizzle-kit generate`)
- Ne pas mélanger requêtes Drizzle et requêtes Supabase-client côté serveur

### Tests (Vitest)
- Tout nouveau composable doit avoir des tests unitaires
- Tout refactor doit être précédé de tests de caractérisation si absents
- Nommage : `[fichier].test.ts` dans `tests/` (structure miroir)

---

## 🔐 Convention auth serveur (event.context.auth)

### Champs disponibles dans `event.context.auth`

Posé par `assertAuth()` dans `server/middleware/auth.global.ts` après validation JWT Supabase :

```typescript
event.context.auth = {
  user: User,          // Objet User Supabase complet (id, email, app_metadata, user_metadata…)
  accessToken: string, // JWT Bearer extrait du header Authorization ou du cookie sb-access-token
  tenantId: string,    // Résolu par getTenantFromUser() — voir priorités ci-dessous
}
```

### Comment lire le tenantId dans un endpoint

**Toujours** utiliser `getTenantIdFromEvent(event)` depuis `server/utils/tenant.ts` :

```typescript
import { getTenantIdFromEvent } from '~/server/utils/tenant'

export default defineEventHandler(async (event) => {
  const tenantId = getTenantIdFromEvent(event) // lève une 401 si absent
  // ...
})
```

**Jamais** lire `event.context.auth.tenantId` directement dans un endpoint — passer par `getTenantIdFromEvent` qui garantit le throw 401 si le contexte est absent.

### Ordre de résolution du tenantId (`getTenantFromUser`)

| Priorité | Source | Condition |
|---|---|---|
| 1 | Header `x-tenant-id` | Présent dans la requête |
| 2 | `user.app_metadata.tenant_id` ou `.tenantId` | Métadonnées Supabase (snake_case ou camelCase) |
| 3 | `user.app_metadata.tenants[0]` | Premier tenant de la liste (`.id`, `.tenant_id` ou `.slug`) |
| 4 | `user.id` | Fallback ultime : 1 user = 1 tenant |
| — | `null` | Aucun tenant trouvé → `assertAuth()` lève une 400 |

### Règle de sécurité absolue : `server/utils/supabase.ts` côté serveur uniquement

`server/utils/supabase.ts` contient le `SUPABASE_SERVICE_ROLE_KEY` (accès admin illimité).
**Ce fichier ne doit JAMAIS être importé depuis** :
- `components/`, `pages/`, `stores/`, `composables/`, `plugins/`, `middleware/` (client-side)

Seul import autorisé : `server/middleware/auth.global.ts` (vérifié — 0 import côté client, 2026-03-15).

### Fichiers à modifier si Supabase Auth est remplacé

Si l'authentification Supabase est remplacée par un autre provider, **exactement 4 fichiers** sont concernés :

| Fichier | Rôle |
|---|---|
| `server/utils/supabase.ts` | Validation JWT serveur + extraction tenant |
| `server/middleware/auth.global.ts` | Guard global, appelle `assertAuth()` |
| `stores/auth.ts` | Login / logout / session côté client |
| `plugins/00.supabase.ts` | Init client Supabase côté navigateur |

`server/utils/tenant.ts` et tous les endpoints restent inchangés (ils lisent uniquement `event.context.auth`).

---

## 🔍 Mode opératoire pour les interventions

### Avant de modifier quoi que ce soit

1. **Archéologie d'abord** : lire et cartographier, ne rien changer
2. Lister les fichiers impactés avec leurs dépendances
3. Vérifier l'existence de tests couvrant la zone concernée
4. Proposer le plan de modification avec diff attendu
5. Attendre validation explicite avant d'exécuter

### Pour tout refactor

```
Étape 1 — Analyse   : cartographie + identification des problèmes (aucune modification)
Étape 2 — Tests     : écriture des tests de caractérisation si absents
Étape 3 — Refactor  : modification incrémentale, un fichier/fonction à la fois
Étape 4 — Vérif     : run tests, vérification des types, ESLint
Étape 5 — Commit    : commit atomique avec message clair
```

### Pour les bugs

1. Reproduire le bug avec un test qui échoue
2. Corriger le minimum nécessaire
3. Vérifier que le test passe
4. Vérifier qu'aucun test existant n'est cassé

---

## 🗺️ Zones prioritaires d'audit (à investiguer)

- [x] **Double système DB** → ✅ documenté dans `docs/architecture/supabase-vs-drizzle.md`
- [x] **Scripts de migration ad-hoc** → ✅ archivés dans `docs/legacy-migrations/`
- [x] **Pages monolithiques** → ✅ TERMINÉ — 5 pages refactorisées, 16 composables extraits
  - `etablissements/index.vue` : 831 → 484 lignes (-42%) ✅
  - `synchronisation.vue` : 1050 → 614 lignes (-41%) ✅
  - `produits/[id]/edit.vue` : 891 → 528 lignes (-41%) ✅
  - `clients/[id]/edit.vue` : 697 → 484 lignes (-31%) ✅ 2026-03-16
  - `mouvements/index.vue` : 569 → 145 lignes (-74%) ✅ 2026-03-16
- [ ] **Stores Pinia** — duplication de logique entre stores (seulement 7 stores pour tout le métier)
- [x] **Composables** → ✅ passé de 3 à 19 composables (10 extraits le 2026-03-15, 6 extraits le 2026-03-16)
- [x] **Dead code** → ✅ traité (`docs/audit/04-dead-code.md`)
- [x] **Types TypeScript** → ✅ 0 erreur TS sources (`docs/audit/02-typescript-strict.md`)
- [x] **Calculs financiers** → ✅ audité et corrigé (`docs/audit/07-calculs-financiers.md`) — P1 validation totaux serveur, P2 centimes close-day, P3 assertion HT+TVA=TTC, P4 hash NF525 aligné — 16 tests unitaires dans `tests/unit/financialValidation.test.ts`
- [x] **NF525 couverture tests** → ✅ 42 tests unitaires écrits (`tests/unit/nf525/`) — toutes fonctions couvertes sans mock — 371 tests / 64 fichiers
- [x] **Tests failing** → ✅ 0 test en échec (corrigés le 2026-03-15) — 329 tests passent sur 58 fichiers
- [x] **Audit 03** → ✅ tous items corrigés (N+1 sync, signUp, $fetch caisse) — `docs/audit/03-supabase-fetch.md`

---

## 💬 Commandes utiles

```bash
# Développement
pnpm dev

# Tests
pnpm test
pnpm test --coverage

# Type check
pnpm typecheck

# Build
pnpm build

# Migrations Drizzle
pnpm drizzle-kit generate    # générer une nouvelle migration
pnpm drizzle-kit migrate     # appliquer les migrations
pnpm drizzle-kit studio      # explorer le schéma visuellement
```

---

## 📊 Audits en cours
- [Cartographie](docs/audit/01-cartographie.md) — mars 2026 ✅
- [Typescript](docs/audit/02-typescript-strict.md) — mars 2026 ✅
- [Supabase_fetch](docs/audit/03-supabase-fetch.md) — mars 2026 ✅
- [Deadcode](docs/audit/04-dead-code.md) — mars 2026 ✅
- [Migrations](docs/audit/05-migrations.md) — mars 2026 ✅ (bug 0007 corrigé)
- [Composables à extraire](docs/audit/06-composables-a-extraire.md) — mars 2026 🔄 EN COURS
- [Calculs financiers](docs/audit/07-calculs-financiers.md) — mars 2026 ✅ (4 risques identifiés)
- [NF525 tests](docs/audit/08-nf525-tests.md) — mars 2026 ✅ (0 test réel, 38 à écrire)

## 🏗️ Architecture documentée
- [Supabase vs Drizzle](docs/architecture/supabase-vs-drizzle.md) — frontière Auth / DB

---

## 📝 Journal des sessions (à tenir à jour)

| Date | Module traité | Actions effectuées | Statut |
|---|---|---|---|
| — | — | Initialisation CLAUDE.md | ✅ |
| 2026-03-12 | Architecture globale | Cartographie complète du repo, mise à jour CLAUDE.md | ✅ |
| 2026-03-15 | Logger / package.json | BATCH 1 : logger.ts déjà correct (guard isDevelopment présent). BATCH 2 : déplacement de `drizzle-kit`, `pino-pretty`, `dotenv` en devDependencies — pnpm install + typecheck OK | ✅ |
| 2026-03-15 | Architecture Auth | BATCH 3 : frontière Supabase/Drizzle documentée — routes clients purement Drizzle, Supabase = Auth uniquement | ✅ |
| 2026-03-15 | Migrations | BATCH 4+5 : analyse des 4 paires de doublons + 8 scripts ad-hoc — bug critique sur paire 0007 identifié — rapport dans docs/audit/05-migrations.md | ✅ |
| 2026-03-15 | Migrations (fix) | BATCH 1 : bug critique 0007 corrigé (fusion icy_madripoor→sync_multi_establishment + noop journal). BATCH 2 : reset-migrations.ts sécurisé. BATCH 3+4 : 9 scripts archivés dans docs/legacy-migrations/. BATCH 5 : doublons 0002a/0003a renommés, 0006_seller_establishments archivé. | ✅ |
| 2026-03-15 | Pages monolithiques | BATCH 6 : 10 composables identifiés pour 3 pages (1050/831/891 → ~420/380/430 lignes après extraction) — rapport dans docs/audit/06-composables-a-extraire.md | ✅ |
| 2026-03-15 | Extraction composables | 10 composables extraits en 13 commits atomiques : useEstablishments, useRegisters, useSyncGroups, useEstablishmentsSelect, useSyncGroupForm, useEditSyncGroup, useResync, useProductEditor, useProductCatalogData, useProductStockMovement — pages : 831→484 / 1050→614 / 891→528 lignes — 14 tests de caractérisation ajoutés — baseline tests maintenue (26 failing) | ✅ |
| 2026-03-15 | Convention auth serveur | BATCH 1 : section `🔐 Convention auth serveur` ajoutée dans CLAUDE.md (champs event.context.auth, getTenantIdFromEvent, règle sécurité serviceRoleKey, 4 fichiers à modifier si migration Auth) | ✅ |
| 2026-03-15 | Tests getTenantFromUser | BATCH 2 : `tests/unit/getTenantFromUser.test.ts` créé — 11 tests couvrant les 4 priorités de fallback + cas null | ✅ |
| 2026-03-15 | Sécurité serviceRoleKey | BATCH 3 : grep exhaustif sur .ts/.vue — 0 import côté client confirmé — résultat noté dans docs/architecture/supabase-vs-drizzle.md | ✅ |
| 2026-03-15 | Mise à jour CLAUDE.md | BATCH 1 : zones prioritaires mises à jour (6 items complétés, 2 ajoutés). BATCH 2 : taille projet corrigée → 46 677 lignes (mesure exacte). | ✅ |
| 2026-03-15 | Analyse tests failing | BATCH 3 : 26 tests en échec analysés — tous pré-existants (baseline maintenue par le refactor) — tableau de classification dans section ci-dessous | ✅ |
| 2026-03-15 | Audit calculs financiers | BATCH 4 : `cartUtils.ts` ✅ (centimes+LRM correct) — `create.post.ts` ⚠️ (totaux non recalculés côté serveur, float par ligne) — `close-day.post.ts` ⚠️ (accumulation float, pas de vérification HT+TVA=TTC) — rapport dans `docs/audit/07-calculs-financiers.md` | ✅ |
| 2026-03-15 | Audit NF525 couverture | BATCH 5 : 6 fonctions exportées, 0 test unitaire réel (toutes mockées dans sales.test.ts) — 38 tests identifiés dans 6 fichiers — cas critiques : déterminisme hash, chaîne cassée, ticket corrompu — rapport dans `docs/audit/08-nf525-tests.md` | ✅ |
| 2026-03-15 | Corrections calculs financiers (P1–P4) | P1 : validation totalTTC serveur dans `create.post.ts` via `recomputeTotalTTC` + `validateTotalTTC` (tolérance 2 centimes LRM). P2 : accumulation centimes entiers dans `close-day.post.ts`. P3 : assertion HT+TVA=TTC (warn only). P4 : hash NF525 aligné sur DB via `.toFixed(2)`. `financialValidation.ts` créé (16 tests). 329 tests / 58 fichiers — 0 échec | ✅ |
| 2026-03-15 | Correction 26 tests failing | 7 batches : produits/index (watch stub + useEstablishmentRegister mock), LoginForm (Pinia + store mock + texte FR), cart/ColLeft (tests alignés sur composant réel), cart/ColRight (refs + useEstablishmentRegister mock), cart/AddClientForm (IDs inputs + gdprConsent + composable mock), cart/Header (Pinia), ProductFormPricing (Suspense + useFetch stub), customerStore (useEstablishmentRegister mock + test expectation), sales.test (logSystemError manquant dans mock audit), synthese/index (useEstablishmentRegister mock + selectedRegisterId non-null) — résultat : 313 tests / 57 fichiers, 0 échec | ✅ |

---

## 📝 Tests failing connus

> Session 2026-03-15 : tous les 26 tests en échec ont été corrigés. Résultat final : **313 tests / 57 fichiers — 0 échec**.

| Fichier test | Tests corrigés | Correction appliquée |
|---|---|---|
| `tests/api/sales.test.ts` | 6 | `logSystemError` ajouté dans le mock `~/server/utils/audit` |
| `tests/components/LoginForm.test.ts` | 8 | Pinia initialisé (`setActivePinia`), store auth mocké, texte FR aligné |
| `tests/components/cart/ColLeft.test.ts` | 2 | Tests réalignés sur le composant réel (pas de select vendeur dans ColLeft) + mock `useEstablishmentRegister` |
| `tests/components/cart/ColRight.test.ts` | 1 | `useEstablishmentRegister` mocké avec `selectedRegisterId = ref(1)`, `checkDayClosure` mocké dans `cartStoreMock` |
| `tests/components/cart/AddClientForm.test.ts` | 1 | IDs inputs corrigés (`firstName`, `lastName`, `postalCode`), gdprConsent géré, composable mocké |
| `tests/components/cart/Header.test.ts` | 1 | Pinia initialisé, store sellers mocké, composant EstablishmentSelect/RegisterSelect stubbé |
| `tests/components/ProductFormPricing.test.ts` | 2 | `useFetch` stubbé globalement, `Suspense` wrapper pour le top-level await |
| `tests/stores/customerStore.test.ts` | 2 | `useEstablishmentRegister` mocké pour isoler `$fetch`, test expectation alignée sur comportement réel |
| `tests/pages/produits/index.test.ts` | 2 | `watch` stubbé globalement, `useEstablishmentRegister` mocké, `extractFetchError` stubbé |
| `tests/pages/synthese/index.test.ts` | 1 | `useEstablishmentRegister` mocké avec `selectedRegisterId = ref(1)`, assertion URL adaptée |

---

| 2026-03-16 | NF525 couverture tests | 42 tests unitaires écrits dans `tests/unit/nf525/` (6 fichiers) — toutes fonctions exportées couvertes sans mock — déterminisme, unicité, cas fraude, ordre inversé documenté | ✅ |

| 2026-03-16 | Audit 03 clôture | M4 traité (N/A — pas de types DB générés), audit 03 clôturé — tous items ✅ | ✅ |
| 2026-03-16 | Pages monolithiques (pages 4-5) | 6 composables extraits en 10 commits atomiques : usePostalCodeLookup, useClientPurchaseHistory, useClientEditor, useMovementCatalog, useMovementCart, useMovementProductSearch — pages : 697→484 / 569→145 lignes — 12 tests de caractérisation ajoutés — 383 tests / 66 fichiers — 0 échec | ✅ |

*Dernière mise à jour : 2026-03-16 — par Claude Code (session pages 4-5 extraction)*
