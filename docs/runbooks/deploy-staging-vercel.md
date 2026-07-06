# Runbook — Déploiement staging sur Vercel

> Créé le 2026-07-01. Cible : un environnement staging complet (Vercel + projet Supabase dédié)
> qui suit la branche `main`. La prod sera un 2e projet Vercel, créé plus tard (après
> certification NF525).

## Workflow des branches (décidé le 2026-07-01)

- **`developpement`** : travail quotidien. Pusher librement, rien ne part en staging.
  En local, le code lit `.env` (base Supabase **dev**) quelle que soit la branche.
- **`main`** : merger `developpement` → `main` uniquement quand c'est stable.
  Chaque push sur `main` déclenche le déploiement **staging** sur Vercel.
- **Prod** (plus tard, après certification NF525) : 2e projet Vercel, déclenché par tag ou
  branche `production` dédiée.

⚠️ À chaque merge dans `main` contenant une **nouvelle migration** Drizzle, appliquer les
migrations sur la base staging AVANT ou juste après le déploiement (Vercel ne le fait pas) :

```bash
pnpm env:staging && pnpm db:migrate && pnpm env:dev
```

**Réglages à faire une fois (manuel)** :
1. *Vercel* → Settings du projet → **Git** : désactiver les Preview Deployments (ou configurer
   les variables d'environnement « Preview » sur la base **dev** — sinon une preview de
   `developpement` écrirait dans la base staging).
2. *GitHub* → repo → **Settings → Branches → Add branch ruleset** (ou « Add classic branch
   protection rule ») sur `main` : cocher **Require status checks to pass** et sélectionner les
   jobs de la CI (`audit`, `lint`, `typecheck`, `test`). Le staging ne recevra jamais de code
   dont la CI est rouge.

## Architecture

- **Vercel** (serverless) héberge l'app Nuxt/Nitro — le preset Vercel est auto-détecté au build,
  zéro config.
- **Supabase staging** (projet séparé de dev) fournit Auth + PostgreSQL.
- L'app se connecte à la DB via le **pooler Supabase en Transaction mode (port 6543)** :
  `server/database/connection.ts` le détecte automatiquement (`pooler.supabase.com` + `:6543` →
  `max: 1`, `prepare: false`). Les verrous sont tous `pg_advisory_xact_lock` (portée transaction),
  compatibles pooler — vérifié le 2026-07-01.

## Étape 1 — Créer le projet Supabase staging (manuel, ~10 min)

1. <https://supabase.com/dashboard> → **New project** → nom `fympos-staging`, région **Europe
   (Paris / eu-west-3)**, mot de passe DB fort (le conserver).
2. Noter depuis **Settings → API** : `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` ; depuis **Settings → API → JWT Settings** : `SUPABASE_JWT_SECRET`.
3. Depuis **Connect** (bouton en haut du dashboard), noter DEUX chaînes de connexion :
   - **Transaction pooler (port 6543)** → pour Vercel (`DATABASE_URL` runtime)
   - **Session pooler (port 5432) ou connexion directe** → pour les migrations depuis ta machine
     (les migrations Drizzle passent mal en Transaction mode)

## Étape 2 — Amorcer la base staging (bootstrap)

Remplacer les placeholders de `.env.staging` par les vraies valeurs de l'étape 1.
`DATABASE_URL` = la chaîne **port 5432** (session/directe), c'est elle qu'utilisent les
migrations locales. Ne jamais commiter ce fichier (gitignoré).

Depuis la baseline du 2026-07-06 (chaîne de migrations rejouable de zéro), une base vierge
s'amorce par les migrations seules — plus besoin de `db:push` ni de script de marquage :

```bash
pnpm env:staging                                        # bascule .env → valeurs staging
pnpm db:migrate                                         # crée TOUT le schéma (0000_baseline + suivantes)
pnpm db:seed                                            # optionnel : données de démo
pnpm env:dev                                            # IMPORTANT : rebasculer en dev après
```

Cette procédure vaut pour TOUTE nouvelle base (prod, environnement jetable, e2e CI inclus).

> Historique : avant le 2026-07-06, la chaîne n'était pas rejouable (schéma initial créé via
> `drizzle-kit push`, 22 tables sur 32 sans `CREATE TABLE` — constaté le 2026-07-03 :
> `relation "sale_items" does not exist`). L'ancienne procédure `db:push` +
> `mark-migrations-applied.ts` est obsolète ; l'ancienne chaîne vit dans
> `server/database/migrations-archive/` (README détaillé).

### Bascule baseline migrations (2026-07-06) — bases EXISTANTES uniquement

Les bases qui existaient AVANT la baseline (dev, staging, prod) ont déjà le schéma : la
baseline ne doit **jamais** y être exécutée. Leur journal `drizzle.__drizzle_migrations`
référence l'ancienne chaîne (0000_handy_darwin → 0024_thankful_pepper_potts) et doit être
basculé UNE FOIS sur la nouvelle chaîne, environnement par environnement :

```bash
# 1. Se placer sur l'environnement cible (vérifier DATABASE_URL = port 5432 session/directe)
pnpm env:staging          # ou env:dev / env:prod selon la base à basculer

# 2. Basculer le journal (purge l'ancien journal, marque la baseline comme appliquée)
RUN_BASELINE_SWITCH=1 pnpm tsx scripts/mark-migrations-applied.ts

# 3. Vérification : ne doit RIEN appliquer (sinon STOP — ne pas laisser rejouer la baseline)
pnpm db:migrate

# 4. Rebasculer en dev
pnpm env:dev
```

