# Archive des migrations Drizzle (pré-baseline)

> **Archivé le 2026-07-06** — chantier « chaîne de migrations rejouable de zéro »
> (validation explicite règle n°1 CLAUDE.md : décision actée le 2026-07-06,
> cf. [docs/architecture/2026-07-audit-architecture-cible.md](../../../docs/architecture/2026-07-audit-architecture-cible.md) §10).

## ⛔ Ne JAMAIS modifier ni ré-exécuter ces fichiers

Ce dossier est une **archive historique en lecture seule**. Il n'est lu par aucun outil
(`drizzle.config.ts` pointe sur `server/database/migrations/`). Il documente comment le schéma
a été construit entre 2025-12 et 2026-07.

## Pourquoi cette archive existe

La chaîne d'origine (`0000_handy_darwin` → `0024_thankful_pepper_potts`) n'était **pas rejouable
de zéro** : le schéma initial avait été créé via `drizzle-kit push` au début du projet, si bien
que 22 tables sur 33 n'avaient aucun `CREATE TABLE` dans les migrations. Amorcer une base vierge
exigeait `db:push` + `scripts/mark-migrations-applied.ts`, ce qui bloquait les environnements
jetables et le e2e CI.

Le 2026-07-06, la chaîne a été **remplacée par une baseline** (`migrations/0000_baseline.sql`)
générée automatiquement depuis `server/database/schema.ts` par `pnpm db:generate --name baseline`
(aucune édition manuelle). Une base vierge s'amorce désormais par `pnpm db:migrate` seul.

## Contenu

- `0000_*.sql` → `0024_*.sql` + `meta/` : la chaîne Drizzle historique et son journal.
- `0002a_add_generate_movement_number.sql`, `0003a_tenant_columns_if_not_exists.sql`,
  `0011_update_existing_data_establishment.sql` : fichiers **ad-hoc hors journal**, appliqués
  manuellement à l'époque (cf. `scripts/apply-migrations-manual.md`).
- `schema.ts` / `relations.ts` : artefacts d'introspection `drizzle-kit pull` de l'époque —
  **pas** le schéma de référence (qui est `server/database/schema.ts`).

## Choix assumé : `generate_movement_number` non reprise

Le fichier ad-hoc `0002a` créait la séquence `movement_number_seq` et la fonction SQL
`generate_movement_number()`. Elles ne sont **pas reprises** dans la nouvelle chaîne :

- aucun code ne les utilise (seule une mention en commentaire dans
  `server/api/product-stocks/update.post.ts`) ;
- elles sont absentes de `server/database/schema.ts`, donc absentes des bases amorcées par
  `db:push` (staging notamment) ;
- la référence de parité est `schema.ts` : une base construite par la baseline est strictement
  identique à une base construite par `db:push`.

Les anciennes bases qui les possèdent encore (dev historique) portent une dérive inoffensive ;
les supprimer est optionnel (`DROP FUNCTION IF EXISTS generate_movement_number(varchar);
DROP SEQUENCE IF EXISTS movement_number_seq;`).

## Preuve de rejouabilité (exécutée le 2026-07-06)

Sur une base PostgreSQL vierge locale :

```bash
createdb fympos_replay_test
DATABASE_URL="postgres://localhost:5432/fympos_replay_test" pnpm db:migrate
DATABASE_URL="postgres://localhost:5432/fympos_replay_test" pnpm db:seed
pnpm test
```

Parité vérifiée : `pg_dump --schema-only` d'une base construite par `db:push` (ancienne
procédure d'amorçage) vs une base construite par `db:migrate` (nouvelle chaîne) → **diff vide**.

## Bases existantes (dev / staging / prod)

Elles possèdent déjà le schéma : la baseline ne doit **jamais** y être exécutée. Procédure de
bascule : `RUN_BASELINE_SWITCH=1 pnpm tsx scripts/mark-migrations-applied.ts` (remplace le
journal `drizzle.__drizzle_migrations` par la baseline marquée appliquée). Détail par
environnement : [docs/runbooks/deploy-staging-vercel.md](../../../docs/runbooks/deploy-staging-vercel.md),
section « Bascule baseline migrations (2026-07-06) ».
