# Audit #01 — Cartographie du projet FymPOS

> Date : 2026-03-12
> Auteur : Claude Code (session d'analyse initiale)
> Statut : Lecture seule — aucune modification effectuée

---

## 1. Arbre des dossiers principaux

```
pos-app/
├── server/                     Backend Nitro (Nuxt server engine)
│   ├── api/          (71 routes) Endpoints REST, 1 fichier = 1 route
│   │   ├── sales/              ⚠️ CRITIQUE — ventes + clôtures NF525
│   │   ├── products/           CRUD produits + stock
│   │   ├── clients/            CRUD clients + historique achats
│   │   ├── sync-groups/        Sync inter-établissements
│   │   ├── closures/           Clôtures de caisse (conformité fiscale)
│   │   ├── movements/          Mouvements de stock
│   │   ├── registers/          Caisses enregistreuses
│   │   ├── establishments/     Multi-établissements
│   │   ├── variations/         Variations produits (taille, couleur…)
│   │   ├── categories/         Catégories produits
│   │   ├── brands/             Marques
│   │   ├── suppliers/          Fournisseurs
│   │   ├── tax-rates/          Taux de TVA
│   │   ├── product-stocks/     Stocks par établissement
│   │   ├── archives/           Archivage ventes
│   │   └── database/           Endpoint seed (dev uniquement)
│   ├── database/
│   │   ├── schema.ts           Source de vérité Drizzle (1100 lignes) ⚠️
│   │   ├── connection.ts       Connexion hybride local/cloud
│   │   ├── migrations/         16 fichiers SQL Drizzle
│   │   ├── seed.ts             Données de dev (573 lignes)
│   │   └── *.ts (×8)          Scripts de migration ad-hoc ⚠️ DETTE
│   ├── utils/
│   │   ├── nf525.ts            Conformité fiscale française NF525
│   │   ├── sync.ts             Synchronisation multi-établissements (787 lignes) ⚠️
│   │   ├── audit.ts            Piste d'audit immutable
│   │   ├── tenant.ts           Résolution du tenantId par requête
│   │   ├── logger.ts           Pino logger
│   │   ├── validation.ts       Wrappers Zod pour les événements Nitro
│   │   ├── createMovement.ts   Création atomique de mouvements stock
│   │   └── supabase.ts         Client Supabase serveur (legacy ?)
│   └── validators/             Schémas Zod par domaine (11 fichiers)
│
├── components/      (257 total)
│   ├── ui/          (187)      Composants ShadCN générés — NE PAS ÉDITER
│   ├── caisse/       (8)       Composants caisse ⚠️ CRITIQUE
│   ├── produits/    (11)       Formulaires produits décomposés
│   ├── dashboard/    (5)       Widgets dashboard
│   ├── mouvements/   (3)       Tableau mouvements
│   └── …autres      (43)      shared, common, variations, sync, etc.
│
├── stores/           (7)       Pinia — un store par domaine
│   ├── cart.ts                 ⚠️ CRITIQUE — logique caisse
│   ├── auth.ts                 Authentification + session
│   ├── products.ts (476 lg)    Store produits + variations
│   ├── customer.ts             Store clients
│   ├── sellers.ts              Store vendeurs
│   ├── tickets.ts              Store tickets/commandes en attente
│   └── variationGroups.ts      Store groupes de variations
│
├── composables/      (3)       ⚠️ SOUS-UTILISÉ pour 257 composants
│   ├── useEstablishmentRegister.ts
│   ├── useSupabaseClient.ts
│   └── useToast.ts
│
├── pages/           (20)       Routing Nuxt (file-based)
│   ├── caisse/                 POS principal ⚠️ CRITIQUE
│   ├── produits/               Liste, création, édition (×3)
│   ├── clients/                Liste, création, édition (×3)
│   ├── etablissements/         Liste + synchronisation (×2) ⚠️
│   ├── mouvements/             Mouvements de stock
│   ├── synthese/               Reporting / synthèse
│   ├── clotures/               Historique clôtures
│   ├── stocks/                 Vue des stocks
│   ├── variations/             Gestion variations
│   ├── tva/                    Gestion TVA
│   ├── vendeurs/               Gestion vendeurs
│   ├── dashboard/              Tableau de bord
│   ├── categories/             Catégories
│   ├── login/ + signup/        Auth
│   └── [id]/edit.vue           Édition contextuelle
│
├── types/            (8)       Interfaces TypeScript globales
├── middleware/        (1)       auth.global.ts — guard universel
├── plugins/           (2)       Supabase init + API fetch client
├── lib/               (1)       utils.ts (clsx + tailwind-merge)
├── scripts/           (6)       switch-env.sh, check-env.js, migrations manuelles
├── tests/            (54)       Vitest : api (17), composants (11), pages (8), stores (4), unitaires (14)
└── supabase/migrations/ (1)    Dossier legacy vide (1 entrée)
```

---

## 2. Les 15 fichiers les plus volumineux

| # | Fichier | Lignes | Nature |
|---|---|---|---|
| 1 | `server/database/schema.ts` | **1100** | Schéma Drizzle — toutes les tables |
| 2 | `pages/etablissements/synchronisation.vue` | **1050** | Page Vue monolithique |
| 3 | `pages/produits/[id]/edit.vue` | **891** | Formulaire édition produit |
| 4 | `pages/etablissements/index.vue` | **831** | Page liste établissements |
| 5 | `server/utils/sync.ts` | **787** | Logique sync inter-établissements |
| 6 | `pages/clients/[id]/edit.vue` | **697** | Formulaire édition client |
| 7 | `tests/api/products.test.ts` | 626 | *(test — normal)* |
| 8 | `server/database/seed.ts` | 573 | Données de dev |
| 9 | `pages/mouvements/index.vue` | **569** | Page mouvements |
| 10 | `tests/api/clients.test.ts` | 568 | *(test — normal)* |
| 11 | `server/api/sales/create.post.ts` | **554** | ⚠️ Endpoint vente CRITIQUE |
| 12 | `server/api/sync-groups/[id]/resync.post.ts` | **537** | Resync complète |
| 13 | `tests/api/sales.test.ts` | 522 | *(test — normal)* |
| 14 | `tests/api/variations.test.ts` | 496 | *(test — normal)* |
| 15 | `components/caisse/ColRight.vue` | **488** | Composant caisse ⚠️ |

Les 4 fichiers de tests lourds (626, 568, 522, 496 lignes) sont normaux et reflètent une bonne couverture. Les 11 autres méritent attention.

---

## 3. Comptages

| Catégorie | Nombre | Détail |
|---|---|---|
| **Composants Vue** | **257** | dont 187 ShadCN UI (générés, ne pas éditer) → **70 composants custom** |
| **Pages** | **20** | 15 sections métier + login/signup |
| **Stores Pinia** | **7** | auth, cart, products, customer, sellers, tickets, variationGroups |
| **Composables** | **3** | useEstablishmentRegister, useSupabaseClient, useToast |
| **Routes API** | **71** | réparties sur 16 domaines |
| **Fichiers de tests** | **54** | api (17), composants (11), pages (8), stores (4), unitaires (14) |
| **Migrations SQL** | **16** | dont 4 numéros en double ⚠️ |
| **Scripts migration ad-hoc** | **8** | hors système Drizzle ⚠️ |

---

## 4. Dépendances — anomalies détectées

### Mauvaise classification (dependencies → devDependencies)

| Package | Problème |
|---|---|
| `drizzle-kit` | Outil CLI de migration — doit être en `devDependencies` |
| `pino-pretty` | Formatage humain des logs — dev uniquement, hardcodé dans `logger.ts` (risque prod) |
| `dotenv` | Utilisé uniquement dans `seed.ts` et `sync-sequences.ts` — scripts dev |

### Dépendance suspecte

| Package | Problème |
|---|---|
| `@neondatabase/serverless` | Présent en `dependencies` mais **aucun import direct** dans le code source — arrivé probablement comme dépendance implicite de `@nuxt/image`. À vérifier si réellement nécessaire en prod |

### Dépendances à surveiller (versions récentes, évolution rapide)

| Package | Version | Note |
|---|---|---|
| `zod` | `^4.1.13` | Zod v4 — breaking changes vs v3, migration récente |
| `nuxt` | `^4.0.1` | Nuxt 4 très récent (2025) — stabilité à surveiller |
| `reka-ui` | `^2.3.2` | Successeur de Radix Vue — API encore instable |
| `shadcn-nuxt` | `2.1.0` | Épinglé sans `^` — intentionnel (composants générés) |
| `pinia` | `^3.0.3` | Pinia v3 — breaking changes vs v2 |

Aucune dépendance obsolète évidente. Stack globalement à jour début 2026.

---

## 5. Zones fragiles — analyse

### 🔴 Fragile #1 — Migrations corrompues

Les numéros `0002`, `0003`, `0006`, `0007` ont **chacun deux fichiers SQL** dans `migrations/` :

```
0002_bizarre_hawkeye.sql
0002_add_generate_movement_number.sql
0003_sticky_sentinels.sql
0003_tenant_columns_if_not_exists.sql
0006_bumpy_hannibal_king.sql
0006_seller_establishments.sql
0007_icy_madripoor.sql
0007_sync_multi_establishment.sql
```

Drizzle utilise le numéro de séquence pour l'ordre d'application. Ce doublon est soit un bug, soit une divergence entre branches jamais résolue. **C'est le risque le plus immédiat** : une migration sur une base de données fraîche pourrait échouer ou produire un état incohérent.

### 🔴 Fragile #2 — Deux systèmes de migration coexistent

8 scripts `.ts` ad-hoc existent **en dehors du système Drizzle** :

```
add-register-to-closures-migration.ts
add-tax-rates-migration.ts
apply-categories-migration.ts
apply-closure-migration.ts
apply-variations-migration.ts
make-audit-entity-id-nullable.ts
remove-description-migration.ts
reset-migrations.ts
```

Ces scripts appliquent des DDL directement via `postgres`. Il est impossible de savoir si une base de données cible a reçu ces migrations ou non — Drizzle ne les trace pas dans sa table `__drizzle_migrations`.

### 🟠 Fragile #3 — `pino-pretty` hardcodé en production

Dans `server/utils/logger.ts`, `pino-pretty` est configuré comme transport sans garde `NODE_ENV !== 'production'`. En production, pino-pretty ralentit significativement les logs et génère du bruit inutile. C'est un bug de configuration silencieux.

### 🟠 Fragile #4 — 25 fichiers avec `: any` hors tests

Dont les composants caisse critiques (`ColLeft.vue`, `ColRight.vue`, `AddClientForm.vue`) et `stores/auth.ts`. En strict mode TypeScript, ces `any` sont des trous dans la sécurité des types — particulièrement dangereux dans la caisse où les calculs financiers passent par ces types.

Fichiers concernés :
- `composables/useEstablishmentRegister.ts`
- `stores/auth.ts`
- `utils/productHelpers.ts`
- `components/caisse/AddClientForm.vue`, `ColRight.vue`, `ColLeft.vue`
- `components/produits/form/ProductFormPricing.vue`
- `components/mouvements/SelectedProductsTable.vue`
- `components/signup/SignupForm.vue`, `components/login/LoginForm.vue`
- Toutes les pages : `clients/`, `produits/`, `mouvements/`, `tva/`, `synthese/`, `variations/`, `stocks/`, `clotures/`, `categories/`, `etablissements/`

### 🟠 Fragile #5 — 3 composables pour 70 composants custom

Le ratio est anormal. La logique métier vit soit dans les **stores**, soit directement dans les **pages**. Les pages `synchronisation.vue` (1050 lignes), `edit.vue` produit (891 lignes) et `index.vue` établissements (831 lignes) sont des God Components qui mélangent template, appels API, gestion d'état et logique métier. Difficile à tester, difficile à maintenir.

### 🟡 Fragile #6 — Supabase vs Drizzle : frontière floue

`server/utils/supabase.ts` existe côté serveur alors que toute la DB passe par Drizzle. Deux routes API (`clients/index.post.ts`, `clients/[id].put.ts`) mentionnent Supabase dans leur code. `stores/auth.ts` utilise Supabase Auth. La ligne de démarcation entre "ce qui passe par Drizzle" et "ce qui passe par Supabase" n'est pas documentée.

### 🟡 Fragile #7 — `stores/products.ts` surchargé (476 lignes)

Pour un store Pinia, 476 lignes est beaucoup. Avec seulement 7 stores pour tout le domaine métier, certains stores sont probablement surchargés de responsabilités.

---

## Synthèse

Le code fonctionnel semble solide : bonne couverture de tests (54 fichiers), architecture API cohérente, conformité NF525 intégrée, validation Zod systématique. La fragilité principale est **infrastructure** (migrations en double, scripts ad-hoc, pino-pretty en prod) et **organisation** (pages monolithiques, trop peu de composables). Ces problèmes n'affectent pas la prod aujourd'hui mais rendront chaque refactor plus risqué au fil du temps.

### Priorités — statut (session 2026-03-15)

| # | Priorité | Statut | Référence |
|---|---|---|---|
| 1 | **`pino-pretty` en prod** | ✅ Déjà corrigé (guard `isDevelopment` présent depuis l'origine) | `server/utils/logger.ts` |
| 2 | **Dépendances mal classifiées** (`drizzle-kit`, `pino-pretty`, `dotenv`) | ✅ Déplacées en `devDependencies` — lockfile mis à jour | `package.json` |
| 3 | **`@neondatabase/serverless`** | 📋 Signalé — 0 import direct dans le code source, présence suspecte en `dependencies` | `package.json` |
| 4 | **Clarifier Supabase vs Drizzle** | ✅ Documenté | `docs/architecture/supabase-vs-drizzle.md` |
| 5 | **Audit migrations — doublons 0002/0003/0006/0007** | 📋 Analysé — ⚠️ bug critique sur paire 0007 (ordre alphabétique incorrect) | `docs/audit/05-migrations.md` |
| 6 | **Scripts de migration ad-hoc (×8)** | 📋 Analysé — tous couverts par les migrations Drizzle formelles sauf `reset-migrations.ts` (dangereux) | `docs/audit/05-migrations.md` |
| 7 | **Pages monolithiques → composables** | 📋 Analysé — 10 composables identifiés, plan d'extraction documenté | `docs/audit/06-composables-a-extraire.md` |
| 8 | **`server/api/sales/create.post.ts`** — documenter la logique NF525 | ⏳ Non traité | — |

### Actions en attente de validation

- **CRITIQUE** : Fusionner `0007_icy_madripoor.sql` dans `0007_sync_multi_establishment.sql` (bug d'ordre de migration sur base fraîche)
- **SECONDAIRE** : Archiver les 8 scripts ad-hoc dans `docs/legacy-migrations/`
- **SECONDAIRE** : Décider du sort de `@neondatabase/serverless` (conserver ou supprimer)
- **FUTUR** : Extraire les composables des 3 pages monolithiques (sessions dédiées)
