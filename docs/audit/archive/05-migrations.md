# Audit #05 — Migrations SQL

> Date : 2026-03-15
> Auteur : Claude Code (audit session 2)
> Statut : ✅ Actions exécutées — 2026-03-15 (session 4)

---

## Contexte général

Les migrations `0000_handy_darwin.sql` et `0001_wandering_screwball.sql` sont des **NOOPs** (`SELECT 1`).
Cela indique que le schéma initial a été créé via les scripts ad-hoc `.ts` **avant** que Drizzle soit mis
en place comme gestionnaire de migrations. Drizzle a ensuite été greffé par-dessus un schéma existant.

Ce contexte explique les anomalies observées : les doublons de numéros sont probablement nés de la
coexistence des deux systèmes lors de la transition.

---

## Section 1 — Paires de migrations en doublon

### Paire 0002 : `bizarre_hawkeye` vs `add_generate_movement_number`

| | `0002_bizarre_hawkeye.sql` | `0002_add_generate_movement_number.sql` |
|---|---|---|
| **DDL** | CREATE TABLE `establishments` + indexes sur `sale_items`/`sales` | CREATE SEQUENCE `movement_number_seq` + FUNCTION `generate_movement_number()` |
| **Nature** | Drizzle auto-généré (nom aléatoire) | Migration manuelle explicite |
| **Relation** | Complémentaires — DDL totalement différent | Complémentaires |
| **Ordre alphabétique** | `add_generate_movement_number` < `bizarre_hawkeye` | `add` avant `bizarre` |
| **Risque** | `generate_movement_number` créé avant `establishments` — OK (aucune dépendance entre les deux) |

**Verdict** : Pas de contradiction. Les deux sont nécessaires. L'ordre alphabétique est inoffensif ici car les DDL sont indépendants.
**Recommandation** : Renommer `0002_add_generate_movement_number.sql` → `0002a_add_generate_movement_number.sql` pour clarifier la séquence, OU fusionner dans `0002_bizarre_hawkeye.sql`. La priorité est de ne pas créer d'ambiguïté sur une base fraîche.

---

### Paire 0003 : `sticky_sentinels` vs `tenant_columns_if_not_exists`

| | `0003_sticky_sentinels.sql` | `0003_tenant_columns_if_not_exists.sql` |
|---|---|---|
| **DDL** | CREATE TABLE `registers` + FK vers `establishments` + indexes | ALTER TABLE (×15 tables) ADD COLUMN IF NOT EXISTS `tenant_id` + indexes |
| **Nature** | Drizzle auto-généré | Migration manuelle idempotente (`IF NOT EXISTS` partout) |
| **Ordre alphabétique** | `sticky_sentinels` > `tenant_columns` → `tenant_columns` en premier | |
| **Risque** | `registers` ne dépend pas de `tenant_id` pour sa création — ordre inoffensif ici |

**Verdict** : Complémentaires, pas de contradiction. L'idempotence de `tenant_columns` la rend sûre.
**Recommandation** : Même stratégie que pour 0002 — renommer avec suffixe ou fusionner.

---

### Paire 0006 : `bumpy_hannibal_king` vs `seller_establishments`

| | `0006_bumpy_hannibal_king.sql` | `0006_seller_establishments.sql` |
|---|---|---|
| **DDL** | CREATE TABLE `seller_establishments` + CREATE TABLE `tax_rates` + ALTER TABLE (archives, products, sale_items) + FKs + indexes | CREATE TABLE `seller_establishments` seulement (version simplifiée, sans UNIQUE constraint) |
| **Nature** | Drizzle auto-généré (complet) | Migration manuelle partielle |
| **Chevauchement** | `seller_establishments` est créée par LES DEUX | |
| **Conflit** | `seller_establishments` créée deux fois — mais `0006_bumpy_hannibal_king` utilise `CREATE TABLE IF NOT EXISTS`, donc la 2e passe silencieusement si la 1ère est déjà faite | |
| **Ordre alphabétique** | `bumpy` < `seller` → `bumpy` en premier | |

**Verdict** : ⚠️ Redondance partielle. Si les deux sont appliquées dans l'ordre alphabétique :
1. `0006_bumpy_hannibal_king` crée `seller_establishments` avec toutes les contraintes
2. `0006_seller_establishments` tente de créer `seller_establishments` à nouveau → ignoré (`IF NOT EXISTS`)
Résultat net correct, mais la redondance est source de confusion.

**Recommandation** : **Archiver** `0006_seller_establishments.sql` (le renommer en `.sql.bak` ou le déplacer dans `docs/`). La version complète `0006_bumpy_hannibal_king.sql` est suffisante.

