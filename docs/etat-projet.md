# État du projet — FymPOS

> **La page à lire en début de session.** Elle dit où en est le projet *maintenant*.
> Elle est **réécrite** à chaque fin de session, pas complétée : ce qui est terminé part dans le
> [journal](journal.md). Les règles sont dans [CLAUDE.md](../CLAUDE.md), les décisions dans le §10 du
> [doc d'architecture](architecture/2026-07-audit-architecture-cible.md), le reste à faire dans la
> checklist du [plan d'exécution](architecture/2026-07-plan-execution-phases-1-2.md).
> Si cette page contredit le code, le code a raison : corriger la page.

**Dernière vérification : 2026-11-11** — commit `9e90bfc` sur `developpement`
- **CI GitHub : verte** sur `developpement` (`9e90bfc`) — audits, lint, typecheck, tests. Job e2e sauté volontairement.
- **En local : `pnpm run ci` vert** sur `9e90bfc` — lint 0 erreur (174 avertissements), typecheck, audit tenant (110 endpoints : 108 conformes, 1 public, 1 interne cron, aucune violation), audit migrations, 994 tests / 115 fichiers.
- **Build** : `pnpm build` réussi en local sur le code de `fa9c206`, et aperçu Vercel de la PR #5 déployé. La CI GitHub, elle, ne construit pas l'application (le build est dans le job e2e, sauté).
- Non vérifié : l'état du staging (code et base), l'e2e, le contenu réel d'un événement dans Sentry, le cron sur Vercel.

## Branches

| Branche | Rôle | État |
|---|---|---|
| `main` | Staging Vercel | Code du 2026-07-03 (`65a5e35`). En retard de tout le travail fait depuis (le nombre de commits est donné au démarrage de session) |
| `developpement` | Travail quotidien | À jour avec GitHub. Contient A5 (alerting NF525) **relu et corrigé** (PR #5) |

Aucune branche de travail ouverte, aucune modification en attente.

## Contraintes du moment

- **Aucune dépense tant que l'application n'est ni vendue ni utilisée** (décision de Yohan,
  2026-11-10). Tout ce qui demande une carte bancaire ou un abonnement attend.
- **Deux bases Supabase seulement** (plan gratuit) : **dev**, et **staging** qui sert de « prod »
  pour le déploiement Vercel. Le fichier `.env.production` du poste ne correspond à aucun
  environnement réel.

## Bloquants

1. **Dérive de schéma à vérifier sur staging**, avant tout merge `developpement` → `main`.
   Trois colonnes peut-être absentes (`sale_items.variation_id`, `customers.is_archived`,
   `customers.archived_at`) ; `db:migrate` ne les rattrapera pas. Procédure en tête du
   [runbook staging](runbooks/deploy-staging-vercel.md). Constaté le 2026-09-10, pas encore fait.
2. **Certification NF525** : signature factice (`TEMP_SIGNATURE_`) tant que le dossier INFOCERT/LNE
   n'a pas abouti. Bloquant légal pour la mise en production réelle.

**Bloquants avant le premier commerce pilote, pas avant le staging :**

3. **Le cron ne contrôle pas le lien entre deux journées** (relecture d'A5). Il vérifie la veille,
   caisse par caisse, mais ne compare pas le premier ticket du jour au dernier de la veille
   (`verifyTicketChain` dans `server/utils/nf525.ts` ignore le `previousHash` du premier élément).
   Des ventes supprimées en fin de soirée, ou une journée entière effacée sur une caisse, passent
   inaperçues. Piste : charger le dernier ticket de la caisse avant la fenêtre, et comparer nombre
   et dernier ticket à ceux de la clôture. Zone NF525 : plan et tests de caractérisation d'abord.
4. **Sauvegarde automatique de la base** (reportée par décision). `backup.yml` n'a jamais fonctionné
   et GitHub l'a désactivé ; Cloudflare R2 exige une carte bancaire. Le jour venu : 6 secrets
   ([runbook](runbooks/backup-restore.md), §1.4), `gh workflow enable backup.yml`, exercice de
   restauration. Laisser désactivé d'ici là.

## Prochaines actions, dans l'ordre

1. Dérouler la vérification de schéma du bloquant n°1 (bascule d'environnement : accord explicite).
2. Poser `CRON_SECRET` sur Vercel, puis merger `developpement` dans `main` (déploie le staging).
   Juste après : lancer le `curl` du runbook, puis ouvrir un événement dans Sentry et vérifier qu'il
   ne porte ni `authorization`, ni cookie, ni adresse IP, ni contenu de requête.
3. Vérifier les aperçus Vercel (voir « Côté fondateur »).
4. Contrôle du lien entre deux journées (bloquant n°3).
5. A3 (e2e) : job sauté tant que la variable de dépôt `E2E_ENABLED` ne vaut pas `true`. Le
   rebrancher sans coût (base dev avec un utilisateur dédié, ou Supabase local dans Docker pendant
   la CI). Détail dans [e2e/README.md](../e2e/README.md).
6. Trancher l'hébergement (Vercel serverless ou conteneur) **avant le premier commerce pilote**.

## Côté fondateur (hors code)

- Dossier de certification INFOCERT/AFNOR ou LNE.
- `CRON_SECRET` sur Vercel : gratuit, une valeur aléatoire (`openssl rand -hex 32`, pas un mot choisi).
- **Sentry** : vérifier que la règle d'alerte envoie un mail à chaque événement et pas seulement à
  la première apparition (toutes les caisses se regroupent sous une même alerte), et que le
  nettoyage des données sensibles du projet est actif.
- **Aperçus Vercel actifs** : chaque branche poussée est déployée (encore constaté sur la PR #5).
  Vérifier que les variables « Preview » ne pointent pas sur la base staging, ou les désactiver.
- **Le dépôt GitHub est public** : à confirmer que c'est voulu.
- Protection de branche sur `main` : à confirmer (réglage décrit dans le runbook staging).
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

Chantiers : A4a / A4b (RLS PostgreSQL, pas commencé — l'isolation repose sur le filtrage
applicatif et `pnpm audit:tenant`) ; B1 → B7 (couche domaine ; B7 = suppression des colonnes
`products.stock` / `stockByVariation`, gelées).

## Outillage Claude

Skills `/debut-session` et `/fin-session`, trois hooks, deux agents relecteurs dans `.claude/`.

- Éprouvés : les deux skills, le résumé injecté au démarrage, le refus de lecture des `.env`, et les
  deux agents relecteurs (quatre passes le 2026-11-11, constats réels à chaque fois, y compris sur
  les corrections elles-mêmes).
- À confirmer par Yohan : la confirmation sur zone critique lui a-t-elle bien été posée lors de
  l'édition de `server/middleware/auth.global.ts` ?
- Une relecture par agent est coûteuse : la limite d'usage de 5 heures a été atteinte deux fois.
  Un agent interrompu se **reprend** (il garde son travail), il ne se relance pas de zéro.
- Limite connue : les garde-fous ne voient pas une modification faite par commande shell (`sed -i`).
- Un « vert en local » n'est fiable que si `node_modules` vient d'un `pnpm install` propre. En cas
  d'écart avec la CI, la CI fait foi.
