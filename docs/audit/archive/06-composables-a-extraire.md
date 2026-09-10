# Audit #06 — Composables à extraire (pages monolithiques)

> Date : 2026-03-15
> Auteur : Claude Code (audit session 2)
> Statut : ✅ EXÉCUTÉ — 10 composables extraits, 13 commits atomiques (2026-03-15)

---

## Méthode d'analyse

Pour chaque page monolithique, les blocs de code ont été classifiés par responsabilité :
- **État local** (refs, reactives) → reste souvent dans la page
- **Chargement de données** (fetch API) → composable
- **Logique métier** (validation, calculs, opérations CRUD) → composable
- **Gestion des dialogs** (open/close + réinitialisation) → composable ou inline selon complexité
- **Template** → reste dans la page

---

## Page 1 : `pages/etablissements/synchronisation.vue` — 1050 lignes

### Structure actuelle

| Section | Lignes (approx.) | Responsabilité |
|---|---|---|
| Template | l.1 – l.520 | Affichage groupes + 5 dialogs (créer, éditer, supprimer groupe, resync) |
| Script imports + types | l.522 – l.610 | ~90 lignes d'imports et définitions de types inline |
| State / reactive | l.611 – l.715 | syncGroups, availableEstablishments, newGroup, editGroup, resyncData |
| `loadSyncGroups()` | l.717 – l.728 | Fetch GET /api/sync-groups |
| `loadEstablishments()` | l.730 – l.743 | Fetch GET /api/establishments |
| `toggleEstablishmentSelection()` | l.746 – l.764 | Toggle checkbox create |
| `toggleEditEstablishmentSelection()` | l.767 – l.779 | Toggle checkbox edit |
| `openCreateGroupDialog()` + `createGroup()` | l.782 – l.835 | Reset form + POST /api/sync-groups/create |
| `openEditGroupDialog()` + `updateGroupRules()` | l.838 – l.977 | Load group into editGroup + détection champs réactivés + PATCH rules/establishments |
| `openDeleteGroupDialog()` + `deleteGroup()` | l.980 – l.1000 | DELETE /api/sync-groups/:id/delete |
| `showResyncDialog()` + `performResync()` + `skipResync()` | l.1002 – l.1041 | POST /api/sync-groups/:id/resync |
| `onMounted` | l.1044 – l.1048 | Parallel load |

### Composables à extraire

#### `useSyncGroups()` (~60 lignes)
**Responsabilité** : Chargement et liste des groupes de synchronisation
```typescript
// Expose :
const syncGroups = ref<SyncGroup[]>([])
const loading = ref(false)
async function loadSyncGroups(): Promise<void>
```

#### `useEstablishmentsSelect()` (~40 lignes)
**Responsabilité** : Chargement de la liste des établissements disponibles pour les sélecteurs
```typescript
// Expose :
const availableEstablishments = ref<Establishment[]>([])
async function loadEstablishments(): Promise<void>
```
> Note : peut être mutualisé avec `pages/etablissements/index.vue`

#### `useSyncGroupForm()` (~120 lignes)
**Responsabilité** : État et logique du formulaire de création
```typescript
// Expose :
const newGroup = reactive({ name, description, establishmentIds, productRules, customerRules })
function openCreateGroupDialog(): void
function toggleEstablishmentSelection(id: number, checked: boolean | 'indeterminate'): void
async function createGroup(): Promise<void>
```

#### `useEditSyncGroup()` (~160 lignes)
**Responsabilité** : Chargement d'un groupe dans le formulaire d'édition + détection des champs réactivés + sauvegarde
```typescript
// Expose :
const editGroup = reactive({ id, name, establishmentIds, productRules, customerRules })
const selectedGroup = ref<SyncGroup | null>(null)
function openEditGroupDialog(group: SyncGroup): void
function toggleEditEstablishmentSelection(id: number, checked: boolean | 'indeterminate'): void
async function updateGroupRules(): Promise<void>
```

#### `useResync()` (~70 lignes)
**Responsabilité** : Dialog de resynchronisation et opération POST
```typescript
// Expose :
const resyncDialogOpen = ref(false)
const resyncData = reactive({ groupId, groupName, entityType, fields, sourceEstablishmentId, establishments })
function showResyncDialog(group: SyncGroup, entityType: 'product' | 'customer', fields: string[]): void
async function performResync(): Promise<void>
function skipResync(): void
```

### Résultat réel

