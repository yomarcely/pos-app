# État du projet — FymPOS

> **La page à lire en début de session.** Elle dit où en est le projet *maintenant*.
> Elle est **réécrite** à chaque fin de session, pas complétée : ce qui est terminé part dans le
> [journal](journal.md). Les règles sont dans [CLAUDE.md](../CLAUDE.md), les décisions dans le §10 du
> [doc d'architecture](architecture/2026-07-audit-architecture-cible.md), le reste à faire dans la
> checklist du [plan d'exécution](architecture/2026-07-plan-execution-phases-1-2.md).
> Si cette page contredit le code, le code a raison : corriger la page.

**Dernière vérification : 2026-11-10**
- En local, sur la branche `fix/ci-typecheck` : `pnpm run ci` vert — lint 0 erreur (174 avertissements), typecheck, audits tenant (110 endpoints) et migrations, 934 tests / 114 fichiers. E2e non relancé.
- **CI GitHub sur `developpement` : rouge** (runs sur `d7df920` et `59b21ed`). Lint, audits et tests verts ; **typecheck en échec** sur `components/ui/drawer/Drawer.vue` (TS2698) ; e2e sauté en conséquence. Correctif prêt sur `fix/ci-typecheck`, pas encore vérifié sur GitHub.
- **Sauvegardes automatiques : aucune ne fonctionne** (voir bloquant n°3).
- Non vérifié : état du staging.

## Branches

| Branche | Rôle | État |
|---|---|---|
| `main` | Staging Vercel | Code du 2026-07-03 (`65a5e35`), 17 commits de retard sur `developpement` |
| `developpement` | Travail quotidien | Contient A5 et le chantier environnement Claude complet (phases 1 à 3), poussés le 2026-11-10 |
| `fix/ci-typecheck` | Remettre la CI au vert | Part de `developpement` ; correctif commité, **à pousser et à vérifier sur GitHub** |

Dernier commit de code : 2026-09-11. Aucun développement entre cette date et le 2026-11-10.

## Contraintes du moment

- **Aucune dépense tant que l'application n'est ni vendue ni utilisée** (décision de Yohan,
  2026-11-10). Tout ce qui demande une carte bancaire ou un abonnement attend.
- **Deux bases Supabase seulement** (limite du plan gratuit) : la base **dev**, et la base
  **staging**, qui sert de « prod » pour le déploiement Vercel. Il n'y a pas de troisième projet,
  donc ni base de production séparée ni projet dédié aux tests. Le fichier `.env.production`
  présent sur le poste ne correspond à aucun environnement réel pour l'instant.

## Bloquants

1. **Dérive de schéma à vérifier sur staging**, avant tout merge `developpement` → `main`.
   Trois colonnes peut-être absentes (`sale_items.variation_id`, `customers.is_archived`,
   `customers.archived_at`) ; `db:migrate` ne les rattrapera pas. Procédure de vérification et de
   rattrapage en tête du [runbook staging](runbooks/deploy-staging-vercel.md). Constaté le 2026-09-10, pas encore fait.
2. **Certification NF525** : signature factice (`TEMP_SIGNATURE_`) tant que le dossier INFOCERT/LNE
   n'a pas abouti. Bloquant légal pour la mise en production réelle.

**Reporté par décision, bloquant avant le premier commerce pilote :**

3. **Sauvegarde automatique de la base.** Le workflow `backup.yml` n'a jamais fonctionné (102 échecs
   sur 102 entre le 2026-05-27 et le 2026-09-05, aucun secret configuré sur le dépôt) et GitHub l'a
   désactivé pour inactivité. Cloudflare R2 exige une carte bancaire : reporté le 2026-11-10 (voir
   Contraintes). Sans conséquence aujourd'hui, il n'y a aucune donnée de commerçant à perdre. Le
   jour venu : 6 secrets à poser ([runbook](runbooks/backup-restore.md), §1.4), `gh workflow enable
   backup.yml`, puis l'exercice de restauration. Le script parle le protocole S3 : n'importe quel
   stockage compatible convient, pas seulement R2. Laisser le workflow désactivé d'ici là.

## Prochaines actions, dans l'ordre

1. **Remettre la CI au vert sur `developpement`** : pousser `fix/ci-typecheck`, vérifier que la CI
   passe sur GitHub, puis merger. Mécanisme établi : `vue-tsc` n'était pas une dépendance du projet,
   donc `nuxt typecheck` téléchargeait à chaque fois la dernière version de `vue-tsc` **et de
   TypeScript** au lieu d'utiliser le TypeScript 5.8.3 du projet. Le correctif ajoute `vue-tsc`
   3.3.14 aux dépendances de développement. L'échec vu sur GitHub n'a pas pu être reproduit sur le
   poste : si la CI reste rouge après le correctif, la piste suivante est la version de Node
   (20 sur GitHub, 22 en local).
2. Dérouler la vérification de schéma du bloquant n°1.
3. Poser `CRON_SECRET` sur Vercel, puis merger `developpement` dans `main`.
   Sans le secret, la vérification quotidienne des chaînes reste inaccessible (fermée par défaut).
4. A3 (e2e) : le test de bout en bout **ne tourne pas sur GitHub**. Il lui faut un projet Supabase
   dédié aux tests, impossible avec deux bases gratuites déjà prises (voir Contraintes). Le job est
   donc sauté tant que la variable de dépôt `E2E_ENABLED` ne vaut pas `true` ; il reste lançable en
   local. Sans urgence : choisir une voie sans coût pour le rebrancher (connexion via la base dev
   avec un utilisateur dédié, ou Supabase lancé en local dans Docker pendant la CI). Détail dans
   [e2e/README.md](../e2e/README.md).
5. Trancher l'hébergement (Vercel serverless ou conteneur) **avant le premier commerce pilote**.
6. Chantier environnement Claude : l'éprouver à l'usage — `/fin-session`, le résumé de démarrage et
   les deux agents relecteurs n'ont pas encore servi. Noter ce qui gêne (confirmations trop
   fréquentes, refus à tort) pour l'ajuster.

