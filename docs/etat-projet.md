# État du projet — FymPOS

> **La page à lire en début de session.** Elle dit où en est le projet *maintenant*.
> Elle est **réécrite** à chaque fin de session, pas complétée : ce qui est terminé part dans le
> [journal](journal.md). Les règles sont dans [CLAUDE.md](../CLAUDE.md), les décisions dans le §10 du
> [doc d'architecture](architecture/2026-07-audit-architecture-cible.md), le reste à faire dans la
> checklist du [plan d'exécution](architecture/2026-07-plan-execution-phases-1-2.md).
> Si cette page contredit le code, le code a raison : corriger la page.

**Dernière vérification : 2026-11-11 (2e session)** — commit `b2cdf52`, identique sur `developpement` et `main`
- **CI GitHub : verte** sur `b2cdf52`, sur `developpement` et sur `main` — audits, lint, typecheck, tests. Job e2e sauté volontairement.
- **En local : `pnpm run ci` vert** sur le contenu de `b2cdf52` — lint 0 erreur (174 avertissements), typecheck, audit tenant (110 endpoints : 108 conformes, 1 public, 1 interne cron, aucune violation), audit migrations, 994 tests / 115 fichiers.
- **Staging déployé** sur `b2cdf52` (build Vercel réussi). Contrôlé depuis la session, sans identifiants : page de login 200, en-tête CSP sans `unsafe-eval`, cron refusé (401) sans secret et avec un faux secret, API refusées (401) sans connexion, adresse Sentry et environnement `staging` présents dans la page.
- **Déclaré par Yohan, non vu par la session** : cron appelé avec le secret (`registersFailed` et `registersErrored` à 0), parcours caisse (vente, ticket, clôture) correct, cron listé dans Vercel, événement de test arrivé dans Sentry (« ça a l'air bon », sans détail point par point).
- **Schéma de la base staging** : comparé à dev après rattrapage — aucun écart sur les colonnes, contraintes, index, triggers, enums et séquences.
- Non vérifié : l'e2e, `pnpm build` en local (seul le build Vercel a tourné), un passage réel du cron à 4 h UTC, l'effet du réglage « Only build production » (aucun push depuis qu'il est posé).

## Branches

| Branche | Rôle | État |
|---|---|---|
| `main` | Staging Vercel | `b2cdf52`, poussée, déployée. Au même commit que `developpement` (hors commit de clôture, qui n'est que de la documentation) |
| `developpement` | Travail quotidien | À jour avec GitHub |

Aucune branche de travail ouverte, aucune modification en attente. `main` n'a **aucune protection
de branche** sur GitHub (vérifié par l'API) : un push y part sans attendre la CI.

## Contraintes du moment

- **Aucune dépense tant que l'application n'est ni vendue ni utilisée** (décision de Yohan,
  2026-11-10). Tout ce qui demande une carte bancaire ou un abonnement attend.
- **Deux bases Supabase seulement** (plan gratuit) : **dev**, et **staging** qui sert de « prod »
  pour le déploiement Vercel. Le fichier `.env.production` du poste ne correspond à aucun
  environnement réel.

## Bloquants

1. **Certification NF525** : signature factice (`TEMP_SIGNATURE_`) tant que le dossier INFOCERT/LNE
   n'a pas abouti. Bloquant légal pour la mise en production réelle.

**Bloquants avant le premier commerce pilote :**

2. **Le cron ne contrôle pas le lien entre deux journées** (relecture d'A5, reconfirmé dans le code
   le 2026-11-11). Il vérifie la veille, caisse par caisse, mais ne compare pas le premier ticket du
   jour au dernier de la veille (`verifyTicketChain` dans `server/utils/nf525.ts` ignore le
   `previousHash` du premier élément). Des ventes supprimées en fin de soirée, ou une journée
   entière effacée sur une caisse, passent inaperçues. Piste : charger le dernier ticket de la
   caisse avant la fenêtre, et comparer nombre et dernier ticket à ceux de la clôture. Zone NF525 :
   plan et tests de caractérisation d'abord.
3. **Sauvegarde automatique de la base** (reportée par décision). `backup.yml` n'a jamais fonctionné
   et GitHub l'a désactivé ; Cloudflare R2 exige une carte bancaire. Le jour venu : 6 secrets
   ([runbook](runbooks/backup-restore.md), §1.4), `gh workflow enable backup.yml`, exercice de
   restauration. Laisser désactivé d'ici là.

## Prochaines actions, dans l'ordre

1. Contrôle du lien entre deux journées (bloquant n°2).
2. A3 (e2e) : job sauté tant que la variable de dépôt `E2E_ENABLED` ne vaut pas `true`. Le
   rebrancher sans coût (base dev avec un utilisateur dédié, ou Supabase local dans Docker pendant
   la CI). Détail dans [e2e/README.md](../e2e/README.md).
3. Trancher l'hébergement (Vercel serverless ou conteneur) **avant le premier commerce pilote**.

Les prochains merges `developpement` → `main` suivent le [runbook staging](runbooks/deploy-staging-vercel.md) :
attendre la CI verte sur `developpement`, et appliquer les migrations sur staging s'il y en a.

## Côté fondateur (hors code)

- Dossier de certification INFOCERT/AFNOR ou LNE.
- **Demain matin** : Vercel → Cron Jobs, vérifier que le premier passage automatique de 4 h UTC
  (5 h à Paris en hiver) est en succès.
- **Sentry** : confirmer que la règle d'alerte envoie un mail à chaque événement et pas seulement à
  la création d'une alerte, et que « Data Scrubber » et « Prevent Storing of IP Addresses » sont actifs.
- **Aperçus Vercel** : réglage « Only build production » posé par Yohan le 2026-11-11. Au prochain
  push sur `developpement`, le déploiement « Preview » doit apparaître « Canceled ».
- **Protection de branche sur `main`** : absente. Réglage décrit dans le runbook staging.
- **Le dépôt GitHub est public** (vérifié) : à confirmer que c'est voulu. Sa page d'accueil
  déclarée, `fympos.vercel.app`, répond 404 : à corriger ou à retirer.
- `git stash drop` : un stash du 2025-05-30 sans intérêt, que la session Claude ne peut pas supprimer.
- Choix du TPE (Stripe Terminal, SumUp…) et test d'une imprimante thermique 80 mm.

## Reste à faire côté code, sans urgence

Constats de la relecture d'A5 non traités (aucun n'est exploitable aujourd'hui) :
- `PUBLIC_ENDPOINTS` fonctionne par préfixe (`/api/login`, `/api/auth`) dans `auth.global.ts`,
  `rateLimit.global.ts` et l'audit : un futur dossier `server/api/auth…` serait public sans le vouloir.
- Le middleware laisse passer `OPTIONS` avant la garde `CRON_SECRET`. Contenu par l'audit, qui
  exige un suffixe de méthode sur les endpoints internes ; déplacer le `return` serait plus net.
- `GET /api/sales/verify-chain` sans `registerId` sur un commerce multi-caisses mélange les chaînes
  et envoie une fausse alerte « chaîne cassée ». Aucun écran ne l'appelle.
- `server/utils/chainVerification.ts` : lignes de vente lues par `saleId` seul, bornes `from`/`to`
  non testées, plafond de 5000 tickets et limite de 60 s qui tronquent sans le dire.
- Sentry : l'URL et sa query string partent encore (terme de recherche client), ainsi que le message
  d'une erreur de base de données. L'alerte « vérification impossible » n'envoie que le nom de l'erreur.
- `CRON_SECRET` : pas de longueur minimale ; un secret absent rend le cron muet (401 chaque matin).

Constat du 2026-11-11 : **six tables de la base dev n'ont pas la sécurité par ligne (RLS)**, alors
que staging l'a (`notes`, `pending_sales`, `loyalty_config`, `loyalty_vouchers`,
`inventory_preparations`, `inventory_preparation_items`). L'application n'est pas concernée ;
l'exposition par l'API Supabase n'a pas été vérifiée. Détail dans le runbook staging, à reprendre avec A4.

Chantiers : A4a / A4b (RLS PostgreSQL, pas commencé — l'isolation repose sur le filtrage
applicatif et `pnpm audit:tenant`) ; B1 → B7 (couche domaine ; B7 = suppression des colonnes
`products.stock` / `stockByVariation`, gelées).

## Outillage Claude

Skills `/debut-session` et `/fin-session`, trois hooks, deux agents relecteurs dans `.claude/`.

- Éprouvés : les deux skills, le résumé injecté au démarrage, le refus de lecture des `.env`, les
  deux agents relecteurs, et la confirmation demandée avant un `psql` hors base de développement.
- Une vérification sur staging n'exige pas de basculer `.env` : `psql` lit l'adresse dans
  `.env.staging` sans l'afficher, en session `READ ONLY` pour une lecture. Le poste reste sur dev.
- L'adresse publique du staging est dans la mémoire Claude du projet, pas dans le dépôt (public).
- À confirmer par Yohan : la confirmation sur zone critique lui a-t-elle bien été posée lors de
  l'édition de `server/middleware/auth.global.ts` ?
- Une relecture par agent est coûteuse : la limite d'usage de 5 heures a été atteinte deux fois.
  Un agent interrompu se **reprend** (il garde son travail), il ne se relance pas de zéro.
- Limite connue : les garde-fous ne voient pas une modification faite par commande shell (`sed -i`).
- Un « vert en local » n'est fiable que si `node_modules` vient d'un `pnpm install` propre. En cas
  d'écart avec la CI, la CI fait foi.