---

### Paire 0007 : `icy_madripoor` vs `sync_multi_establishment` ⚠️ RISQUE CRITIQUE

| | `0007_icy_madripoor.sql` | `0007_sync_multi_establishment.sql` |
|---|---|---|
| **DDL** | ALTER TABLE `product_establishments` ADD COLUMN `supplier_id_override`, `category_id_override`, `brand_id_override` | CREATE TABLE `sync_groups` + `sync_group_establishments` + `sync_rules` + `product_stocks` + **`product_establishments`** + `customer_establishments` + `sync_logs` + RLS policies |
| **Dépendance** | `icy_madripoor` ALTER une table créée par `sync_multi_establishment` | |
| **Ordre alphabétique** | `icy` < `sync` → `0007_icy_madripoor` s'exécute EN PREMIER | |
| **Risque** | **CRITIQUE** : `icy_madripoor` tente d'ALTER TABLE `product_establishments` qui n'existe pas encore ! Sur une base fraîche, cette migration ÉCHOUE. |

**Verdict** : 🔴 BUG — Ordre d'application incorrect. Sur une base de développement fraîche, le système de migration Drizzle échouerait à `0007_icy_madripoor.sql` car il essaie d'ALTER une table non encore créée.

**Recommandation** : **Fusionner** les 3 colonnes override de `0007_icy_madripoor.sql` dans `0007_sync_multi_establishment.sql` (après la définition de la table `product_establishments`). Puis supprimer `0007_icy_madripoor.sql`. Cette opération nécessite validation explicite avant exécution.

---

## Section 2 — Scripts de migration ad-hoc

| Script | DDL appliqué | Couvert par migration Drizzle ? | Dans schema.ts ? | Recommandation |
|---|---|---|---|---|
| `apply-closure-migration.ts` | CREATE TABLE `closures` (version initiale sans `register_id`, `tenant_id`) | Oui — 0000 (noop) → schéma existait déjà | Oui (version complète avec `tenantId`, `registerId`) | **Archiver** — supersédé par le schéma actuel |
| `apply-categories-migration.ts` | CREATE TABLE `categories` sans `tenant_id`, ADD COLUMN `category_id` à products | Partiellement — `0003_tenant_columns_if_not_exists` ajoute `tenant_id` après coup | Oui (avec `tenantId`) | **Archiver** — appliqué à l'époque de la transition, inutile aujourd'hui |
| `apply-variations-migration.ts` | CREATE TABLE `variation_groups` + `variations` sans `tenant_id` | Partiellement — même logique que categories | Oui (avec `tenantId`) | **Archiver** |
| `add-register-to-closures-migration.ts` | ALTER TABLE `closures` ADD `register_id` + `establishment_id` + FKs + indexes | Oui — `0006_bumpy_hannibal_king.sql` couvre exactement ce DDL (avec `IF NOT EXISTS`) | Oui | **Archiver** |
| `add-tax-rates-migration.ts` | CREATE TABLE `tax_rates` + ADD `tva_id` à products/sale_items + seed TVA français | Oui — `0006_bumpy_hannibal_king.sql` crée `tax_rates` et ajoute `tva_id` (sans le seed) | Oui | **Archiver** (noter : le seed TVA doit être géré par `db:seed`) |
| `make-audit-entity-id-nullable.ts` | ALTER TABLE `audit_logs` ALTER COLUMN `entity_id` DROP NOT NULL | Oui — `0006_bumpy_hannibal_king.sql` ligne : `ALTER TABLE "audit_logs" ALTER COLUMN "entity_id" DROP NOT NULL` | Oui (`entity_id` est nullable dans schema.ts) | **Archiver** |
| `remove-description-migration.ts` | ALTER TABLE `categories` DROP COLUMN `description` | Non couvert par migration Drizzle formelle | Oui (schema.ts ne définit pas de colonne `description` sur categories) | **Archiver** — change déjà reflété dans schema.ts |
| `reset-migrations.ts` | DELETE FROM `drizzle.__drizzle_migrations` | N/A — outil de maintenance | N/A | ⚠️ **DANGER** — Ne jamais exécuter en production. À déplacer dans `scripts/dev/` avec un commentaire explicite. |

---

## Section 3 — Fichiers supplémentaires à vérifier

Ces fichiers ont été découverts dans `server/database/` mais n'étaient pas dans la liste initiale :

| Script | DDL | Note |
|---|---|---|
| `remove-sync-columns.ts` | Non lu — à vérifier | |
| `update-archives-schema.ts` | Non lu — à vérifier | |
| `sync-sequences.ts` | Synchronise les séquences PostgreSQL (`ALTER SEQUENCE ... RESTART`) | Script d'administration, pas une migration. Importe `dotenv`. |