| Métrique | Avant | Après | Gain |
|---|---|---|---|
| `synchronisation.vue` | 1050 lignes | **614 lignes** | -41% |
| Composables extraits | 0 | 5 composables (539 lignes) | Testable |
| Statut | — | ✅ 2026-03-15 | — |

---

## Page 2 : `pages/etablissements/index.vue` — 831 lignes

### Structure actuelle

| Section | Lignes (approx.) | Responsabilité |
|---|---|---|
| Template | l.1 – l.408 | Liste établissements + 6 dialogs (CRUD establishments + CRUD registers) |
| Script imports + types | l.411 – l.464 | Imports + types Establishment/Register |
| State | l.465 – l.523 | establishments, registers, dialog states, form state |
| `loadEstablishments()` + `loadRegisters()` | l.526 – l.558 | 2 fetches |
| `getRegistersByEstablishment()` | l.560 – l.562 | Filtre local |
| CRUD Establishments | l.564 – l.706 | 6 fonctions : open/create/update/toggle/openDelete/delete |
| CRUD Registers | l.710 – l.831 | 8 fonctions : open/create/update/toggle/openDelete/delete + goToSync |

### Composables à extraire

#### `useEstablishments()` (~150 lignes)
**Responsabilité** : CRUD complet des établissements
```typescript
// Expose :
const establishments = ref<Establishment[]>([])
const loading = ref(false)
async function loadEstablishments(): Promise<void>
// Dialog states
const createDialogOpen = ref(false)
const editDialogOpen = ref(false)
const deleteDialogOpen = ref(false)
const newEstablishment = ref({...})
const editEstablishment = ref({...})
const selectedEstablishment = ref<Establishment | null>(null)
// CRUD
function openCreateDialog(): void
async function createEstablishment(): Promise<void>
function openEditDialog(e: Establishment): void
async function updateEstablishment(): Promise<void>
async function toggleEstablishmentStatus(e: Establishment): Promise<void>
function openDeleteDialog(e: Establishment): void
async function deleteEstablishment(): Promise<void>
```

#### `useRegisters(establishments: Ref<Establishment[]>)` (~130 lignes)
**Responsabilité** : CRUD des caisses + association à un établissement
```typescript
// Expose :
const registers = ref<Register[]>([])
async function loadRegisters(): Promise<void>
function getRegistersByEstablishment(id: number): Register[]
// Dialog states + forms + CRUD (6 fonctions)
```

### Résultat réel

| Métrique | Avant | Après | Gain |
|---|---|---|---|
| `etablissements/index.vue` | 831 lignes | **484 lignes** | -42% |
| Composables extraits | 0 | 2 composables (424 lignes) | Testable |
| Statut | — | ✅ 2026-03-15 | — |

---

## Page 3 : `pages/produits/[id]/edit.vue` — 891 lignes

### Structure actuelle (script l.386 – l.891, ~505 lignes)

| Section | Lignes (approx.) | Responsabilité |
|---|---|---|
| Template | l.1 – l.385 | 5 onglets (General, Variations, Prix, Stock, Barcode) + 5 dialogs |
| Script imports + types | l.386 – l.444 | Imports, types ProductApi, StockHistoryItem, CategoryNode |
| State | l.445 – l.500 | form, suppliers, brands, categories, variationGroups, dialogs, stock movement |
| `loadProduct()` | ~l.500 – l.560 | GET /api/products/:id + peuplement form |
| `loadSuppliers()` / `loadBrands()` / `loadCategories()` / `loadVariationGroups()` | ~l.560 – l.620 | 4 fetches independants |
| `saveProduct()` | ~l.620 – l.680 | PUT /api/products/:id — validation + PATCH |
| `saveNewSupplier()` / `saveNewBrand()` / `saveNewCategory()` | ~l.680 – l.730 | POST inline (création rapide depuis le form) |
| `openStockDialog()` + `submitStockMovement()` | ~l.730 – l.800 | Logique mouvements de stock depuis la fiche produit |
| `openHistory()` + chargement historique | ~l.800 – l.850 | GET /api/movements + affichage |
| Helpers (formatDate, reasonLabel, getStockByVariation, etc.) | ~l.850 – l.891 | Fonctions utilitaires |

### Composables à extraire

