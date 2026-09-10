# Tests e2e (Playwright)

Un seul scénario : [`smoke.spec.ts`](./smoke.spec.ts), le chemin critique complet —

```
login → sélection établissement/caisse → vente (×2) → clôture de journée → vérification de la chaîne NF525
```

Il tourne contre un **build de production** (`node .output/server/index.mjs`, pas `nuxt dev`) et une **vraie base
Postgres** migrée + seedée. Aucun bypass d'auth (`ALLOW_AUTH_BYPASS` — interdit par la règle absolue n°9 du
[CLAUDE.md](../CLAUDE.md)) : la connexion traverse le vrai flux Supabase via le formulaire `/login`.

Ce dossier `e2e/` est volontairement séparé de `tests/` (Vitest) : autre outil, autre cycle de vie (une base de
données + un serveur buildé, pas de mocks), config Playwright dédiée ([`playwright.config.ts`](../playwright.config.ts)
à la racine).

## Lancement local — une commande

```bash
pnpm e2e:local
```

Ce que ça fait ([`run-local.sh`](./run-local.sh)) : démarre un Postgres jetable dans Docker (port `5433` par défaut,
n'interfère pas avec une base de dev existante sur `5432`), applique les migrations, seed la base, build l'app en
mode production, puis lance Playwright (qui démarre et arrête lui-même le serveur buildé). Le conteneur Postgres est
toujours détruit en sortie, même en cas d'échec.

Prérequis :

- **Docker** démarré localement.
- Les variables d'environnement ci-dessous exportées dans le shell (ou dans un `.env` chargé avant la commande,
  par ex. via `direnv` — voir `.envrc`).

### Variables d'environnement requises

| Variable | Description |
|---|---|
| `SUPABASE_URL` | URL du **projet Supabase dédié aux tests** (jamais le projet dev/staging/prod) |
| `SUPABASE_ANON_KEY` | Clé anonyme de ce projet de test |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role de ce projet de test (vérification des tokens côté serveur) |
| `E2E_USER_EMAIL` | Email de l'utilisateur de test seedé dans ce projet Supabase |
| `E2E_USER_PASSWORD` | Mot de passe de cet utilisateur |

`DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`/`NODE_ENV`/`BASE_URL`/`RUN_SEED` sont positionnés
automatiquement par `run-local.sh` — ne pas les définir soi-même avant l'appel (ils seraient écrasés de toute façon).

### Configuration de l'utilisateur Supabase de test (une seule fois)

Le test lit les établissements/caisses/produits seedés par
[`server/database/seed.ts`](../server/database/seed.ts), qui écrit toujours dans le même tenant hardcodé
(tenant "Vape") :

```
f831a590-f365-4302-8aaf-1a7ac06d357d
```

Pour que l'utilisateur de test voie ces données, son **`app_metadata`** dans le projet Supabase de test doit
contenir :

```json
{ "tenant_id": "f831a590-f365-4302-8aaf-1a7ac06d357d" }
```

(À définir via le Dashboard Supabase → Authentication → l'utilisateur → *User Metadata*, ou via l'API Admin
`PUT /auth/v1/admin/users/{id}` avec `{ "app_metadata": { "tenant_id": "..." } }`.)

Sans ce réglage, le test échoue tôt (étape « a. Connexion ») avec un message explicite plutôt que des erreurs
opaques plus loin dans le scénario.

Ne pas définir `app_metadata.role` sur cet utilisateur (ou le mettre à `"admin"`/`"manager"`) : l'étape de clôture
(§03 du CLAUDE.md, RBAC) nécessite au moins le rôle `manager`. Le rôle par défaut sans métadonnée est `admin`
(rétro-compatibilité — voir `server/utils/roles.ts`), donc **ne rien renseigner suffit**.

## CI

Job `e2e` dans [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), après les jobs existants. Il utilise un
service `postgres` GitHub Actions (équivalent CI du conteneur Docker local) et les mêmes variables, fournies via
secrets du repo :

`E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `E2E_SUPABASE_SERVICE_ROLE_KEY`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`.

**Non-bloquant pour l'instant** (`continue-on-error: true`) : ce premier smoke e2e est neuf, on observe sa stabilité
avant de le rendre bloquant. Voir l'issue de suivi référencée dans le job (à créer — le rendre bloquant après
~2 semaines sans flakiness).

## Rapports

En cas d'échec : trace Playwright + vidéo + screenshot conservés (`playwright-report/`, `test-results/`).
Consultation locale : `pnpm exec playwright show-report`.
