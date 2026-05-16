# codebase_index.md — FymPOS

> Index structurel du repo. Généré par inspection fichier par fichier (pas d'inférence).
> Toute ligne cite le chemin réel du fichier. Les effectifs de lignes sont mesurés via `wc -l` au 2026-04-22.

---

## 0. Chiffres clés (mesurés)

| Métrique | Valeur |
|---|---|
| Fichiers source (`.ts`/`.vue`/`.js`, hors node_modules/.nuxt/.output) | **556** |
| Fichiers TS serveur (`server/**/*.ts`) | 109 |
| Composants Vue (`components/**/*.vue`) | 245 (dont ~173 dans `components/ui/` shadcn) |
| Pages Nuxt (`pages/**/*.vue`) | 23 |
| Stores Pinia (`stores/*.ts`) | 7 |
| Composables (`composables/*.ts`) | 23 |
| Tests Vitest (`tests/**/*.ts`) | 67 |
| Migrations Drizzle (`server/database/migrations/*.sql`) | 12 |

---

## PHASE 1 — CARTOGRAPHIE PAR MODULE

### 1.1 Racine / config

| Fichier | Rôle |
|---|---|
| [package.json](package.json) | Dépendances Nuxt 4 / Vue 3.5 / Drizzle 0.44 / Supabase / Pinia / Zod / Pino / shadcn-nuxt |
| [nuxt.config.ts](nuxt.config.ts) (128 l.) | Modules Nuxt, runtimeConfig (supabase/db/nf525/rgpd), CSP + headers sécurité, config shadcn |
| [tsconfig.json](tsconfig.json) / [tsconfig.test.json](tsconfig.test.json) / [server/tsconfig.json](server/tsconfig.json) | Config TS (strict mode, tests override) |
| [vitest.config.ts](vitest.config.ts) / [vitest.d.ts](vitest.d.ts) | Config Vitest |
| [eslint.config.js](eslint.config.js) | Config ESLint 9 (flat config) |
| [components.json](components.json) | Config shadcn-nuxt |
| [drizzle.config.ts](drizzle.config.ts) + 3 variantes (`development`/`staging`/`production`) | Config drizzle-kit (génère/applique migrations) |

### 1.2 Serveur — `server/`

#### `server/database/`
| Fichier | Lignes | Rôle |
|---|---|---|
| [schema.ts](server/database/schema.ts) | **1101** | Schéma Drizzle — 21 tables (sales, saleItems, categories, variationGroups, variations, suppliers, brands, taxRates, products, customers, sellers, sellerEstablishments, establishments, registers, movements, stockMovements, auditLogs, closures, archives, syncGroups, syncGroupEstablishments, syncRules, productStocks, productEstablishments, customerEstablishments, syncLogs) + relations |
| [connection.ts](server/database/connection.ts) | 85 | Client `postgres-js` avec détection Supabase pooler (session 5432 / transaction 6543), SSL auto, timeouts adaptés |
| [seed.ts](server/database/seed.ts) + [seed-data.ts](server/database/seed-data.ts) | ~573 | Seed dev (RUN_SEED=1). `seed-data.ts` = nouveau split (non documenté dans CLAUDE.md) |
| [sync-schema.ts](server/database/sync-schema.ts) | ? | Schéma auxiliaire pour sync |
| [migrations/*.sql](server/database/migrations/) | 12 fichiers | 0000→0011. **Doublons 0007** (`icy_madripoor.sql` + `sync_multi_establishment.sql`) et **0010** (`add_establishment_tracking.sql` + `striped_ares.sql`) — CLAUDE.md indique le bug 0007 résolu via noop journal |
| [migrations/schema.ts](server/database/migrations/schema.ts) + [migrations/relations.ts](server/database/migrations/relations.ts) | | Schéma reverse-engineered par drizzle-kit (non utilisé par le runtime) |

#### `server/middleware/`
| Fichier | Rôle |
|---|---|
| [auth.global.ts](server/middleware/auth.global.ts) (47 l.) | Guard Nitro : skip `/api/login`/`/api/auth`/`/api/database/seed` et non-`/api`. Appelle `assertAuth()` sinon. Bypass optionnel via `ALLOW_AUTH_BYPASS=true` en dev uniquement |

#### `server/utils/`
| Fichier | Lignes | Rôle |
|---|---|---|
| [supabase.ts](server/utils/supabase.ts) | 92 | `supabaseServerClient` (service_role), `getAccessTokenFromEvent` (header/cookie), `getTenantFromUser` (4 priorités), `assertAuth` (pose `event.context.auth`). **À ne JAMAIS importer côté client** |
| [tenant.ts](server/utils/tenant.ts) | 44 | `getTenantIdFromEvent(event)` — lève 401 si absent. `getTenantId()` fallback sur `config.public.defaultTenantId` (500 sinon) |
| [nf525.ts](server/utils/nf525.ts) | 259 | `generateTicketHash` (SHA-256 sur ticket+prev+items+payments), `generateTicketNumber` (YYYYMMDD-Exx-Ryy-NNNNNN), `verifyTicketIntegrity`, `verifyTicketChain`, `generateArchiveHash`, `generateTicketSignature` (stub INFOCERT) |
| [sync.ts](server/utils/sync.ts) | **800** | Filtre les champs prod/clients selon `syncRules` du groupe de l'établissement, propagation cross-établissements. **Ligne 102** : prend le 1er groupe → hypothèse mono-groupe par établissement |
| [audit.ts](server/utils/audit.ts) | 270 | `AuditEventType` enum (17 événements), `logAuditEvent`, helpers `logSaleCreation`, `logSystemError`, `logClosureCreation`, `logClosureAttemptFailed`, `logChainVerification` |
| [createMovement.ts](server/utils/createMovement.ts) | 59 | Helper de création de mouvement de stock (encapsule 2 inserts : `movements` + `stockMovements`) |
| [validation.ts](server/utils/validation.ts) | 80 | `validateBody<T>(event, zodSchema)` / `validateQuery<T>` — wraps `ZodError` en 400 |
| [validateVariationPayload.ts](server/utils/validateVariationPayload.ts) | 128 | Validation spécifique payload variations |
| [financialValidation.ts](server/utils/financialValidation.ts) | 55 | `recomputeTotalTTC` (centimes), `validateTotalTTC` (tol. 2¢ LRM), `assertHTplusTVAequalsTTC` (warn-only) — voir audit 07 |
| [logger.ts](server/utils/logger.ts) | 52 | Pino avec guard `isDevelopment` (pino-pretty) |

#### `server/validators/` (Zod)
11 schémas, 1 par domaine : [brand](server/validators/brand.schema.ts), [category](server/validators/category.schema.ts), [customer](server/validators/customer.schema.ts), [establishment](server/validators/establishment.schema.ts), [product](server/validators/product.schema.ts), [register](server/validators/register.schema.ts), [sale](server/validators/sale.schema.ts), [seller](server/validators/seller.schema.ts), [supplier](server/validators/supplier.schema.ts), [sync](server/validators/sync.schema.ts), [tax-rate](server/validators/tax-rate.schema.ts), [variation](server/validators/variation.schema.ts).

#### `server/api/` — 109 endpoints

Regroupés par domaine. Fichiers `index.get.ts`, `create.post.ts`, `[id].get/put/delete.ts`, `[id]/update.patch.ts`, etc. **CRITIQUES** en gras.

| Domaine | Endpoints notables |
|---|---|
| `archives/` | create.post, index.get |
| `brands/` | create.post, index.get |
| `categories/` | create.post, index.get, `[id]/update.patch`, `[id]/delete.delete` |
| `clients/` | index.get/post, `[id].get/put/delete`, `[id]/purchases.get`, `[id]/stats.get`, **`[id]/anonymize.post`** (RGPD) |
| `closures/` | index.get |
| `database/` | `seed.post` (public ! voir PUBLIC_ENDPOINTS) |
| `establishments/` | create.post, index.get, `[id]/index.get`, `[id]/update.patch`, `[id]/delete.delete` |
| `movements/` | create.post |
| `product-stocks/` | index.get, update.post |
| `products/` | **create.post, `[id].get/put`**, update-stock.post, stock-movements.get, `stock-movements/[id].delete`, `[id]/delete.delete`, `[id]/archive.post`, `[id]/unarchive.post`, `[id]/stock-history.get`, `[id]/duplicate.post` |
| `registers/` | create.post, index.get |
| `sales/` | **`create.post`** (587 l.), **`close-day.post`**, daily-summary.get, closures.get, check-closure.get, verify-chain.get, `[id]/cancel.post` |
| `sellers/` | create.post, index.get, `[id]/update.patch`, `[id]/establishments.get`, `[id]/delete.delete` |
| `suppliers/` | create.post, index.get, `[id]/update.patch`, `[id]/delete.delete` |
| `sync-groups/` | create.post, index.get, `[id]/index.get`, `[id]/delete.delete`, **`[id]/resync.post`** (537 l., destructif), `[id]/rules.patch`, `[id]/establishments.patch` |
| `tax-rates/` | create.post, index.get |
| `variations/` | create.post, index.get, groups.get, groups/create.post, `[id]/update.patch` |

### 1.3 Client — frontend

#### `pages/` (23)
| Fichier | Lignes | Rôle |
|---|---|---|
| [pages/caisse/index.vue](pages/caisse/index.vue) | 74 | Coquille caisse (composition ColLeft + ColMiddle + ColRight + Header + ShortcutBoard) |
| [pages/dashboard/index.vue](pages/dashboard/index.vue) | 174 | Dashboard principal |
| [pages/etablissements/synchronisation.vue](pages/etablissements/synchronisation.vue) | **614** | Config groupes de sync (plus grosse page, refactorisée 1050→614) |
| [pages/produits/[id]/edit.vue](pages/produits/[id]/edit.vue) | 542 | Édition fiche produit (délègue à `useProductEditor`) |
| [pages/clients/[id]/edit.vue](pages/clients/[id]/edit.vue) | 526 | Édition fiche client (délègue à `useClientEditor`) |
| [pages/etablissements/index.vue](pages/etablissements/index.vue) | 484 | Liste établissements + registres |
| [pages/produits/create.vue](pages/produits/create.vue) | 459 | Création produit |
| [pages/clients/create.vue](pages/clients/create.vue) | 442 | Création client |
| [pages/synthese/index.vue](pages/synthese/index.vue) | 386 | Synthèse ventes journalière |
| [pages/vendeurs/index.vue](pages/vendeurs/index.vue) | 362 | CRUD vendeurs |
| [pages/clotures/index.vue](pages/clotures/index.vue) | 350 | Liste clôtures NF525 |
| [pages/variations/index.vue](pages/variations/index.vue) | 336 | CRUD variations |
| [pages/stocks/index.vue](pages/stocks/index.vue) | 324 | Vue stock |
| [pages/categories/index.vue](pages/categories/index.vue) | 310 | CRUD catégories (arborescent) |
| [pages/tva/index.vue](pages/tva/index.vue) | 262 | CRUD taux de TVA |
| [pages/clients/index.vue](pages/clients/index.vue) | 260 | Liste clients |
| [pages/produits/index.vue](pages/produits/index.vue) | 258 | Liste produits (filtres marque/fournisseur/archivés) |
| [pages/fournisseurs/index.vue](pages/fournisseurs/index.vue) | 242 | CRUD fournisseurs |
| [pages/marques/index.vue](pages/marques/index.vue) | 203 | CRUD marques |
| [pages/dashboard/index.vue](pages/dashboard/index.vue) | 174 | Dashboard |
| [pages/mouvements/index.vue](pages/mouvements/index.vue) | 145 | Coquille mouvements (refactorisée 569→145) |
| [pages/index.vue](pages/index.vue) | 40 | Landing / redirect |
| [pages/login/index.vue](pages/login/index.vue) | 36 | Login |
| [pages/signup/index.vue](pages/signup/index.vue) | 17 | Signup (coquille) |

#### `components/` (245 total)

- **caisse/** (11) : `ColLeft` (294), `ColMiddle` (337), **`ColRight` (442, contient validation de vente)**, `CartItem` (275), `Header` (44), `StockAlerts` (157), `PendingCartForm` (117), `AddClientForm` (451), `ShortcutBoard` (380), `ShortcutCell` (77), `ShortcutConfigDialog` (429)
- **categories/** (1) : `CategoryTreeItem`
- **common/** (7) : ConfirmDialog, EmptyState, FormDialog, FymposLogo, LoadingSpinner, PageHeader
- **dashboard/** (5) : AppSidebar (260), NavMain, NavProjects, NavSecondary, NavUser
- **establishments/** (2) : EstablishmentCard (191), RegistersList (105)
- **landing/** (7) : sections Hero/Features/Problem/Target/Testimonials/CTA/Footer — nouvelle page marketing `/`
- **login/** (1), **signup/** (1) : formulaires auth
- **mouvements/** (3) : MovementTypeSelector, ProductCatalogDialog (172), SelectedProductsTable (181)
- **produits/** (6) : CategorySelector (168), CategorySelectorItem, ProductsEmptyState, ProductsGridView (146), ProductsTableView (139), ProductsSearchBar (166)
- **produits/form/** (5) : ProductFormGeneral (233), ProductFormPricing (235), ProductFormStock, ProductFormBarcode, ProductFormVariations
- **sellers/** (2) : SellerCard, EstablishmentMultiSelect
- **shared/** (4) : EstablishmentSelect, RegisterSelect, SellerSelect, ProductSearchWithSuggestions
- **sync/** (1) : RuleItem
- **synthese/** (2) : DailySummaryStats, SaleTicketItem
- **variations/** (1) : VariationGroupCard
- **ui/** (~173) : shadcn-nuxt + Reka UI wrappers (alert-dialog, avatar, badge, breadcrumb, button, card, checkbox, collapsible, combobox, context-menu, dialog, drawer, dropdown-menu, field, input, label, number-field, scroll-area, select, separator, sheet, sidebar, skeleton, sonner, spinner, stepper, switch, table, tabs, textarea, toast, toggle, tooltip)

#### `composables/` (23)
| Fichier | Lignes | Rôle |
|---|---|---|
| [useEstablishmentRegister.ts](composables/useEstablishmentRegister.ts) | 211 | **Central** : gère `selectedEstablishmentId` + `selectedRegisterId` partagés (state global au module) |
| [useEstablishments.ts](composables/useEstablishments.ts) | 247 | CRUD établissements + invalide `useEstablishmentRegister` |
| [useRegisters.ts](composables/useRegisters.ts) | 185 | CRUD caisses |
| [useProductEditor.ts](composables/useProductEditor.ts) | 187 | Logique fiche produit (extrait de `produits/[id]/edit.vue`) |
| [useProductCatalogData.ts](composables/useProductCatalogData.ts) | 166 | Catalogue partagé (catégories, variations, TVA, fournisseurs, marques) |
| [useProductStockMovement.ts](composables/useProductStockMovement.ts) | 178 | Ajustement stock produit |
| [useMovementCart.ts](composables/useMovementCart.ts) | 182 | Panier mouvement (réception/perte/ajustement) |
| [useMovementCatalog.ts](composables/useMovementCatalog.ts) | 129 | Catalogue produit pour mouvements |
| [useMovementProductSearch.ts](composables/useMovementProductSearch.ts) | 81 | Recherche produit mouvements |
| [useClientEditor.ts](composables/useClientEditor.ts) | 124 | Logique fiche client |
| [useClientPurchaseHistory.ts](composables/useClientPurchaseHistory.ts) | 30 | Historique achats client |
| [usePostalCodeLookup.ts](composables/usePostalCodeLookup.ts) | 51 | Auto-complétion code postal (geo.api.gouv.fr) |
| [useGeoApi.ts](composables/useGeoApi.ts) | 30 | Wrapper `geo.api.gouv.fr` |
| [useResync.ts](composables/useResync.ts) | 97 | Déclenche resync sync-group |
| [useSyncGroups.ts](composables/useSyncGroups.ts) | 95 | CRUD sync groups |
| [useSyncGroupForm.ts](composables/useSyncGroupForm.ts) | 110 | State form création groupe |
| [useEditSyncGroup.ts](composables/useEditSyncGroup.ts) | 207 | State form édition groupe |
| [useEstablishmentsSelect.ts](composables/useEstablishmentsSelect.ts) | 24 | Shim `<EstablishmentSelect>` |
| [useBrands.ts](composables/useBrands.ts) | 54 | CRUD marques |
| [useSuppliers.ts](composables/useSuppliers.ts) | 62 | CRUD fournisseurs |
| [useFetchError.ts](composables/useFetchError.ts) | 13 | `extractFetchError` — extrait message depuis erreur `$fetch` |
| [useToast.ts](composables/useToast.ts) | 45 | Wrapper `vue-sonner` |
| [useSupabaseClient.ts](composables/useSupabaseClient.ts) | 11 | Retourne `$supabase` depuis `useNuxtApp()` |

#### `stores/` (7 Pinia stores)
| Fichier | Lignes | Rôle |
|---|---|---|
| [auth.ts](stores/auth.ts) | 204 | Session Supabase : `signUp`, `signIn`, `signOut`, `restoreSession`, `getAuthHeaders`, `selectTenant`. Expose `sessionRestored` |
| [cart.ts](stores/cart.ts) | 360 | Panier caisse : `addToCart`, `updateQuantity`, `updateDiscount` (caps 100% / prix unitaire), `applyGlobalDiscountToItems` (au prorata centimes), `pendingCart`, `submitSale`, `checkDayClosure`, `validateStock` |
| [products.ts](stores/products.ts) | 275 | Liste produits + getters `outOfStockAlerts`, `lowStockAlerts`, `totalStockValue`, `hasEnoughStock`, `getAvailableStock` — reload on `selectedEstablishmentId` change |
| [customer.ts](stores/customer.ts) | 77 | Client sélectionné + liste |
| [sellers.ts](stores/sellers.ts) | 94 | Vendeurs + vendeur sélectionné |
| [variationGroups.ts](stores/variationGroups.ts) | 39 | Groupes de variations (cache client) |
| [shortcutBoard.ts](stores/shortcutBoard.ts) | 119 | **Nouveau** (non dans CLAUDE.md) : raccourcis caisse persistés dans `localStorage` par `establishmentId` (clé `fympos-shortcut-board-{id}`) |

#### `middleware/` (côté client, Nuxt)
| Fichier | Rôle |
|---|---|
| [auth.global.ts](middleware/auth.global.ts) (32 l.) | Guard client : skip SSR, redirect `/login?redirect=...` si non authentifié, redirect `/dashboard` si authentifié sur route publique (`/login`, `/signup`). Appelle `auth.restoreSession()` en fallback |

#### `plugins/` (3, non 2 comme dans CLAUDE.md)
| Fichier | Rôle |
|---|---|
| [00.supabase.ts](plugins/00.supabase.ts) | Init client Supabase (anon key), `provide: { supabase }` |
| [01.api-fetch.client.ts](plugins/01.api-fetch.client.ts) | **Override `$fetch`** global : injecte `Authorization: Bearer` + `x-tenant-id`, `signOut()` sur 401 |
| [02.session-restore.client.ts](plugins/02.session-restore.client.ts) | Pré-monte la session avant premier render (évite flash de contenu non authentifié) |

#### `types/`
| Fichier | Rôle |
|---|---|
| [index.ts](types/index.ts) | Re-exports globaux |
| [auth.ts](types/auth.ts) | `Tenant`, `AuthError` (extraits du store auth) |
| [pos.ts](types/pos.ts) | `Product`, `ProductInCart`, `SalePayload`, `SaleResponse` |
| [product.ts](types/product.ts) | Types produit |
| [customer.ts](types/customer.ts) | Types client |
| [sync.ts](types/sync.ts) | `SyncResult` et types sync |
| [shortcut.ts](types/shortcut.ts) | `ShortcutTab`, `ShortcutCell` |
| [geo.ts](types/geo.ts) | Types geo.api.gouv.fr |
| [mouvements/index.ts](types/mouvements/index.ts) | Types mouvements |
| [nitro.d.ts](types/nitro.d.ts) | Augmentation `H3EventContext` (event.context.auth) |
| [nuxt.d.ts](types/nuxt.d.ts) | Augmentation app types |

#### `utils/` (racine, **non documenté dans CLAUDE.md**)
| Fichier | Lignes | Rôle |
|---|---|---|
| [cartUtils.ts](utils/cartUtils.ts) | 147 | Calculs panier : `getFinalPrice`, `totalTTC`, `totalHT`, `totalTVA` (centimes, LRM, cap %/€) |
| [formatters.ts](utils/formatters.ts) | 76 | Formatage (€, dates) |
| [productHelpers.ts](utils/productHelpers.ts) | 139 | Helpers produits (extraction stock, filtres) |

#### `lib/`
| Fichier | Rôle |
|---|---|
| [lib/utils.ts](lib/utils.ts) | `cn()` — helper `clsx` + `tailwind-merge` pour shadcn |

#### `layouts/`
- [auth.vue](layouts/auth.vue), [dashboard.vue](layouts/dashboard.vue)

#### `assets/css/`, `public/`
- CSS Tailwind 4 (config via Vite plugin), logo/favicon, mock

### 1.4 Tests — `tests/` (67 fichiers)
- **API** (17) : 1 par domaine (archives/brands/categories/clients/closures/database/establishments/movements/product-stocks/products/registers/sales/sellers/suppliers/sync-groups/tax-rates/variations)
- **Components** (18) : caisse/, produits forms, LoginForm, ColMiddle, ProductsGrid/Table/SearchBar
- **Pages** (13) : caisse, dashboard, mouvements, produits (create/edit/index), clients (edit), stocks, synthese, variations, + 4 tests de caractérisation (`*.charact.test.ts`)
- **Stores** (4) : customerStore, sellersStore, variationGroupsStore, `cartStore.test.ts`
- **Unitaires** :
  - `tests/unit/nf525/` (6 fichiers, 42 tests) — generateTicketHash, generateTicketNumber, generateTicketSignature, generateArchiveHash, verifyTicketIntegrity, verifyTicketChain
  - `tests/unit/financialValidation.test.ts` (16 tests)
  - `tests/unit/getTenantFromUser.test.ts` (11 tests)
- **Autres** : apiHandlers, cartStore, cartUtils, formatters, productHelpers, productsStore, validateVariationPayload

### 1.5 Scripts & Docs
- **scripts/** : `check-env.js`, `switch-env.sh`, `sync-sequences.ts`, `seed-tax-rates.ts`, `generate-full-schema.ts`, `full-schema.sql`, 1 MD (apply-migrations-manual)
- **docs/audit/** : 9 audits datés (cartographie, TS strict, Supabase/fetch, dead-code, migrations, composables, calculs financiers, NF525 tests, stores Pinia)
- **docs/architecture/** : `supabase-vs-drizzle.md`
- **docs/legacy-migrations/** : 11 scripts archivés de migration ad-hoc
- **supabase/migrations/** : migrations Supabase legacy (RLS)

---

## PHASE 2 — INDEX DÉTAILLÉ (fichiers clés)

### 2.1 Fichiers critiques

#### [server/database/schema.ts](server/database/schema.ts) — 1101 lignes
**Rôle** : source de vérité du modèle de données.
**Tables exportées** (25) :
- Ventes : `sales`, `saleItems`, `closures`, `archives`
- Catalogue : `products`, `categories`, `brands`, `suppliers`, `taxRates`, `variationGroups`, `variations`
- Stock : `productStocks`, `productEstablishments`, `movements`, `stockMovements`
- Personnes : `customers`, `customerEstablishments`, `sellers`, `sellerEstablishments`
- Organisation : `establishments`, `registers`
- Sync : `syncGroups`, `syncGroupEstablishments`, `syncRules`, `syncLogs`
- Audit : `auditLogs`
**Relations Drizzle** : ~22 blocs `relations(...)` en bas de fichier.
**Conventions** : `tenantId varchar(64) notNull` sur **toutes** les tables ; index sur `tenantId` systématique ; timestamps `withTimezone: true` + `defaultNow()`.
**Doublons / dette** : colonnes `tva decimal` (deprecated) cohabitent avec `tvaId → taxRates` (products et saleItems).

#### [server/api/sales/create.post.ts](server/api/sales/create.post.ts) — 587 lignes
**Rôle** : cœur de la création de vente conforme NF525.
**Flux (résumé)** :
1. `validateBody(createSaleRequestSchema)` + `getTenantIdFromEvent`
2. Validations manuelles (panier non vide, seller, paiement non zéro, register/establishment)
3. Vérification caisse active + appartenance à l'établissement (2 SELECT)
4. Calcul `establishmentNumber` / `registerNumber` (position dans liste ordonnée par id) — utilisé par `generateTicketNumber`
5. Vérif clôture du jour (403 si clôturée pour cette caisse)
6. `recomputeTotalTTC` sur les items + `validateTotalTTC` (tolérance 2¢)
7. **Transaction** (`db.transaction`) :
   - `pg_advisory_xact_lock(establishmentId)` — sérialise la numérotation
   - Lecture `lastSale` (par `registerId`) → `previousHash`
   - Lecture `lastTicket` (par `establishmentId`) → `sequenceNumber`
   - `generateTicketHash` → `currentHash`, `generateTicketSignature` → `signature`
   - INSERT `sales`, INSERT `saleItems` (calcul `totalHT = totalTTC / (1 + tva/100)`), UPDATE `productStocks`, INSERT `stockMovements`
   - `logSaleCreation` (audit)
8. Retourne `{ success, sale: { id, ticketNumber, hash, signature, ... } }`
**Points de vigilance** :
- L'`establishmentNumber` dépend de la position dans `establishments` filtré par `isActive=true` — le désactivé décale les numéros (impacte aussi les tickets passés si recalculés)
- Les totaux stockés dans `sales.totalHT/totalTVA/totalTTC` proviennent du client (pas recalculés), seul `totalTTC` est validé
- Le `totalTTC` par ligne utilisé pour le hash utilise `.toFixed(2)` (aligné avec DB — voir audit 07)

#### [server/utils/nf525.ts](server/utils/nf525.ts) — 259 lignes
**Exports** : `TicketData`, `generateTicketHash`, `generateTicketNumber`, `verifyTicketIntegrity`, `generateTicketSignature`, `generateArchiveHash`, `verifyTicketChain`, `ChainVerificationResult`.
**Déterminisme** : sérialise 9 champs joints par `::`, items par `|`, payments par `|`. Inclut `previousHash` (ou `FIRST_TICKET`), code TVA (`tvaCode` fallback `TVA{tva}`).
**Test** : 42 tests dans `tests/unit/nf525/` (sans mock).

#### [server/utils/sync.ts](server/utils/sync.ts) — 800 lignes
**Rôle** : filtrage champs prod/clients selon `syncRules`, propagation cross-établissements dans un groupe.
**Exports clés** : `getGlobalProductFields`, `getGlobalCustomerFields`, `propagateProductChange`, `propagateCustomerChange`, `getSyncGroupsForEstablishment` (+ types).
**Hypothèses** : un établissement n'appartient qu'à **un seul** groupe de sync (prend `groups[0]` systématiquement — ligne 102).

#### [server/middleware/auth.global.ts](server/middleware/auth.global.ts) — 47 lignes
**Flux** :
1. Bypass si path !`/api` ou méthode OPTIONS
2. Bypass explicit PUBLIC_ENDPOINTS : `/api/login`, `/api/auth`, `/api/database/seed`
3. Bypass dev `ALLOW_AUTH_BYPASS=true` + `NODE_ENV=development` → pose `event.context.auth` best-effort
4. Sinon `await assertAuth(event)` (lève 401/400)

#### [stores/cart.ts](stores/cart.ts) — 360 lignes
**État** : `items`, `selectedProduct`, `globalDiscount`, `globalDiscountType`, `pendingCart`.
**Actions** : `addToCart`, `removeFromCart`, `clearCart`, `updateQuantity`, `updateDiscount` (caps %/€), `updateGlobalDiscount`, `applyGlobalDiscountToItems` (répartition prorata €), `updateVariation`, `addPendingCart` / `recoverPendingCart`, `validateStock`, `checkDayClosure`, `submitSale`.
**Réactions** : `watch(selectedProduct)` → ajoute au panier ; `watch(customerStore.client)` → applique remise permanente (max des deux).
**Délégation calculs** : `utils/cartUtils.ts` (totalTTC/HT/TVA + allocation centimes).

#### [utils/cartUtils.ts](utils/cartUtils.ts) — 147 lignes
**Précision** : calculs en **centimes entiers** (Math.round/floor).
**Helpers** : `round2`, `toCents`, `fromCents`, `lineKey`, `unitTtcAfterLineDiscount` (cap 100% / prix), `buildLines`, `globalDiscountAllocationCents` (algo LRM : floor + résidu distribué par `remainder` desc), `globalEuroAllocationCents`, `getFinalPrice`, `totalTTC`, `totalHT` (HT arrondi par ligne, somme), `totalTVA = TTC - HT`.

#### [stores/auth.ts](stores/auth.ts) — 204 lignes
**Flux** : `signUp`/`signIn`/`signOut`/`restoreSession`/`selectTenant`.
**`setUserContext`** : extrait `tenants` + `tenantId` depuis `app_metadata`, fallback user.id.
**`getAuthHeaders`** : `Authorization: Bearer {token}` + `x-tenant-id`.
**`signOut`** : nettoie store + `useSellersStore().clearSeller()` + `useEstablishmentRegister().reset()`.
**`onAuthStateChange`** : souscrit et met à jour session/user.

#### [composables/useEstablishmentRegister.ts](composables/useEstablishmentRegister.ts) — 211 lignes
**Singleton module-level** : `selectedEstablishmentId`, `selectedRegisterId`, liste établissements + caisses. Réutilisé par tous les stores `products`/`shortcutBoard` via `watch`.
**`reset()`** : vide l'état global — appelé par `signOut`.

#### [plugins/01.api-fetch.client.ts](plugins/01.api-fetch.client.ts) — 29 lignes
Ré-écrit `globalThis.$fetch` + `$apiFetch` pour injecter les headers auth et gérer les 401 (logout + redirect). **Tous les `$fetch(...)` du code client passent par là.**

### 2.2 Résumé de responsabilités par couche

| Couche | Responsable | Où |
|---|---|---|
| Auth requête | `assertAuth` → Supabase getUser → pose `event.context.auth` | [server/utils/supabase.ts](server/utils/supabase.ts) |
| Multi-tenant | `getTenantIdFromEvent` obligatoire dans **chaque** endpoint | [server/utils/tenant.ts](server/utils/tenant.ts) |
| Validation entrée | `validateBody(schema)` avec Zod → 400 sur erreur | [server/utils/validation.ts](server/utils/validation.ts) |
| DB | Drizzle `db` depuis `server/database/connection.ts` | [server/database/connection.ts](server/database/connection.ts) |
| NF525 | Hash + chaînage + numéro de ticket + signature | [server/utils/nf525.ts](server/utils/nf525.ts) |
| Audit NF525 | Insert `auditLogs` avec `AuditEventType` | [server/utils/audit.ts](server/utils/audit.ts) |
| Sync multi-établissement | Filtre champs selon `syncRules`, propage writes | [server/utils/sync.ts](server/utils/sync.ts) |
| Calculs panier | Centimes entiers, LRM, allocation prorata | [utils/cartUtils.ts](utils/cartUtils.ts) |
| Validation financière serveur | Recompute TTC + tolérance 2¢ + warn HT+TVA=TTC | [server/utils/financialValidation.ts](server/utils/financialValidation.ts) |
| Auth client | Pinia auth + `onAuthStateChange` + `restoreSession` | [stores/auth.ts](stores/auth.ts) + [plugins/02.session-restore.client.ts](plugins/02.session-restore.client.ts) |
| HTTP client | Override `$fetch` avec headers auth + 401 → logout | [plugins/01.api-fetch.client.ts](plugins/01.api-fetch.client.ts) |
| Sélection établissement/caisse | Singleton composable partagé | [composables/useEstablishmentRegister.ts](composables/useEstablishmentRegister.ts) |

---

## Écarts constatés avec CLAUDE.md (au 2026-04-22)

| Fait dans CLAUDE.md | Réalité vérifiée |
|---|---|
| `schema.ts` = 1100 lignes | **1101** |
| `sync.ts` = 787 lignes | **800** |
| `server/api/sales/create.post.ts` = 554 lignes | **587** |
| 46 677 lignes de code | Non re-mesuré — à vérifier |
| 64 fichiers tests / 371 tests | **67** fichiers tests |
| 2 plugins (`00.supabase.ts`, `01.api-fetch.client.ts`) | **3** — `02.session-restore.client.ts` ajouté |
| 3 composables | **23** |
| Structure repo : pas de `utils/` racine | **`utils/` existe** (cartUtils, formatters, productHelpers) — non documenté |
| Stores : 6 listés | **7** — `shortcutBoard.ts` absent |
| Middleware : « aucun actuellement » côté serveur | **`server/middleware/auth.global.ts` existe** (47 l.) ET un `middleware/auth.global.ts` côté client (32 l.) |
| Types : 7 fichiers | **11** — ajouts `auth.ts`, `geo.ts`, `shortcut.ts`, `nitro.d.ts`, `nuxt.d.ts`, `mouvements/index.ts` |
| Pages listées | Ajouts non listés : `marques/`, `fournisseurs/`, `signup/`, `tva/`, `categories/` |

Ces écarts n'invalident pas CLAUDE.md, mais le journal de session a dépassé la table de structure.