#### `useProductEditor(productId: Ref<number>)` (~180 lignes)
**Responsabilité** : Chargement du produit et sauvegarde
```typescript
// Expose :
const originalProduct = ref<ProductApi | null>(null)
const form = ref({...}) // tout l'état du formulaire
const loading = ref(false)
const loadingProduct = ref(true)
async function loadProduct(): Promise<void>
async function saveProduct(): Promise<void>
// Helpers form
function updateGeneralForm(data): void
function updatePricingForm(data): void
```

#### `useProductCatalogData()` (~100 lignes)
**Responsabilité** : Chargement des données référentielles (suppliers, brands, categories, variationGroups)
```typescript
// Expose :
const suppliers = ref<Supplier[]>([])
const brands = ref<Brand[]>([])
const categories = ref<CategoryNode[]>([])
const variationGroups = ref<VariationGroup[]>([])
async function loadAll(): Promise<void>
// Création rapide
async function saveNewSupplier(name: string): Promise<void>
async function saveNewBrand(name: string): Promise<void>
async function saveNewCategory(name: string): Promise<void>
```

#### `useProductStockMovement(productId: Ref<number>)` (~120 lignes)
**Responsabilité** : Dialog de mouvement de stock et historique
```typescript
// Expose :
const stockDialogOpen = ref(false)
const movementType = ref<'reception' | 'adjustment'>('reception')
const movementQuantities = ref<Record<string | number, number | null>>({})
const historyDialogOpen = ref(false)
const stockHistory = ref<StockHistoryItem[]>([])
const loadingHistory = ref(false)
function openStockDialog(type: 'reception' | 'adjustment'): void
async function submitStockMovement(): Promise<void>
async function openHistory(): Promise<void>
// Helpers
function getStockByVariation(variationId: number): number
function setMovementQuantity(id: string | number, val: string): void
```

### Résultat réel

| Métrique | Avant | Après | Gain |
|---|---|---|---|
| `produits/[id]/edit.vue` | 891 lignes | **528 lignes** | -41% |
| Composables extraits | 0 | 3 composables (518 lignes) | Testable |
| Statut | — | ✅ 2026-03-15 | — |

---

## Récapitulatif global (résultats réels)

| Page | Avant | Après | Composables |
|---|---|---|---|
| `synchronisation.vue` | 1050 | **614** | 5 composables (539 lignes) |
| `etablissements/index.vue` | 831 | **484** | 2 composables (424 lignes) |
| `produits/[id]/edit.vue` | 891 | **528** | 3 composables (518 lignes) |
| **Total** | **2772** | **1626** | **10 composables (1481 lignes)** |

Réduction totale : **-41%** sur les 3 pages les plus volumineuses.

Tests : 14 nouveaux tests de caractérisation ajoutés (3 fichiers), baseline maintenue (26 tests failing inchangé).

---

## Plan d'exécution suggéré

L'extraction devra se faire en sessions dédiées, **une page à la fois**, avec tests de caractérisation avant refactor.

### Ordre de priorité recommandé

1. **`etablissements/index.vue`** (831 → ~380 lignes)
   - 2 composables bien délimités
   - Pas de logique fiscale critique
   - Meilleur rapport effort/gain pour commencer

2. **`synchronisation.vue`** (1050 → ~420 lignes)
   - 5 composables mais logique plus complexe
   - Types à déplacer dans `types/sync.ts`
   - Attention : `resync` est une opération risquée — tester exhaustivement

3. **`produits/[id]/edit.vue`** (891 → ~430 lignes)
   - Le composable `useProductStockMovement` touche des opérations de stock
   - Tests de caractérisation obligatoires avant refactor

### Prérequis pour chaque extraction

```
1. Vérifier qu'il n'y a pas de tests existants à adapter
2. Écrire des tests de caractérisation (snapshot du comportement actuel)
3. Extraire un composable à la fois, committer
4. Vérifier typecheck + tests après chaque extraction
5. Ne pas changer le comportement — refactor pur
```

---

## Page 4 : `pages/clients/[id]/edit.vue` — 697 lignes

### Structure actuelle

