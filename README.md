# POS App (Nuxt 4 + PostgreSQL)

Application de point de vente moderne construite avec Nuxt 4 et Vue 3. Elle combine une interface de caisse riche (gestion des produits, variations, stocks et alertes) et un backend PostgreSQL conforme aux contraintes NF525/RGPD décrites dans [`BACKEND_README.md`](./BACKEND_README.md).

## 🚀 Fonctionnalités
- Tableau de bord avec raccourcis vers la caisse, le catalogue, la synthèse et les stocks, plus des alertes en temps réel sur les ruptures ou faibles niveaux de stock.
- Catalogue produits avec groupes de variations (taille, couleur, etc.), gestion des catégories et suivi détaillé des mouvements de stock pour l'audit.
- Ventes chaînées et signées pour répondre aux exigences NF525 (inaltérabilité, traçabilité, archivage) et outils RGPD (consentement, anonymisation, export client) décrits dans le schéma Drizzle.
- API REST Nuxt server routes pour les produits, catégories, fournisseurs, clients, ventes et variations.
- Thème clair/sombre via `@nuxtjs/color-mode`, composants UI ShadCN et icônes Lucide.

## 🧰 Stack technique
- **Nuxt 4 / Vue 3 / TypeScript** pour l'interface et le routing.
- **Pinia** pour l'état (ex. `stores/products.ts` gère les stocks et l'historique des mouvements).
- **Tailwind CSS 4** (plugin Vite) + **shadcn-nuxt** pour la couche UI.
- **Drizzle ORM** + **postgres** pour la base de données (migrations générées par `drizzle-kit`).

## 📦 Structure principale
- `pages/` : vues métier (caisse, produits, stocks, synthèse, etc.).
- `stores/` : logique d'état (produits, variations, etc.).
- `server/api/` : routes API REST.
- `server/database/` : schéma Drizzle et scripts de migration/seed.
- `layouts/` : gabarits dont le layout `dashboard` utilisé sur la page d'accueil interne.

## 🗄️ Configuration de la base de données
La connexion PostgreSQL est construite à partir de `DATABASE_URL` ou, par défaut, des variables suivantes :

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=pos_app
DB_SSL=false
```

Créez un fichier `.env` à la racine avec ces clés (ou renseignez `DATABASE_URL`).

### 🔐 Auth Supabase & multi-tenant
L'authentification et le transport du tenant reposent sur Supabase Auth :
```env
SUPABASE_URL=https://<id>.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_JWT_SECRET=...
DEFAULT_TENANT_ID=<id par défaut si aucun tenant n'est fourni>
```
Chaque requête API attend un `Authorization: Bearer <access_token>` (session Supabase) et un tenant (`x-tenant-id` ou `tenant_id` dans les métadonnées utilisateur). Des policies RLS côté Supabase/PostgreSQL doivent ensuite être ajoutées pour isoler les données par tenant.

## ▶️ Mise en route locale
1) **Installer les dépendances**
```bash
pnpm install
```

2) **Initialiser la base** (PostgreSQL doit être démarré)
```bash
pnpm db:generate   # génère les migrations Drizzle à partir du schéma
pnpm db:migrate    # applique les migrations
pnpm db:seed       # optionnel : données de test
```

3) **Lancer le serveur de dev**
```bash
pnpm dev
```
L'application est disponible sur http://localhost:3000.

## 🧪 Tests
Les tests unitaires s'exécutent avec Vitest :
```bash
pnpm test
```

## 🏗️ Scripts utiles
- `pnpm build` : build de production Nuxt.
- `pnpm preview` : prévisualisation du build.
- `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:push` / `pnpm db:drop` : gestion des migrations.
- `pnpm db:studio` : lance Drizzle Studio.

## 🔗 Conformité et architecture backend
Le document [`BACKEND_README.md`](./BACKEND_README.md) détaille les exigences NF525, RGPD et l'architecture hybride (local + cloud). Vous y trouverez la modélisation complète (ventes, lignes, clients, stocks, audit, synchronisation) et les recommandations de déploiement PostgreSQL.

---

## 📋 Plan d'Amélioration & Roadmap

### ⚠️ État Actuel
Une analyse complète de l'application a identifié plusieurs axes d'amélioration avant la mise en production. Consultez les documents suivants pour le détail :

- **[PLAN_AMELIORATION.md](./PLAN_AMELIORATION.md)** - Plan détaillé des modifications (3 phases)
- **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - Guide pas à pas pour implémenter les changements
- **[PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md)** - Suivi de progression en temps réel

### 🔴 Priorités Critiques (Avant Production)

1. **Signature INFOCERT** - Actuellement temporaire, non conforme NF525
   - Obtenir certificat auprès d'un prestataire agréé (LNE, SGS, Bureau Veritas)
   - Implémenter signature RSA réelle
   - Délai estimé: 2-3 semaines

2. **Sécurité Authentification** - Bypass en mode dev à sécuriser
   - Rendre le bypass explicite avec variable d'environnement
   - Extraire user ID du JWT (supprimer hardcoding)
   - Sécuriser récupération tenant ID

3. **Qualité Code** - 93 console.log et 252+ types `any` à corriger
   - Implémenter logger structuré (pino)
   - Activer TypeScript strict
   - Augmenter couverture tests (objectif: 70%)

### 🚀 Quick Start - Améliorations

```bash
# 1. Vérifier l'état actuel du projet
./scripts/migration-plan.sh check

# 2. Exécuter la Phase 1 (Sécurité - URGENT)
./scripts/migration-plan.sh phase1

# 3. Suivre la progression
# Éditer PROGRESS_TRACKER.md au fur et à mesure
```

### 📊 Scores Qualité

| Catégorie | Actuel | Cible | Écart |
|-----------|--------|-------|-------|
| Architecture | 7/10 | 8/10 | +1 |
| Qualité Code | 5/10 | 8/10 | +3 |
| Sécurité | 6/10 | 9/10 | +3 |
| Tests | 3/10 | 7/10 | +4 |
| Conformité NF525 | 5/10 | 10/10 | +5 |
| Performance | 6/10 | 8/10 | +2 |

### 📅 Calendrier Prévisionnel

- **Semaines 1-2** : Phase 1 - Sécurité & Conformité (URGENT)
- **Semaine 3** : Phase 2 - Qualité Code & Tests
- **Semaine 4** : Phase 2 - API & Documentation
- **Semaine 5** : Phase 3 - Performance & Optimisations
- **Semaine 6** : Finalisation & Tests de non-régression

**Voir [PLAN_AMELIORATION.md](./PLAN_AMELIORATION.md) pour le détail complet.**
