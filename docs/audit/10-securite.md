# Audit 10 — Sécurité (série Q)

> Date : 2026-04-23
> Auteur : Claude Code (reconstitution série Q + scan sécurité complet)
> Statut : 🟡 En cours — Q1, Q2, Q4, Q7 ✅ commités | Q3, Q5, Q6, Q8, Q9, Q10, Q11, Q12 ⏳ ouverts
> Périmètre : auth, multi-tenant, validation, secrets, CSP, audit logs, rate limiting

---

## Contexte

La numérotation **Q** vient d'une session du 2026-04-22 où Q1, Q2, Q4 et Q7 ont été corrigés et commités, mais la liste source n'a jamais été persistée. Ce document **reconstitue la série complète** par scan exhaustif de la codebase et **continue la numérotation** pour les findings suivants.

### Vecteurs scannés

| Vecteur | Verdict |
|---|---|
| `PUBLIC_ENDPOINTS` | ✅ 2 entrées, justifiées |
| Auth / `getTenantIdFromEvent` | ✅ Pas d'accès direct à `event.context.auth.tenantId` |
| Service role key (`server/utils/supabase.ts`) | ✅ Importé uniquement par `server/middleware/auth.global.ts` |
| Tenant isolation (queries Drizzle) | ✅ Tous filtrent par `tenantId` |
| Validation Zod | 🟠 3 endpoints sans schéma (Q3) |
| Secrets exposés client | ✅ Aucun |
| CSP / security headers | 🟢 `unsafe-eval` actif en prod (Q11) |
| RLS Supabase | ✅ Auth-only, pas de données métier |
| `localStorage` cross-tenant | 🟠 1 store non scopé (Q5) |
| Logs (PII / tokens) | ✅ Pas de fuite détectée |
| Endpoints destructifs | 🟡 Pas d'audit log (Q6) |
| SQL injection (raw `sql`) | ✅ Pas d'interpolation non paramétrée |
| CORS | ✅ Défaut Nitro |
| Rate limiting | 🟢 Absent (Q10) |
| Error handling | ✅ Pas de stack trace exposée |
| Cookies sensibles | ✅ Non utilisés |
| Audit logs CRUD | 🟢 Manquants hors ventes/clôtures (Q12) |

---

## Résumé exécutif

| # | Sévérité | Sujet | Statut |
|---|---|---|---|
| Q1 | Haute | `/api/database/seed` accessible sans auth + exécutable en prod | ✅ Commit `c66ad24` (2026-04-22) |
| Q2 | Haute | `ALLOW_AUTH_BYPASS=true` silencieux hors dev | ✅ Commit `4288c3c` (2026-04-22) |
| Q3 | Haute | Validation Zod absente sur 3 endpoints POST/PATCH | ✅ Fix 2026-04-23 (24 tests) |
| Q4 | Moyenne | 2 migrations SQL orphelines exécutables fortuitement | ✅ Commit `0ea2871` (2026-04-22) |
| Q5 | Haute | `localStorage pos_selected_seller` non scopé tenant | ✅ Fix 2026-04-23 (5 tests) |
| Q6 | Moyenne | Endpoints DELETE sans `logAuditEvent` | 🟡 Partiel 2026-04-23 (5/13 — reste ⊂ Q12) |
| Q7 | Haute | `localStorage` établissement/caisse cross-tenant | ✅ Commit `07b2d14` (2026-04-22) |
| Q8 | Moyenne | Totaux HT/TVA non revalidés serveur (= risque CLAUDE.md) | ✅ Fix 2026-04-23 (7 tests) |
| Q9 | Moyenne | Anonymisation client RGPD sans audit log | ✅ Fix 2026-04-23 (8 tests) |
| Q10 | Basse | Pas de rate-limiting sur endpoints sensibles | ⏳ Ouvert |
| Q11 | Basse | CSP `unsafe-eval` actif en production | ✅ Fix 2026-04-23 (test preview à faire) |
| Q12 | Basse | Audit logs absents sur CRUD non-vente | ⏳ Ouvert |

---

## Findings ouverts

### Q3 — Validation Zod absente sur 3 endpoints POST/PATCH ✅

- **Sévérité** : Haute
- **Fichiers fixés** :
  - `server/api/archives/create.post.ts` → `createArchiveSchema` (`server/validators/archive.schema.ts` créé)
  - `server/api/sync-groups/[id]/resync.post.ts` → `resyncGroupSchema` (`server/validators/sync.schema.ts`)
  - `server/api/sync-groups/[id]/establishments.patch.ts` → `patchSyncGroupEstablishmentsSchema` (`server/validators/sync.schema.ts`)