| Section | Lignes (approx.) | Responsabilité |
|---|---|---|
| Template | l.1 – l.427 | Formulaire client (info perso, adresse, fidélité/remise, RGPD, notes/alertes) + dialog historique achats |
| Script imports | l.429 – l.453 | Imports composants UI + icônes Lucide |
| State | l.455 – l.496 | form, loading, loadingClient, clientStats, purchases, showPurchaseHistory, postalCode states |
| `formatPrice()` / `formatDateTime()` | l.466 – l.483 | Helpers de formatage locaux |
| `clientId` computed + `watch showPurchaseHistory` | l.485 – l.503 | computed depuis route.params + lazy load de l'historique |
| `handlePostalCodeChange()` + `selectCity()` | l.506 – l.568 | Appel API externe `geo.api.gouv.fr` + debounce 500ms + dropdown villes multiples |
| `clientName` computed | l.571 – l.578 | Computed : prénom + nom pour le titre |
| `loadClient()` + `loadClientStats()` | l.580 – l.633 | GET /api/clients/:id + GET /api/clients/:id/stats |
| `loadPurchaseHistory()` | l.635 – l.647 | GET /api/clients/:id/purchases |
| `handleSubmit()` | l.649 – l.691 | Validation RGPD + PUT /api/clients/:id |
| `onMounted` | l.693 – l.696 | Appel loadClient |

### Composables à extraire

#### `useClientEditor(clientId: Ref<number>)` (~90 lignes)
**Responsabilité** : Chargement du client, de ses statistiques, et sauvegarde du formulaire
```typescript
// Expose :
const form = ref<ClientForm | null>(null)
const loading = ref(false)
const loadingClient = ref(true)
const clientStats = ref({ totalRevenue: number, loyaltyPoints: number, purchaseCount: number })
const clientName = computed(() => string)
async function loadClient(): Promise<void>
async function handleSubmit(): Promise<void>
```

#### `useClientPurchaseHistory(clientId: Ref<number>)` (~35 lignes)
**Responsabilité** : Chargement lazy de l'historique des achats (déclenché à l'ouverture du dialog)
```typescript
// Expose :
const purchases = ref<Purchase[]>([])
const loadingPurchases = ref(false)
const showPurchaseHistory = ref(false)
// watch interne : charge l'historique à la première ouverture
```

#### `usePostalCodeLookup(form: Ref<ClientForm | null>)` (~65 lignes)
**Responsabilité** : Recherche automatique de ville via code postal (API externe `geo.api.gouv.fr`), debounce 500ms, gestion du dropdown multi-villes
```typescript
// Expose :
const loadingPostalCode = ref(false)
const postalCodeError = ref('')
const availableCities = ref<Array<{ nom: string; code: string }>>([])
function handlePostalCodeChange(): void
function selectCity(cityName: string): void
```

> Note : `usePostalCodeLookup` est réutilisable pour tout formulaire contenant une adresse française (ex: établissements).

### Résultat réel

| Métrique | Avant | Après | Gain |
|---|---|---|---|
| `clients/[id]/edit.vue` | 697 lignes | **484 lignes** | -31% |
| Composables extraits | — | 3 composables (usePostalCodeLookup, useClientPurchaseHistory, useClientEditor) | Testable |
| Statut | — | ✅ 2026-03-16 | — |

---

## Page 5 : `pages/mouvements/index.vue` — 569 lignes

### Structure actuelle

| Section | Lignes (approx.) | Responsabilité |
|---|---|---|
| Template | l.1 – l.64 | Interface délégée à 4 composants (MovementTypeSelector, ProductSearchWithSuggestions, SelectedProductsTable, ProductCatalogDialog) — déjà bien componentisée |
| Script imports + types | l.66 – l.89 | Imports composants, types `mouvements/`, `useEstablishmentRegister`, `normalizeProduct` |
| State | l.91 – l.112 | movementType, searchQuery, selectedProducts, comment, searchSuggestions, catalog filters, catalogProducts, loadingCatalog, categories, suppliers, brands, allVariations |
| `hasVariations()` + `getTotalStock()` | l.115 – l.127 | Helpers produit : détection variantes + calcul stock total |
| `watch searchQuery` (debounced suggestions) | l.130 – l.151 | GET /api/products suggestions (debounce 300ms, filtré par établissement) |
| `watch catalogSearchQuery` + `watch filters` | l.153 – l.164 | Rechargement catalogue sur modification des filtres |
| `handleSearchFocus()` + `selectFirstSuggestion()` + `selectProductFromSuggestion()` | l.166 – l.188 | Handlers UX recherche rapide |
| `searchProduct()` | l.190 – l.218 | GET /api/products par texte — ajout direct si 1 résultat, sinon ouvre catalogue |
| `openProductSelector()` + `loadCatalogProducts()` | l.220 – l.245 | Ouverture dialog + GET /api/products avec filtres combinés |
| `loadCategories()` + `loadSuppliers()` + `loadBrands()` | l.247 – l.292 | 3 fetches référentiels indépendants |
| `loadVariations()` + `getProductVariations()` | l.294 – l.343 | GET /api/variations/groups + résolution des variantes d'un produit |
| `addProductFromCatalog()` | l.345 – l.383 | Logique d'ajout dans le panier — init quantités par variation selon type de mouvement |
| `updateProductQuantity()` + `removeProduct()` + `clearAll()` | l.385 – l.408 | Gestion du panier (CRUD items) |
| `validateMovement()` | l.410 – l.503 | Construction du payload + POST /api/movements/create |
| `watch movementType` | l.506 – l.534 | Recalcul des quantités initialisées selon type (entry/adjustment/loss) |
| `onMounted` + `watch selectedEstablishmentId` | l.536 – l.545 | Init + rechargement complet au changement d'établissement |