---

## Section 4 — Ordre d'application correct suggéré

Si la base est recréée from scratch, l'ordre correct devrait être :

```
0000 (noop — point d'ancrage Drizzle)
0001 (noop — point d'ancrage)
0002_add_generate_movement_number  ← séquence + fonction
0002_bizarre_hawkeye               ← table establishments
0003_tenant_columns_if_not_exists  ← colonnes tenant_id (idempotent)
0003_sticky_sentinels              ← table registers
0004_stiff_slyde
0005_new_molly_hayes
0006_bumpy_hannibal_king           ← seller_establishments + tax_rates + alterations
  (0006_seller_establishments ignorable — redondant)
0007_sync_multi_establishment      ← toutes les tables de sync (DOIT venir avant icy_madripoor)
  (0007_icy_madripoor à FUSIONNER dans sync_multi_establishment)
0008_spicy_radioactive_man
0009_cooing_amphibian
0010_add_establishment_tracking
0011_update_existing_data_establishment
```

---

## Section 5 — Risques consolidés

| Risque | Sévérité | Impact |
|---|---|---|
| Paire 0007 : ordre alphabétique incorrect → migration échoue sur base fraîche | 🔴 Critique | Toute nouvelle instance (staging, CI) ne peut pas migrer proprement |
| 8 scripts ad-hoc non tracés par Drizzle | 🟠 Moyen | Impossible de savoir si une base cible est à jour sans les exécuter |
| Paire 0006 : redondance `seller_establishments` | 🟡 Faible | Confusion mais pas de bug (IF NOT EXISTS) |
| Paires 0002 / 0003 : DDL indépendants, ordre inoffensif | 🟢 Infime | Cosmétique |
| `reset-migrations.ts` accessible sans garde | 🟠 Moyen | Exécution accidentelle efface l'historique Drizzle |

---

## Actions effectuées (2026-03-15, session 4)

1. ✅ **BATCH 1 — Bug critique corrigé** : 3 `ADD COLUMN` (`supplier_id_override`, `category_id_override`, `brand_id_override`) insérés dans `0007_sync_multi_establishment.sql` après la définition de `product_establishments`. `0007_icy_madripoor.sql` supprimé.
   - ⚠️ **Résidu** : `_journal.json` (idx 7) référence encore `0007_icy_madripoor` — fichier absent. Correction requise : recréer un noop `0007_icy_madripoor.sql` (`SELECT 1`) pour maintenir l'intégrité du journal. **En attente de validation.**
   - Cohérence confirmée : `schema.ts` lignes 793-795 contient les 3 colonnes.

2. ✅ **BATCH 2 — reset-migrations.ts sécurisé** : déplacé vers `scripts/dev/reset-migrations.ts` avec garde `NODE_ENV === 'production'`. Non référencé dans `package.json`.

3. ✅ **BATCH 3 — 7 scripts ad-hoc archivés** dans `docs/legacy-migrations/` (README ajouté). Exception : `sync-sequences.ts` conservé dans `server/database/` — script actif référencé par `"db:sync-sequences"` dans `package.json`.

4. ✅ **BATCH 4 — 2 scripts supplémentaires analysés et archivés** :
   - `remove-sync-columns.ts` : DROP COLUMN `sync_status`/`synced_at` sur `sales` + DROP TABLE `sync_queue` — colonnes absentes de schema.ts ✅
   - `update-archives-schema.ts` : ADD COLUMN sur `archives` — entièrement couvert par `0006_bumpy_hannibal_king.sql` ✅

5. ✅ **BATCH 5 — Doublons cosmétiques résolus** :
   - `0002_add_generate_movement_number.sql` → `0002a_add_generate_movement_number.sql`
   - `0003_tenant_columns_if_not_exists.sql` → `0003a_tenant_columns_if_not_exists.sql`
   - `0006_seller_establishments.sql` → `docs/legacy-migrations/0006_seller_establishments.sql.bak`

---

## Point ouvert

| Sujet | Statut | Action |
|---|---|---|
| `_journal.json` idx 7 (`0007_icy_madripoor`) — noop recréé | ✅ Résolu | `0007_icy_madripoor.sql` recréé comme `SELECT 1` (intégrité journal maintenue) |
| `sync-sequences.ts` — outil actif dans `package.json` | ✅ Résolu | Déplacé vers `scripts/sync-sequences.ts`, import corrigé, `package.json` mis à jour |

---

*Dernière mise à jour : 2026-03-15 — par Claude Code (session 4 : BATCH 1-5 exécutés)*