À faire sur **chaque** base existante avant le prochain `pnpm db:migrate` la concernant
(sinon `db:migrate` tenterait de rejouer la baseline → erreurs `relation already exists`).
Suivi de bascule : dev ☐ · staging ☐ · prod ☐ (cocher ici même après chaque environnement).

## Étape 3 — Créer le projet Vercel (manuel, ~10 min)

1. <https://vercel.com> → **Add New → Project** → importer le repo GitHub `yomarcely/pos-app`.
2. Framework : Nuxt (auto-détecté). Build command : `pnpm build` (défaut). Nom : `fympos-staging`.
3. **Environment Variables** (environnement *Production* du projet Vercel — c'est notre staging) :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | chaîne **Transaction pooler port 6543** (étape 1.3) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_JWT_SECRET` | projet staging |
| `JWT_SECRET` | `openssl rand -base64 64` (différent de dev) |
| `BASE_URL` | l'URL Vercel (ex. `https://fympos-staging.vercel.app`) |
| `BUSINESS_TIMEZONE` | `Europe/Paris` |
| `DPO_EMAIL` | ton email |
| `CUSTOMER_DATA_RETENTION` | `2190` |
| `SENTRY_ENVIRONMENT` | `staging` |
| `NUXT_PUBLIC_SENTRY_DSN` | DSN Sentry (vide = désactivé, OK pour commencer) |
| `INFOCERT_PRIVATE_KEY` / `INFOCERT_MERCHANT_ID` | laisser vide (signature TEMP_ en attendant la certification) |
| `R2_ENDPOINT` / `R2_BUCKET` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | credentials R2 archives — optionnel : sans eux, les archives passent en `pending_export` (comportement prévu P3.6) |

⚠️ Ne PAS définir `ALLOW_AUTH_BYPASS`. `NODE_ENV=production` est posé par Vercel automatiquement
(c'est lui qui active la CSP durcie Q11 et les sample rates Sentry prod).

4. **Deploy**. Chaque push sur `main` redéploiera le staging automatiquement.

## Étape 4 — Vérifications post-déploiement

1. Créer un utilisateur de test : dashboard Supabase staging → **Authentication → Add user**
   (email confirmé), puis dérouler l'onboarding dans l'app.
2. Dérouler [docs/pre-deploy-checklist.md](../pre-deploy-checklist.md) sur l'URL staging :
   - console navigateur sans erreur CSP sur `/login`, `/caisse`, `/produits`,
     `/etablissements/synchronisation` (déjà validé en local le 2026-07-01 — re-vérifier ici)
   - flow complet : vente → ticket → clôture → ticket Z → verify-chain
3. Vérifier les headers : `curl -sI https://<url-staging>/login | grep -i content-security`

## Incidents connus & protections serverless (2026-07-03)

Trois problèmes rencontrés au premier déploiement réel, avec leurs correctifs :

1. **Région** : Vercel déploie par défaut à Washington (iad1) → chaque requête SQL traversait
   l'Atlantique vers la base (eu-west-1). Réglé : *Settings → Functions → Function Region* =
   Paris/Dublin. **À vérifier sur tout nouveau projet Vercel.**
2. **Sockets morts au réveil** : Vercel gèle l'instance entre les requêtes ; une connexion DB
   gardée indéfiniment (`idle_timeout: 0`) est morte au réveil → blocages de `connect_timeout`
   (30s) sur la 1ère requête. Réglé dans `connection.ts` : `idle_timeout: 20`,
   `max_lifetime: 30min`, `connect_timeout: 10`.
3. **Transactions zombies** : la fonction tuée à `maxDuration` (défaut 10s Hobby) en pleine
   transaction de vente laissait le `pg_advisory_xact_lock` posé → toutes les ventes suivantes
   bloquées, caisse paralysée. Réglé par 3 couches :
   - `nuxt.config.ts` : `nitro.vercel.functions.maxDuration = 60`
   - `connection.ts` : option de session `idle_in_transaction_session_timeout=30s`
   - au niveau base (à refaire sur TOUTE nouvelle base, prod incluse) :
     `ALTER DATABASE postgres SET idle_in_transaction_session_timeout = '30s';`

**Recommandé** : activer *Fluid Compute* (Settings → Functions) — instances plus durables,
moins de gels/réveils, durée max plus élevée.

**Diagnostic en cas de caisse figée** (tout bloque après une tentative de vente) :

```sql
-- transactions zombies et verrous advisory posés
SELECT pid, state, now()-state_change AS age, left(query,80) FROM pg_stat_activity
  WHERE state='idle in transaction';
SELECT locktype, objid, granted, pid FROM pg_locks WHERE locktype='advisory';
-- débloquer (rollback automatique du zombie)
SELECT pg_terminate_backend(<pid>);
```

## Limites connues du serverless (acceptées pour staging)

- **Rate limiting en mémoire** : le store est par instance lambda → limites effectives plus laxistes
  que sur un serveur unique. Pour la prod, prévoir Upstash/Redis si besoin réel
  (la signature `checkLimit` est compatible, cf. pre-deploy-checklist Q10).
- **Durée max des fonctions** : si une clôture ou un resync dépasse le timeout Vercel,
  augmenter `maxDuration` (config Nitro/Vercel) — à surveiller sur staging avant la prod.
- **Pas de disque persistant** : sans impact, l'app n'écrit rien sur disque (archives en DB + R2).