### Composables à extraire

#### `useMovementProductSearch(establishmentId: Ref<number | null>)` (~80 lignes)
**Responsabilité** : Recherche de produits par texte avec debounce (suggestions) et sélection rapide
```typescript
// Expose :
const searchQuery = ref('')
const searchSuggestions = ref<Product[]>([])
function handleSearchFocus(): void
function selectFirstSuggestion(): void
function selectProductFromSuggestion(product: Product): void
async function searchProduct(): Promise<void>
// onProductSelected: callback / emit vers useMovementCart
```

#### `useMovementCatalog(establishmentId: Ref<number | null>)` (~160 lignes)
**Responsabilité** : Dialog catalogue produits avec filtres (catégorie, fournisseur, marque), chargement référentiels, et variations
```typescript
// Expose :
const isProductSelectorOpen = ref(false)
const catalogSearchQuery = ref('')
const selectedCategoryFilter = ref<number | null>(null)
const selectedSupplierFilter = ref<number | null>(null)
const selectedBrandFilter = ref<number | null>(null)
const catalogProducts = ref<Product[]>([])
const loadingCatalog = ref(false)
const categories = ref<Category[]>([])
const suppliers = ref<Supplier[]>([])
const brands = ref<Brand[]>([])
const allVariations = ref<Variation[]>([])
function openProductSelector(): void
async function loadCatalogProducts(): Promise<void>
// watches internes : catalogSearchQuery + filtres → reload
```

#### `useMovementCart(movementType: Ref<MovementType>, allVariations: Ref<Variation[]>)` (~140 lignes)
**Responsabilité** : Panier du mouvement — ajout/suppression/mise à jour des produits, recalcul des quantités, validation et soumission
```typescript
// Expose :
const selectedProducts = ref<SelectedProduct[]>([])
const comment = ref('')
function addProductFromCatalog(product: Product): void
function updateProductQuantity(productId: number, variationId: string | null, quantity: number): void
function removeProduct(productId: number): void
function clearAll(): void
async function validateMovement(): Promise<void>
// watch interne : movementType → recalcul quantités
// helpers internes : hasVariations, getTotalStock, getProductVariations
```

> Note : `useMovementCatalog` expose `allVariations` qui est passé en paramètre à `useMovementCart`. Les deux composables restent découplés — le câblage est fait dans la page.

### Résultat réel

| Métrique | Avant | Après | Gain |
|---|---|---|---|
| `mouvements/index.vue` | 569 lignes | **145 lignes** | -74% |
| Composables extraits | — | 3 composables (useMovementCatalog, useMovementCart, useMovementProductSearch) | Testable |
| Statut | — | ✅ 2026-03-16 | — |

---

## Récapitulatif global (toutes pages)

| Page | Avant | Après | Composables |
|---|---|---|---|
| `synchronisation.vue` | 1050 | **614** | 5 composables (539 lignes) ✅ |
| `etablissements/index.vue` | 831 | **484** | 2 composables (424 lignes) ✅ |
| `produits/[id]/edit.vue` | 891 | **528** | 3 composables (518 lignes) ✅ |
| `clients/[id]/edit.vue` | 697 | **484** | 3 composables (usePostalCodeLookup, useClientPurchaseHistory, useClientEditor) ✅ |
| `mouvements/index.vue` | 569 | **145** | 3 composables (useMovementCatalog, useMovementCart, useMovementProductSearch) ✅ |
| **Total** | **4038** | **2255** | **16 composables** |

Réduction totale réelle : **-44%** sur les 5 pages monolithiques.

---

*Dernière mise à jour : 2026-03-16 — par Claude Code (audit session 3, BATCH 1-3 + extraction pages 4-5)*
