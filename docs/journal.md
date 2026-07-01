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
| 2026-04-25 | Phase B — robustesse & scaling | B1 helpers pagination (`apiResponse.ts`), B2 pagination back+front sur `/clients` & `/produits` (compat additive `meta.pagination`), B3 extraction `productOverrides` (endpoint -104 l.), B4 refactor ColRight via `useCheckout` (442→167 l., -62 %). 513 tests / 72 fichiers, +69 tests | ✅ |
| 2026-04-25 | D1 — Impression ticket & facture | Modale post-vente avec 2 boutons (ticket 80mm / facture A4). Générateurs HTML purs (`utils/saleDocuments.ts`), iframe print (`usePrintDocument`), dialog shadcn. Suppression code mort `printReceipt` orphelin. 544 tests / 73 fichiers, +31 tests (29 sur les générateurs + 2 sur le dialog) | ✅ |
| 2026-04-25 | D2.1 — Fidélité : schéma + admin | Tables `loyalty_config` (par tenant) + `loyalty_vouchers` + colonnes `points_earned/consumed/voucher_used_id` sur `sales`. Endpoints GET/PUT `/api/loyalty/config` (audit log inclus), validateur Zod (cap % à 100). Page admin `/parametres/fidelite` (3 cards : activation, calcul, avantage) + entrée sidebar. Migration `0012_sticky_photon.sql`. **Note** : journal `__drizzle_migrations` était désynchro (0010+0011 appliquées sans enregistrement) — réparé via `scripts/repair-migrations.ts`. 548 tests / 74 fichiers, +4 tests | ✅ |
| 2026-04-26 | D2.2 — Fidélité : attribution points | Helper `server/utils/loyalty.ts` : `getActiveLoyaltyConfig`, `calculatePointsForSale` (per_euro arrondi inférieur ou per_ticket=1), `getCustomerLoyaltyPoints` (cumule cross-établ. si `syncLoyaltyProgram=true` à la lecture, write reste local). Modif `sales/create.post.ts` : pré-fetch config + `customer.loyaltyProgram` avant transaction, INSERT `sales.points_earned`, upsert `customer_establishments.local_loyalty_points`. 0 attribution si TTC ≤ 0. 554 tests / 75 fichiers, +6 tests | ✅ |
| 2026-04-26 | D2.3 — Fidélité : UX caisse + consommation | Endpoint `/clients/:id/loyalty-status` (points cumulés + reward + vouchers actifs). Composable singleton `useLoyaltyForCustomer` : `fetchStatus`, `applyReward`/`removeReward`/`toggleReward`, décrément/restauration locale des points. Cart store : `loyaltyReward` + `applyLoyaltyReward` (snapshot items pour restoration au retrait, ré-application au `addToCart` si client sélectionné AVANT produits). Modale `LoyaltyRewardDialog` à la sélection client + étoile toggle gris/jaune dans card client (visible si éligible OU appliqué). Card client réorganisée : étoile loyalty | nom + sous-info (ville • badge ✨ X pts) | actions, bouton X repositionné. Backend `sales/create` : anti-tampering reward (vérifie type/value/pointsToConsume vs config), validation points suffisants, génération voucher (code 8 hex, expiresAt = createdAt + voucherValidityDays), persistence `pointsConsumed`, delta net `customer_establishments.local_loyalty_points`. Fix `stats.get` : lecture réelle des points depuis `customer_establishments` (vs ancien calcul `Math.floor(totalRevenue)`). 560 tests / 75 fichiers, +6 tests | ✅ |
| 2026-04-26 | D2.4-5-6 — Annulation, ticket/facture, vouchers comme paiement | **D2.4** Annulation : restitution `customer_establishments.local_loyalty_points` (delta inverse de l'attribution), cancel voucher généré (status='cancelled'), audit log enrichi loyalty. Liaison `sales.voucher_used_id` → voucher généré. **D2.5** Réponse `sales/create` enrichie (`pointsEarned/pointsConsumed/pointsTotalAfter/generatedVoucher`). Bloc fidélité sur ticket 80mm (★ FIDÉLITÉ ★) et facture A4 (bloc ambre dédié) avec code voucher en monospace + expiration. **D2.6** `appliedVouchers` dans cart store + `LoyaltyVouchersDialog` (checkboxes) + badge cliquable "N bon(s)" sur card client. Validation pré-transaction côté backend (status='active', non expirés, customer match), marquage `used` + `usedSaleId`, ajout automatique en `Bon d'achat #CODE` dans `payments[]`. Cancel : restauration `status='active'` sur tous vouchers utilisés. 567 tests / 75 fichiers, +7 tests | ✅ |
| 2026-04-26 | D3.1 — Ticket Z imprimable | Endpoint `/api/closures/:id/document` : charge la clôture + jointure caisse/établissement + agrégation TVA par taux à la volée depuis `sale_items`. Générateur `utils/closureDocuments.ts:buildClosureZHtml` : layout A4 avec entête établissement, métadonnées (tickets validés/annulés, premier/dernier ticket, opérateur, horodatage), 3 cartes totaux HT/TVA/TTC, table TVA par taux, table modes de paiement, footer NF525 (hashes clôture + dernier ticket, SIRET/NAF/TVA légaux). Bouton 🖨️ "Imprimer Z" par ligne sur `/clotures` via `usePrintDocument`. 579 tests / 76 fichiers, +12 tests | ✅ |
| 2026-04-26 | D3.2 — Export FEC (DGFiP) | Générateur `utils/fecExport.ts` conforme Article A47 A-1 LPF : 18 colonnes pipe-séparées, encoding UTF-8, dates `YYYYMMDD`, montants français, 1 écriture par vente avec lignes équilibrées DEBIT=CREDIT. Mapping comptes PCG hardcodé V1 (530/512/467/471/707x/4457x) — TODO param par tenant (mémoire). Endpoint `/api/reports/fec?from=&to=&establishmentId=` : bulk-fetch ventes + saleItems, attachment `text/plain`. Page `/rapports` avec sélecteur période, 5 presets (mois/trim/année), bouton download. Entrée sidebar sous Statistiques. 600 tests / 77 fichiers, +21 tests | ✅ |
| 2026-04-26 | A2 — Numérotation NF525 immutable | Risque ouvert NF525 (CLAUDE.md) résolu : `sales/create.post.ts` calculait `establishmentNumber/registerNumber` via `findIndex` sur liste filtrée `isActive=true` → désactiver un établ décalait les numéros suivants. Ajout colonnes `establishments.establishment_number` (NOT NULL, unique par tenant) et `registers.register_number` (NOT NULL, unique par établ). Migration `0013_clean_jetstream.sql` avec backfill `ROW_NUMBER() OVER (PARTITION BY tenant_id/establishment_id ORDER BY id ASC)`. Endpoints `establishments/create` et `registers/create` : `MAX(number)+1` sous `pg_advisory_xact_lock` (sérialise créations concurrentes). `sales/create` lit directement les colonnes (-30 l. de code de calcul). 600 tests / 77 fichiers | ✅ |
| 2026-04-26 | A3 — Tests isolation multi-tenant | 2 axes : (1) audit statique `scripts/audit-tenant-isolation.ts` parcourt les 87 endpoints et flag ceux sans `getTenantIdFromEvent` ou sans `tenantId` dans WHERE/values — 86/87 conformes, 1 public, 0 violation critique. (2) tests d'intégration `tests/unit/tenantIsolation.test.ts` : capture des opérations Drizzle via `globalThis`, helper `setTenant(A|B)` qui override imports explicites + auto-imports Nuxt, 6 tests sur endpoints critiques (clients/products/closures/loyalty) + 2 tests d'audit Vitest qui garantissent que la règle reste appliquée à chaque modif. 608 tests / 78 fichiers, +8 tests | ✅ |
| 2026-04-26 | C4 — CI/CD GitHub Actions | Pipeline 4 jobs : `audit` (audit:tenant + audit:migrations, fail tôt), `lint`, `typecheck` (parallèles), `test` (dépend de audit, upload coverage). `concurrency.cancel-in-progress` pour économiser les minutes. Nouveau script `scripts/audit-migrations.ts` (cohérence fichiers SQL ↔ `_journal.json`, ordre chronologique, contenu non vide, tolère NOOP). Scripts npm : `audit:tenant`, `audit:migrations`, `ci` (pipeline local complet en série). Corrections collatérales : `rateLimit.global.ts` typage `setResponseHeader`, `sentry-example-api.ts` retire import `#imports`, `cart.ts` `as const`, `tsconfig.json` exclude `docs/legacy-migrations/**/*`. Lint : 0 erreur (241 warnings tolérés), typecheck : 0 erreur, 608 tests verts | ✅ |
| 2026-04-26 | C1 — Sentry (observabilité) | Wizard `@sentry/nuxt` installé puis durci pour prod : DSN via `runtimeConfig.public.sentry.dsn` (env var `NUXT_PUBLIC_SENTRY_DSN`, vide = désactivé), `tracesSampleRate` adaptatif (10% prod / 100% dev), `replaysSessionSampleRate` 5% prod / 0 dev (100% sur erreur), `sendDefaultPii: false` par défaut (RGPD), `enableLogs` désactivé en prod (coût quota), `replayIntegration` avec `maskAllText: true` + `blockAllMedia: true`. Côté serveur : lecture directe de `process.env`. Doc `.env.example` complétée. Routes/pages exemples du wizard conservées pour test mais désormais conformes typecheck | ✅ |
| 2026-05-16 | C2 — Monitoring rate limit (A+D) | Reporter `server/utils/rateLimitReporter.ts` : `Sentry.captureMessage` niveau `warning` sur 429 avec throttling 1 event/clé/minute (anti-spam quota), userId+IP hashés SHA-256 tronqué 12 char (RGPD), tenantId en clair pour grouper côté Sentry. Tags `scope/category/isPublic/tenantId`, extras `path/method/limit/windowMs/retryAfterSec/keyHash/userHash/ipHash`. Branchement dans `rateLimit.global.ts` après `logger.warn`. Import h3 explicite retiré (auto-import Nuxt). Tests : 8 unitaires reporter (throttle, hash, omission champs null, isolation clés) + 11 intégration middleware (classification read/mutation/sales-create/public, headers `X-RateLimit-*`, isolation cross-tenant, 429+Retry-After, Sentry hook, throttle). **Reporté** (à faire si besoin terrain) : B stats agrégées admin (endpoint /api/_internal/rate-limit-stats), C détection bruteforce login (3 dépassements/IP/5min → warning). 627 tests / 80 fichiers, +19 tests | ✅ |
| 2026-05-16 | C3 — Backup PostgreSQL automatisé | Pipeline DR complet : workflow GitHub Actions `backup.yml` (cron `0 3 * * *` UTC + `workflow_dispatch`), script bash `scripts/backup-database.sh` (`pg_dump --format=custom --compress=9` → GPG asymétrique recipient = clé publique GitHub → upload R2 via `aws s3 cp --endpoint-url`). Clé privée GPG gardée hors GitHub (1Password) → même si secrets GH compromis, dumps illisibles. User Postgres `backup_readonly` dédié (read-only sur public). Rétention 6 ans via lifecycle rule R2 côté provider (pas de gestion app). Doc runbook complète `docs/runbooks/backup-restore.md` : setup R2/GPG/user PG/secrets (7 secrets GH à configurer manuellement), procédure de restauration testable, distinction archivage NF525 (légal, hash chaînés) vs backup DB (DR). Note plan Free Supabase = 7j backups managés seulement, ce pipeline étend à 6 ans + indépendance fournisseur. Pas de modif code app — purement infra. 627 tests inchangés | ✅ |
| 2026-06-08 | Dashboard cockpit + UI | Refonte dashboard KPI + notes & rappels d'équipe, contraste light mode renforcé | ✅ |
| 2026-06-12 | Audit complet | Audit sécurité/NF525/dette → plan de 21 prompts [docs/audit/11-plan-corrections.md](audit/11-plan-corrections.md), risques ouverts CLAUDE.md actualisés | ✅ |
| 2026-06-28 | Corrections post-audit P1.1→P4.4 | Les 21 prompts du plan exécutés et mergés (1 branche/prompt) : validation x-tenant-id, fix hash saleDate, survente explicite, persistance panier, idempotence clientSaleId, retry+verrou UI, refresh 401, raccourcis clavier, retours+impression auto, vouchers FOR UPDATE, avoirs chaînés credit_note, clôture bloquante, RBAC 3 rôles, productStocks source unique, archives R2, purge any, code mort, singletons→Pinia. Détail par prompt : checklist du plan | ✅ |
| 2026-06-30 | Jour métier Europe/Paris | `businessDay.ts` serveur + sélecteurs JJ/MM/AAAA client — un « jour » n'est plus dérivé de `toISOString` (UTC). Reset seed dynamique de toutes les tables public | ✅ |
| 2026-07-01 | Merge verrou mouvements + hygiène docs | Merge `fix/movements-concurrency-lock` (advisory lock par établissement sur `/api/movements/create`, +2 fichiers de tests) + nettoyage imports 'h3' des utils serveur. Docs resynchronisées avec le code : risques ouverts CLAUDE.md (restent INFOCERT + suppression colonnes stock deprecated), pre-deploy-checklist (numérotation 0013 résolue), retrait « TEST » orphelin du plan. 844 tests / 108 fichiers | ✅ |

---

## 📝 Phase B — détails (2026-04-25)

**B1 — Format API standardisé** ([server/utils/apiResponse.ts](../server/utils/apiResponse.ts))
- `parsePaginationQuery(event)` : `?page=1&limit=50` (max 200), tronque/valide les inputs
- `paginationMeta({ page, limit, total })` → `{ page, limit, total, pages, hasNext, hasPrev }`
- Types `ApiResponse<T>`, `PaginationMeta`, `PaginationParams` exportés
- Approche additive : pas d'imposition de wrapper sur les endpoints existants

**B2 — Pagination clients & produits**
- Backend : 2 requêtes (data + COUNT DISTINCT), filtre `search` migré `having→where` dans clients
- Frontend : composant shadcn `Pagination` (Reka UI), `pageSize=30`, reset page=1 sur recherche/filtre/établissement
- Compat additive : `clients: [...]` / `products: [...]` conservés, `meta.pagination` ajouté à côté

**B3 — Extraction overrides établissement** ([server/utils/productOverrides.ts](../server/utils/productOverrides.ts))
- `applyEstablishmentOverrides(row, establishmentId)` isolé du endpoint
- 27 tests unitaires couvrant fallbacks (TVA 20 %, minStock 5, stock 0), modes global/scoped, `normalizeStockByVariation` array→objet
- Endpoint `/api/products` : 316 → 212 lignes

**B4 — Refactor ColRight** ([composables/useCheckout.ts](../composables/useCheckout.ts))
- Logique `validerVente` + paiements + clôture extraite dans composable réutilisable
- `try/finally` garantit `isSubmitting=false` (vs 8 reset dispersés dans l'original)
- Suppression code mort : génération `receipt` (60 l. de template literal jamais utilisé) + fonction `printReceipt` orpheline
- 21 tests caractérisation (3 → 21) couvrent tous les chemins erreur + payload `submitSale`
- ColRight 442 → 167 lignes (-62 %), n'est plus zone critique 🔴

---

## 📝 D1 — Impression ticket & facture (2026-04-25)

**Architecture** : iframe caché + `window.print()` (plus fiable que `window.open()`, souvent bloqué par les pop-up blockers).

**Fichiers créés** :
- [utils/saleDocuments.ts](../utils/saleDocuments.ts) — générateurs HTML purs : `buildReceiptHtml` (ticket 80mm thermique) + `buildInvoiceHtml` (facture A4 avec détail TVA par taux). Échappement HTML systématique (anti-XSS sur nom produit/client).
- [composables/usePrintDocument.ts](../composables/usePrintDocument.ts) — `printHtml(html)` via iframe `srcdoc`, cleanup auto sur `afterprint` ou timeout 60s.
- [components/caisse/SaleSuccessDialog.vue](../components/caisse/SaleSuccessDialog.vue) — modale shadcn avec 2 gros boutons (icônes Printer / FileText) + fermeture sans imprimer.

**Branchement** :
- [composables/useCheckout.ts](../composables/useCheckout.ts) capture `lastSaleDocument` AVANT `clearCart`/`clearClient`, ouvre la modale après reset.
- [components/caisse/ColRight.vue](../components/caisse/ColRight.vue) gère les handlers `print-receipt` / `print-invoice` qui appellent les générateurs + iframe.

**Tests** : +31 tests (29 sur générateurs HTML — XSS, formats, fallbacks ; 2 sur ouverture/non-ouverture du dialog selon succès/erreur API).

**Note** : impression PDF native via dialog navigateur — pas de dépendance lib externe. Pour ESC/POS thermique direct (sans dialog) : phase ultérieure si besoin terrain.

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
