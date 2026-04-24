# Journal des sessions — FymPOS

> Historique chronologique des interventions Claude Code. Extrait de CLAUDE.md lors du refactor du 2026-04-22.
> Pour les règles et invariants, voir [CLAUDE.md](../CLAUDE.md).

---

## 📝 Sessions

| Date | Module traité | Actions effectuées | Statut |
|---|---|---|---|
| 2026-03-12 | Architecture globale | Cartographie complète du repo, mise à jour CLAUDE.md | ✅ |
| 2026-03-15 | Logger / package.json | BATCH 1 : logger.ts guard isDevelopment. BATCH 2 : drizzle-kit/pino-pretty/dotenv → devDependencies | ✅ |
| 2026-03-15 | Architecture Auth | BATCH 3 : frontière Supabase/Drizzle documentée (Auth vs DB) | ✅ |
| 2026-03-15 | Migrations | BATCH 4+5 : 4 paires doublons + 8 scripts ad-hoc — bug critique 0007 identifié | ✅ |
| 2026-03-15 | Migrations (fix) | 0007 fusionné, reset-migrations.ts sécurisé, 9 scripts archivés dans docs/legacy-migrations/, doublons renommés | ✅ |
| 2026-03-15 | Pages monolithiques | 10 composables identifiés, rapport dans docs/audit/06 | ✅ |
| 2026-03-15 | Extraction composables | 10 composables extraits, 13 commits atomiques, pages 831→484 / 1050→614 / 891→528, 14 tests caractérisation | ✅ |
| 2026-03-15 | Convention auth serveur | Section "Convention auth serveur" ajoutée à CLAUDE.md | ✅ |
| 2026-03-15 | Tests getTenantFromUser | 11 tests dans tests/unit/getTenantFromUser.test.ts | ✅ |
| 2026-03-15 | Sécurité serviceRoleKey | Grep exhaustif — 0 import côté client confirmé | ✅ |
| 2026-03-15 | Analyse tests failing | 26 tests en échec classifiés (pré-existants au refactor) | ✅ |
| 2026-03-15 | Audit calculs financiers | `docs/audit/07-calculs-financiers.md` : 4 risques identifiés | ✅ |
| 2026-03-15 | Audit NF525 couverture | 6 fonctions exportées, 0 test unitaire réel, 38 tests identifiés | ✅ |
| 2026-03-15 | Corrections P1–P4 | P1 validate totalTTC serveur, P2 centimes close-day, P3 assertion HT+TVA=TTC, P4 hash aligné .toFixed(2) — 16 tests | ✅ |
| 2026-03-15 | Correction 26 tests failing | 7 batches — résultat : 313 tests / 57 fichiers, 0 échec | ✅ |
| 2026-03-16 | NF525 couverture tests | 42 tests unitaires dans tests/unit/nf525/ (6 fichiers) | ✅ |
| 2026-03-16 | Audit 03 clôture | M4 N/A (pas de types DB générés), audit 03 clôturé | ✅ |
| 2026-03-16 | Pages monolithiques 4-5 | 6 composables extraits (10 commits) — pages 697→484 / 569→145 — 383 tests / 66 fichiers | ✅ |
| 2026-03-16 | Stores Pinia (audit 09) | R1-R8 appliqués (toCartItem typé, extractFetchError, loading/error, DEPRECATED supprimé, types/auth.ts) | ✅ |
| 2026-03-24 | Bugs B1-B4 | B1 generate_movement_number TS, B2 lookup variation nom→ID stock non bloquant, B3 CartItem computed variations, B4 filtrage isArchived | ✅ |
| 2026-03-24 | Bugs mouvements/variations | variation-groups invalidate, API variation delete bloquée si produit lié, stockByVariation format array | ✅ |
| 2026-03-24 | Bugs B5-B11 | B5 CSP geo.api.gouv.fr, B6 cap remise, B7 reload établ., B8 includeInactive, B9 session-restore plugin, B10 TVA lock, B11 reset useEstablishmentRegister | ✅ |
| 2026-03-24 | Fix redirect login | Suppression v-if sessionRestored dans layouts/dashboard.vue | ✅ |
| 2026-03-24 | Bugs C1-C5 | C1 numérotation ticket isolée par establishmentId, C2 stock atomique SQL, C3 useProductStockMovement invalidation, C4 stockByVariation array, C5 minStock ?? 5 | ✅ |
| 2026-03-25 | Produits P1-P5 | P1 archivage (409 si ventes), P2 duplication, P3 création catégorie inline, P4 filtres marque/fournisseur, P5 couvert par P1 | ✅ |
| 2026-03-25 | Marques + Fournisseurs | Pages CRUD /marques et /fournisseurs, endpoints update/delete, composables, navigation | ✅ |
| 2026-03-25 | Clients U1-U5 | Listing cliquable, champs obligatoires, unicité email/tenant, anonymisation RGPD, remise permanente auto | ✅ |
| 2026-04-01 | TVA + Catégories + Nettoyage | T1 code TVA auto-généré, T3 pré-sélection TVA par défaut, C1 protection suppression catégorie 409, N1/N2 console.log debug + toasts doublons | ✅ |

---

## 📝 Architecture auth côté client (B9)

- `plugins/02.session-restore.client.ts` : appelle `restoreSession()` avant montage app (lit localStorage, pas de réseau)
- `middleware/auth.global.ts` : skip SSR, utilise l'état positionné par le plugin
- `sessionRestored` dans auth store : indicateur que `restoreSession()` a été appelé

---

## 📝 Tests failing historiques (session 2026-03-15)

> Tous corrigés. Résultat final : 313 tests / 57 fichiers — 0 échec.

| Fichier | Tests | Correction |
|---|---|---|
| tests/api/sales.test.ts | 6 | `logSystemError` ajouté au mock audit |
| tests/components/LoginForm.test.ts | 8 | Pinia + store auth mocké + texte FR |
| tests/components/cart/ColLeft.test.ts | 2 | Tests réalignés + mock useEstablishmentRegister |
| tests/components/cart/ColRight.test.ts | 1 | mock useEstablishmentRegister + checkDayClosure |
| tests/components/cart/AddClientForm.test.ts | 1 | IDs inputs + gdprConsent + composable mocké |
| tests/components/cart/Header.test.ts | 1 | Pinia + store sellers + stubs |
| tests/components/ProductFormPricing.test.ts | 2 | useFetch stub + Suspense wrapper |
| tests/stores/customerStore.test.ts | 2 | mock useEstablishmentRegister |
| tests/pages/produits/index.test.ts | 2 | watch stub + composables mocks |
| tests/pages/synthese/index.test.ts | 1 | mock useEstablishmentRegister |
