# FymPOS

> Application de point de vente moderne conforme NF525, multi-tenant (SaaS).

FymPOS est une solution POS (Point of Sale) complète construite avec **Nuxt 4** et **Vue 3**. Elle combine une interface de caisse riche (gestion des produits, variations, stocks, alertes) et un backend **PostgreSQL** conforme aux contraintes **NF525** (législation française des systèmes de caisse) et **RGPD**.

## Stack technique

| Catégorie | Technologie |
|-----------|-------------|
| Framework | **Nuxt 4** / Vue 3 / TypeScript (strict) |
| État | **Pinia** (panier, produits, vendeurs, tickets, variations) |
| UI | **Tailwind 4** + **shadcn-nuxt** + **Reka UI** |
| Base de données | **Drizzle ORM** + **PostgreSQL** (Supabase) |
| Authentification | **Supabase Auth** (multi-tenant, RLS) |
| Validation | **Zod** (schémas de validation) |
| Logger | **Pino** (côté serveur) |
| Tests | **Vitest** (37+ fichiers) |

## Structure du projet

```
pages/           Vues métier (caisse, produits, stocks, clients, etc.)
components/      Composants Vue (métier + shadcn-ui)
stores/          Stores Pinia (cart, products, sellers, tickets, etc.)
composables/     Composables Vue (supabase, establishment, toast)
server/api/      73+ endpoints API REST
server/database/ Schema Drizzle, migrations, seed
server/utils/    Utilitaires (auth, audit, nf525, sync, logger)
server/validators/ Schemas Zod pour validation
tests/           37+ fichiers de tests Vitest
docs/            Documentation complète du projet
```

## Multi-tenant & Conformité NF525

- **Multi-tenant** : toutes les tables utilisent `tenantId` pour l'isolation des données
- **NF525** : générateur de hash SHA-256, chaînage des tickets, numérotation conforme
- **RLS** : Row Level Security via Supabase pour l'accès aux données

---

## Mise en route locale

### 1. Installer les dépendances

```bash
pnpm install
```

### 2. Configurer l'environnement

```bash
cp .env.example .env
# Éditer .env avec vos valeurs (DB, Supabase, etc.)
```

### 3. Initialiser la base (PostgreSQL doit être démarré)

```bash
pnpm db:generate   # génère les migrations Drizzle
pnpm db:migrate    # applique les migrations
pnpm db:seed       # optionnel : données de test (RUN_SEED=1)
```

### 4. Lancer le serveur de dev

```bash
pnpm dev
```

## Scripts disponibles

| Commande | Description |
|----------|-------------|
| `pnpm dev` | Serveur de développement |
| `pnpm build` / `pnpm preview` | Build et preview production |
| `pnpm test` / `pnpm test:coverage` | Tests unitaires |
| `pnpm db:generate` | Crée une nouvelle migration Drizzle |
| `pnpm db:migrate` | Applique les migrations |
| `pnpm db:push` | Pousse le schema vers la DB |
| `pnpm db:studio` | Drizzle Studio (interface graphique) |
| `pnpm db:seed` | Seed la base avec des données de test |
| `pnpm env:switch` | Bascule d'environnement (dev/staging/prod) |

## Documentation

Toute la documentation est dans le dossier [`docs/`](./docs/README.md) :

- **[Architecture backend](./docs/architecture-backend.md)** — Architecture et conformité NF525/RGPD
- **[Environnements](./docs/environments.md)** — Configuration dev/staging/prod
- **[Auth Supabase](./docs/auth-supabase.md)** — Authentification et RLS
- **[Synchronisation](./docs/synchronisation.md)** — Sync multi-établissements
- **[NF525](./docs/nf525.md)** — Détails de la conformité
- **[Checklist pré-déploiement](./docs/pre-deploy-checklist.md)** — Avant mise en production
- **[Journal](./docs/journal.md)** — Suivi des sessions de développement

## Points d'attention

> ⚠️ Certaines zones du code nécessitent une attention particulière :

- `server/api/sales/create.post.ts` — Création vente, chaîne NF525
- `server/api/sales/close-day.post.ts` — Clôture journalière, hash NF525
- `server/utils/nf525.ts` — Hash SHA-256, chaînage, numérotation
- `server/database/schema.ts` — Impact sur N endpoints
- `stores/cart.ts` + `utils/cartUtils.ts` — Logique caisse, calculs en centimes
- `composables/useEstablishmentRegister.ts` — Singleton sélection établ./caisse

Voir [CLAUDE.md](./CLAUDE.md) pour les règles absolues et invariants architecturaux.
