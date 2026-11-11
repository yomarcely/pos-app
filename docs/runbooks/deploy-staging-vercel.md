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

## ⚠️ À FAIRE AVANT LE PROCHAIN MERGE `developpement` → `main` (constaté le 2026-09-10)

**Soupçon de dérive de schéma sur staging — à vérifier avant tout déploiement.**

Staging tourne sur le code du **2026-07-03** (`main` = 65a5e35). Les commits en attente sur
`developpement` introduisent trois colonnes, via les migrations `0023` et `0024` du 2026-07-05
(aujourd'hui archivées dans `server/database/migrations-archive/`, absorbées par la baseline) :

| Colonne | Sert à |
|---|---|
| `sale_items.variation_id` | Déstockage des produits à variations + re-stockage des avoirs |
| `customers.is_archived` | Archivage des clients |
| `customers.archived_at` | idem |

**Pourquoi `pnpm db:migrate` ne suffira PAS** : la bascule du 2026-07-06 a *marqué* la baseline
comme appliquée sans l'exécuter. Le journal de staging affirme donc que tout le schéma est en
place. Si ces colonnes n'y sont pas physiquement, `db:migrate` restera silencieusement no-op et
le déploiement produira des erreurs SQL sur la fiche client et sur les ventes à variations.

**Indice qui motive le doute** (non confirmé) : au moment de la bascule, les journaux purgés
comptaient **24 lignes en dev mais 23 en staging** (voir plus bas). Staging avait donc une
migration de retard, et la bascule a effacé l'écart au lieu de le signaler.

### 1. Vérifier (lecture seule, sans risque)

```bash
pnpm env:staging
psql "$DATABASE_URL" -c "
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE (table_name = 'sale_items'  AND column_name = 'variation_id')
     OR (table_name = 'customers'   AND column_name IN ('is_archived','archived_at'))
  ORDER BY table_name, column_name;"
pnpm env:dev
```

Trois lignes attendues. **Moins de trois = dérive confirmée**, appliquer le rattrapage ci-dessous.

### 2. Rattraper si besoin (idempotent, aucune perte de données)

```bash
pnpm env:staging
psql "$DATABASE_URL" -c "
  ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS variation_id integer;
  ALTER TABLE customers  ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;
  ALTER TABLE customers  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;"
pnpm env:dev
```

`ADD COLUMN IF NOT EXISTS` : rejouable sans effet de bord, n'altère aucune donnée existante.
Ne PAS toucher au journal `drizzle.__drizzle_migrations` — la baseline reste marquée appliquée.

### 3. Leçon générale

`mark-migrations-applied.ts` fait une **promesse non vérifiée** : il affirme que le schéma
correspond à la baseline, sans le contrôler. Toute base dont le schéma était en retard au
moment de la bascule porte un écart désormais invisible. Prod a été basculée le même jour
(journal purgé : 1 ligne) — **passer la même vérification sur prod** avant son premier
déploiement réel.

---

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
Suivi de bascule : dev ☑ · staging ☑ · prod ☑ — **tous basculés le 2026-07-06** (journaux
purgés : 24 lignes en dev, 23 en staging, 1 en prod ; `pnpm db:migrate` vérifié no-op sur
les trois). Les bascules ont été faites via l'URL **port 5432** (session) dérivée des
`.env.*` ; aucune autre base à basculer — toute base créée après cette date s'amorce
directement par `pnpm db:migrate`.

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
| `CRON_SECRET` | `openssl rand -hex 32` — **requis** (A5), voir section « Cron de vérification des chaînes » |

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

## Cron de vérification des chaînes NF525 (A5, ajouté le 2026-09-10)

`vercel.json` déclare un cron quotidien sur `GET /api/internal/verify-chains` : il rejoue la
vérification de chaîne NF525 sur le **jour métier précédent**, caisse par caisse, et alerte
Sentry sur toute chaîne cassée. Depuis l'abandon de l'offline, c'est le principal détecteur
de panne silencieuse côté données.

**`CRON_SECRET` est obligatoire.** L'endpoint n'est pas public (règle absolue n°8) : le
middleware `auth.global.ts` vérifie le secret AVANT tout traitement, via la liste
`CRON_ENDPOINTS` distincte de `PUBLIC_ENDPOINTS`. Fail-closed : **si `CRON_SECRET` est absent
de l'environnement, l'endpoint répond 401 et l'alerting est muet**. Vercel envoie
automatiquement `Authorization: Bearer $CRON_SECRET` à ses crons dès que la variable existe
sur le projet — rien d'autre à configurer.

Vérification manuelle après déploiement :

```bash
# 401 attendu sans secret
curl -si https://<url-staging>/api/internal/verify-chains | head -1
# 200 + résumé JSON avec le secret
curl -s -H "x-cron-secret: $CRON_SECRET" https://<url-staging>/api/internal/verify-chains
```

Puis : Vercel → projet → **Settings → Cron Jobs** doit lister le job, et son dernier run doit
être en succès.

**Un run « en succès » ne veut pas dire « chaînes saines ».** Le 200 signifie seulement que le
balayage est allé au bout. L'état des chaînes se lit dans le résumé JSON :

- `registersFailed` > 0 : au moins une chaîne est cassée → alerte Sentry « chaîne de tickets
  cassée ».
- `registersErrored` > 0 : la vérification d'au moins une caisse a **planté** (base
  indisponible, ticket illisible) → alerte Sentry « vérification de chaîne impossible ». Ces
  caisses ne sont **pas vérifiées** : relancer le `curl` ci-dessus le jour même (il recalcule
  le même jour métier), et regarder le log Vercel du run pour le détail de l'erreur.
- Les deux à 0 : toutes les caisses ayant encaissé la veille ont été vérifiées et sont intactes.

Sans DSN Sentry sur l'environnement, aucune alerte ne part : il ne reste que ce résumé et les logs.

**Deux pièges à connaître :**

- *Heure et changement d'heure.* Les crons Vercel sont en **UTC**, sans fuseau. Le schedule
  `0 4 * * *` donne 06:00 en heure d'été (CEST) et 05:00 en heure d'hiver (CET). Ce décalage
  d'une heure est assumé : dans les deux cas on passe après la nuit et avant l'ouverture,
  qui est la seule contrainte. Ne pas « corriger » en changeant le cron deux fois par an.
- *`maxDuration`.* `vercel.json` ne déclare **que** `crons`, volontairement. Le `maxDuration: 60`
  vit dans `nuxt.config.ts` (`nitro.vercel.functions`) et protège des transactions zombies
  (incident du 2026-07-03, section suivante). Ajouter une clé `functions` dans `vercel.json`
  écraserait ce réglage : ne pas le faire sans relire cet incident.

Plan Hobby : un seul cron par jour maximum. Le job actuel tient dans cette limite.

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
