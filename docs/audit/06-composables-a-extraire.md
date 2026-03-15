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

*Dernière mise à jour : 2026-03-15 — par Claude Code (audit session 2)*
