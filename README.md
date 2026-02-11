# POS App (Nuxt 4 + PostgreSQL)

Application de point de vente moderne construite avec Nuxt 4 et Vue 3. Elle combine une interface de caisse riche (gestion des produits, variations, stocks et alertes) et un backend PostgreSQL conforme aux contraintes NF525/RGPD.

## Stack technique
- **Nuxt 4 / Vue 3 / TypeScript** pour l'interface et le routing.
- **Pinia** pour l'état (panier, produits, vendeurs, tickets, variations).
- **Tailwind CSS 4** + **shadcn-nuxt** pour la couche UI.
- **Drizzle ORM** + **PostgreSQL** (Supabase) pour la base de données.
- **Supabase Auth** pour l'authentification et le multi-tenant (RLS).
- **Vitest** pour les tests unitaires.

## Structure du projet
```
pages/           Vues metier (caisse, produits, stocks, clients, etc.)
components/      Composants Vue (metier + shadcn-ui)
stores/          Stores Pinia (cart, products, sellers, tickets, etc.)
composables/     Composables Vue (supabase, establishment, toast)
server/api/      73+ endpoints API REST
server/database/ Schema Drizzle, migrations, seed
server/utils/    Utilitaires (auth, audit, nf525, sync, logger)
server/validators/ Schemas Zod pour validation
tests/           37+ fichiers de tests Vitest
docs/            Documentation complete du projet
```

## Mise en route locale

1) **Installer les dependances**
```bash
pnpm install
```

2) **Configurer l'environnement**
```bash
cp .env.example .env
# Editer .env avec vos valeurs (DB, Supabase, etc.)
```

3) **Initialiser la base** (PostgreSQL doit etre demarre)
```bash
pnpm db:generate   # genere les migrations Drizzle
pnpm db:migrate    # applique les migrations
pnpm db:seed       # optionnel : donnees de test
```

4) **Lancer le serveur de dev**
```bash
pnpm dev
```

## Scripts utiles
- `pnpm dev` : serveur de developpement
- `pnpm build` / `pnpm preview` : build et preview production
- `pnpm test` / `pnpm test:coverage` : tests unitaires
- `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:push` : gestion migrations
- `pnpm db:studio` : Drizzle Studio (interface graphique DB)
- `pnpm db:seed` : seeder la base avec des donnees de test

## Documentation

Toute la documentation est dans le dossier [`docs/`](./docs/README.md) :
- Architecture backend et conformite NF525/RGPD
- Configuration des environnements (dev/staging/prod)
- Authentification Supabase et Row Level Security
- Synchronisation multi-etablissements
- Plan d'amelioration et suivi de progression