- **Tests** : 24 tests unit dans `tests/unit/validators/q3-schemas.test.ts` (création archive, resync, patch establishments). Suite complète : 413 tests verts.
- **Notes** :
  - `createArchiveSchema` valide aussi le **format de période** (`YYYY-MM` pour monthly, `YYYY` pour yearly) via `.refine()` — sécurité renforcée par rapport au check manuel pré-Q3.
  - Les tests handler (`tests/api/archives.test.ts`) ne peuvent pas tester la validation à cause du mock global `validateBody` dans `tests/setup.ts` — c'est pourquoi les schémas sont testés en unit.

---

### Q5 — `localStorage pos_selected_seller` non scopé tenant ✅

- **Sévérité** : Haute
- **Fichier fixé** : `stores/sellers.ts`
- **Tests** : 5 tests dans `tests/stores/sellersStore.test.ts` — hydrate scopé, save scopé, cleanup legacy, fail-closed sans tenantId, scénario cross-tenant explicite (User A/B).
- **Notes** : pattern identique à Q7 (`composables/useEstablishmentRegister.ts`). Helper `scopedKey(tenantId)` local, `cleanupLegacyKey()` appelé dans `initialize()`, watch sur `selectedSeller` lit `useAuthStore().tenantId` à chaque écriture. Si tenantId absent → ne lit ni n'écrit (fail-closed).

---

### Q6 — Endpoints DELETE sans `logAuditEvent` 🟡 Partiel

- **Sévérité** : Moyenne
- **Infra créée** : `server/utils/audit.ts` — helpers `logEntityDeletion` (vraies suppressions) et `logEntityDeactivation` (soft-deletes via `isActive=false`). 2 nouveaux `AuditEventType` : `ENTITY_DELETE`, `ENTITY_DEACTIVATE`.
- **Endpoints couverts (5/13)** :
  - `clients/[id].delete.ts` → `logEntityDeletion`
  - `sync-groups/[id]/delete.delete.ts` → `logEntityDeletion`
  - `establishments/[id]/delete.delete.ts` → `logEntityDeactivation` (soft)
  - `registers/[id]/delete.delete.ts` → `logEntityDeactivation` (soft)
  - `sellers/[id]/delete.delete.ts` → `logEntityDeactivation` (soft)
- **Restants (8/13)** : `products`, `brands`, `suppliers`, `categories`, `tax-rates`, `variations`, `variations/groups`, `products/stock-movements` (déjà audit inline non-helper). Refactor à faire dans **Q12** (audit logs CRUD non-vente, même infra).
- **Découverte** : establishments/registers/sellers font du **soft-delete** (`isActive=false`) ; helper `logEntityDeactivation` distinct pour préserver la sémantique.

---

### Q8 — Totaux HT/TVA non revalidés serveur ✅

> ⚠️ Ce finding **était identique** au risque listé dans `CLAUDE.md` (« Totaux HT/TVA stockés = payload client »). Avec ce fix, le risque CLAUDE.md doit être marqué résolu.

- **Sévérité** : Moyenne (impact fiscal direct)
- **Fichier fixé** : `server/api/sales/create.post.ts` après `validateTotalTTC` (l.247)
- **Mécanisme** :
  1. Nouvelle fonction `recomputeHTandTVA` dans `server/utils/financialValidation.ts` — décompose chaque ligne par taux TVA (`unitPrice × quantity` puis `HT = TTC / (1 + tva%)`).
  2. Comparaison payload HT/TVA vs serveur via `validateTotalTTC` (tolérance 2 cents — LRM).
  3. Assertion stricte `HT + TVA = TTC` sur le payload (tolérance 1 cent) — détecte un attaquant qui mentirait sur HT/TVA mais avec une somme cohérente.
  4. Si l'un échoue → `createError({ statusCode: 400 })`.
- **Tests** : 7 tests dans `tests/unit/financialValidation.test.ts` (TVA 20%, 5.5%, multi-TVA, panier vide, fraude TVA=0).
- **Limite résiduelle** : tolérance 2 cents → fraude max ±2 cents par vente. Négligeable. Les valeurs payload sont conservées dans le hash NF525 (pas de remplacement par le calcul serveur) pour préserver l'intégrité de la chaîne.
- **À faire** : retirer la mention « Totaux HT/TVA stockés = payload client » des risques ouverts du `CLAUDE.md`.