## Côté fondateur (hors code)

- Dossier de certification INFOCERT/AFNOR ou LNE.
- `CRON_SECRET` sur Vercel : gratuit, une valeur aléatoire à poser (`openssl rand -hex 32`).
- Choix du TPE (Stripe Terminal, SumUp…) et test d'une imprimante thermique 80 mm.
- Reportés avec la sauvegarde (bloquant n°3) : les secrets GitHub du backup et l'exercice de
  restauration.
- À confirmer : Preview Deployments Vercel désactivés et protection de branche sur `main`
  (réglages manuels décrits dans le runbook staging).

## Reste à faire côté code, sans urgence

- A4a / A4b — RLS PostgreSQL : pas commencé. L'isolation des tenants repose aujourd'hui sur le
  filtrage applicatif (`getTenantIdFromEvent` + audit statique `pnpm audit:tenant`).
- B1 → B7 — couche domaine ; B2, B4 et B5 rétrogradés depuis l'abandon de l'offline.
- Suppression des colonnes `products.stock` / `stockByVariation` (gelées) = B7.
- Ménage git : fait le 2026-11-10, sauf un point. Il ne reste que `main` et `developpement`, et
  `package-lock.json` n'est plus suivi (le projet utilise pnpm). Reste un stash du 2025-05-30
  (22 lignes sur `pages/caisse/index.vue`, posé sur le tout premier commit, sans intérêt) :
  `git stash drop` à lancer par Yohan, la session Claude n'y est pas autorisée.

## Chantier en cours — environnement Claude

Objectif : reprendre le projet sans relire six documents, et rendre les règles de CLAUDE.md
mécaniques plutôt que déclaratives. Plan validé le 2026-11-10.

| Phase | Contenu | État |
|---|---|---|
| 1 — Assainir | `.claude/` versionné, CLAUDE.md resynchronisé, cette page, journal rattrapé, README corrigé, permissions resserrées | Fait le 2026-11-10 |
| 2 — Rituels | Skills `/debut-session` et `/fin-session`, `.claude/settings.json` partagé (refus, confirmations, résumé de démarrage via `.claude/hooks/etat-session.sh`), CI aussi sur `developpement` | Fait le 2026-11-10. `/debut-session` essayé et validé par Yohan le jour même. Restent à éprouver : `/fin-session` et le résumé de démarrage |
| 3 — Garde-fous | Hooks `.claude/hooks/garde-zones-critiques.sh` (migrations intouchables, confirmation une fois par session sur les zones 🔴, l'auth et CLAUDE.md) et `garde-env-db.sh` (écritures en base refusées hors base dev) ; agents relecteurs `gardien-nf525` et `gardien-tenant-auth` | Fait et mergé le 2026-11-10. Hooks testés (38 cas simulés, 2 refus constatés en session). Agents **jamais lancés** : à essayer sur le prochain diff qui touche une zone 🔴 |

Limite connue des garde-fous : ils surveillent les outils d'édition et les commandes reconnues. Une
modification de fichier par commande shell (`sed -i`…) ou une commande de base formulée autrement
leur échappe. Ils réduisent le risque d'accident, ils ne remplacent pas la relecture.
