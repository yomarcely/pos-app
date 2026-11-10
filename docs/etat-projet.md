# État du projet — FymPOS

> **La page à lire en début de session.** Elle dit où en est le projet *maintenant*.
> Elle est **réécrite** à chaque fin de session, pas complétée : ce qui est terminé part dans le
> [journal](journal.md). Les règles sont dans [CLAUDE.md](../CLAUDE.md), les décisions dans le §10 du
> [doc d'architecture](architecture/2026-07-audit-architecture-cible.md), le reste à faire dans la
> checklist du [plan d'exécution](architecture/2026-07-plan-execution-phases-1-2.md).
> Si cette page contredit le code, le code a raison : corriger la page.

**Dernière vérification : 2026-11-10** — commit `38443e0` sur `developpement`
- **CI GitHub : verte** sur `developpement` (`38443e0`) — audits, lint, typecheck, tests. Job e2e sauté volontairement.
- **En local : `pnpm run ci` vert**, après réinstallation propre des dépendances — lint 0 erreur (174 avertissements), typecheck, audit tenant (110 endpoints, aucune violation), audit migrations, 934 tests / 114 fichiers.
- Non vérifié : l'état du staging (code et base). E2e non lancé.

## Branches

| Branche | Rôle | État |
|---|---|---|
| `main` | Staging Vercel | Code du 2026-07-03 (`65a5e35`). En retard de tout le travail fait depuis (le nombre de commits est donné au démarrage de session) |
| `developpement` | Travail quotidien | À jour avec GitHub. Contient A5 (alerting NF525), l'environnement Claude et la remise au vert de la CI |

Aucune branche de travail ouverte, aucune modification en attente.

## Contraintes du moment

- **Aucune dépense tant que l'application n'est ni vendue ni utilisée** (décision de Yohan,
  2026-11-10). Tout ce qui demande une carte bancaire ou un abonnement attend.
- **Deux bases Supabase seulement** (plan gratuit) : **dev**, et **staging** qui sert de « prod »
  pour le déploiement Vercel. Ni base de production séparée, ni projet dédié aux tests. Le fichier
  `.env.production` du poste ne correspond à aucun environnement réel.

## Bloquants

1. **Dérive de schéma à vérifier sur staging**, avant tout merge `developpement` → `main`.
   Trois colonnes peut-être absentes (`sale_items.variation_id`, `customers.is_archived`,
   `customers.archived_at`) ; `db:migrate` ne les rattrapera pas. Procédure en tête du
   [runbook staging](runbooks/deploy-staging-vercel.md). Constaté le 2026-09-10, pas encore fait.
2. **Certification NF525** : signature factice (`TEMP_SIGNATURE_`) tant que le dossier INFOCERT/LNE
   n'a pas abouti. Bloquant légal pour la mise en production réelle.

**Reporté par décision, bloquant avant le premier commerce pilote :**

3. **Sauvegarde automatique de la base.** Le workflow `backup.yml` n'a jamais fonctionné (102 échecs
   sur 102, aucun secret configuré) et GitHub l'a désactivé. Cloudflare R2 exige une carte
   bancaire. Sans conséquence tant qu'il n'y a aucune donnée de commerçant. Le jour venu : 6 secrets
   ([runbook](runbooks/backup-restore.md), §1.4), `gh workflow enable backup.yml`, exercice de
   restauration. Le script parle S3 : tout stockage compatible convient. Laisser désactivé d'ici là.

## Prochaines actions, dans l'ordre

1. **Faire relire A5 par les deux agents relecteurs** avant qu'il parte sur le staging. Le commit
   `c83bba1` modifie trois zones critiques (`sales/create.post.ts`, `sales/close-day.post.ts`,
   `middleware/auth.global.ts`) et n'a jamais été relu par `gardien-nf525` ni `gardien-tenant-auth`,
   créés après lui. Ce sera aussi leur premier essai.
2. Dérouler la vérification de schéma du bloquant n°1.
3. Poser `CRON_SECRET` sur Vercel, puis merger `developpement` dans `main` (déploie le staging).
   Sans le secret, la vérification quotidienne des chaînes NF525 reste muette.
4. Vérifier les aperçus Vercel (voir « Côté fondateur »).
5. A3 (e2e) : le job est sauté sur GitHub tant que la variable de dépôt `E2E_ENABLED` ne vaut pas
   `true`, faute de projet Supabase de test. Sans urgence : le rebrancher sans coût (connexion via
   la base dev avec un utilisateur dédié, ou Supabase en local dans Docker pendant la CI). Détail
   dans [e2e/README.md](../e2e/README.md).
6. Trancher l'hébergement (Vercel serverless ou conteneur) **avant le premier commerce pilote**.

## Côté fondateur (hors code)

- Dossier de certification INFOCERT/AFNOR ou LNE.
- `CRON_SECRET` sur Vercel : gratuit, une valeur aléatoire (`openssl rand -hex 32`).
- **Aperçus Vercel actifs** (constaté sur la PR #4, projet `fym-pos-staging`) : chaque branche
  poussée est déployée. Vérifier dans Vercel que les variables « Preview » ne pointent pas sur la
  base staging, ou désactiver les aperçus.
- **Le dépôt GitHub est public** : code et documentation lisibles par tous. À confirmer que c'est voulu.
- Protection de branche sur `main` : à confirmer (réglage décrit dans le runbook staging).
- `git stash drop` : un stash du 2025-05-30 sans intérêt, que la session Claude ne peut pas supprimer.
- Choix du TPE (Stripe Terminal, SumUp…) et test d'une imprimante thermique 80 mm.

## Reste à faire côté code, sans urgence

- A4a / A4b — RLS PostgreSQL : pas commencé. L'isolation des tenants repose sur le filtrage
  applicatif (`getTenantIdFromEvent` + audit statique `pnpm audit:tenant`).
- B1 → B7 — couche domaine ; B2, B4 et B5 rétrogradés depuis l'abandon de l'offline.
- Suppression des colonnes `products.stock` / `stockByVariation` (gelées) = B7.

## Outillage Claude — en place, en partie éprouvé

Skills `/debut-session` et `/fin-session`, réglages partagés et trois hooks dans `.claude/`, deux
agents relecteurs. Détail de la mise en place : journal du 2026-11-10.

- Éprouvés : `/debut-session`, `/fin-session`, les refus des deux garde-fous.
- **Pas encore éprouvés** : le résumé injecté au démarrage d'une session, les confirmations sur les
  zones critiques en conditions réelles, les deux agents relecteurs (jamais lancés).
- À noter à l'usage : une confirmation qui revient trop souvent, un refus à tort.
- Limite connue : les garde-fous ne voient pas une modification faite par commande shell (`sed -i`).
- **Sur ce poste, un « vert en local » n'est fiable que si `node_modules` vient d'un `pnpm install`
  propre.** En cas d'écart avec la CI, la CI fait foi : reproduire dans une copie propre du dépôt
  (`git worktree` + `pnpm install --frozen-lockfile`).