---

### Q9 — Anonymisation client RGPD sans audit log ✅

- **Sévérité** : Moyenne (RGPD)
- **Fichier fixé** : `server/api/clients/[id]/anonymize.post.ts`
- **Constat à la mise en œuvre** : un audit log existait déjà via `db.insert(auditLogs)` inline — mais hors du helper centralisé. Refactor pour utiliser `logCustomerAnonymization` (nouveau helper dans `server/utils/audit.ts`).
- **Mécanisme** :
  - Action `AuditEventType.CUSTOMER_ANONYMIZE`
  - Snapshot des champs PII (firstName, lastName, email, phone, address) avant anonymisation
  - Metadata avec `anonymizedAt` + `reason` (défaut "RGPD - droit à l'oubli", surchargeable)
  - `userId: null` + `userName: auth.user.email` (pas d'ID legacy disponible côté Supabase)
- **Tests** : 3 tests dans `tests/unit/audit-helpers.test.ts` (snapshot complet, raison custom, omission des null).

---

### Q10 — Pas de rate-limiting

- **Sévérité** : Basse
- **Périmètre** : global (pas de middleware détecté, `nuxt.config.ts` sans `routeRules` rate-limit)
- **Risque** : brute-force sur login, énumération clients, création massive de ventes frauduleuses, DoS applicatif.
- **Fix** : middleware Nitro avec stockage en mémoire (dev) / Redis (prod). Clé `tenantId + userId + route`. Cibles : 10 req/min sur POST `/api/sales/*`, `/api/clients/create`, login Supabase ; 100 req/min sur les GET. À faire après Q3-Q9.

---

### Q11 — CSP `unsafe-eval` actif en production ✅

- **Sévérité** : Basse
- **Fichier fixé** : `nuxt.config.ts` (CSP conditionnée par `NODE_ENV`)
- **Mécanisme** : ternaire dans le tableau CSP — en prod `script-src 'self' 'unsafe-inline'` (sans `'unsafe-eval'`), en dev les 3 sont conservés pour le HMR Vue/Nuxt.
- **À faire (validation manuelle)** : déployer en preview/staging et vérifier que la console navigateur ne reporte aucune violation `script-src` (Vue/Nuxt en mode prod build n'utilise normalement pas `eval` mais certaines libs tierces le peuvent — typiquement Vue I18n compilé avec template runtime).
- **Note** : `unsafe-inline` reste actif (inévitable sans nonces sur scripts/styles inline générés par Vue). Durcir davantage = chantier `nonce-based CSP` (hors scope).

---

### Q12 — Audit logs absents sur CRUD non-vente

- **Sévérité** : Basse
- **Périmètre** : tous les endpoints CRUD hors `sales/` (products, establishments, registers, sellers, suppliers, brands, categories, tax-rates, variations)
- **Risque** : modifications de configuration non tracées. Difficile d'auditer un changement de TVA, désactivation d'établissement, modif de catégorie, etc.
- **Fix** : helpers `logEntityCreation`, `logEntityUpdate`, `logEntityDelete` avec diff avant/après. Couplé à Q6 (même infra). Roll-out progressif : commencer par les entités touchant la conformité (TVA, établissements, caisses).

---

## Findings clos

Voir messages de commit pour le détail :
- **Q1** — `c66ad24 fix(security): Q1 — retire /api/database/seed de PUBLIC_ENDPOINTS + guard dev-only`
- **Q2** — `4288c3c fix(security): Q2 — fail-closed au boot si ALLOW_AUTH_BYPASS=true hors dev`
- **Q4** — `0ea2871 fix(security): Q4 — archive les 2 migrations SQL orphelines`
- **Q7** — `07b2d14 fix(security): Q7 — scope localStorage par tenantId dans useEstablishmentRegister`

---

## Recommandation d'ordre d'attaque

1. **Q3** (validation Zod) — 30 min, pattern existant à recopier
2. **Q5** (localStorage seller) — 30 min, copier exactement le pattern Q7
3. **Q8** (HT/TVA serveur) — 1 h, utilitaire déjà disponible
4. **Q6 + Q9** (audit logs DELETE + anonymize) — 2 h, créer l'infra générique d'abord
5. **Q11** (CSP unsafe-eval) — 15 min, mais tester en preview obligatoire
6. **Q12** (audit logs CRUD) — chantier itératif, à faire entité par entité
7. **Q10** (rate limiting) — 1 jour, dépend du choix infra (mémoire vs Redis)
