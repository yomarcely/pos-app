# État du projet — FymPOS

> **La page à lire en début de session.** Elle dit où en est le projet *maintenant*.
> Elle est **réécrite** à chaque fin de session, pas complétée : ce qui est terminé part dans le
> [journal](journal.md). Les règles sont dans [CLAUDE.md](../CLAUDE.md), les décisions dans le §10 du
> [doc d'architecture](architecture/2026-07-audit-architecture-cible.md), le reste à faire dans la
> checklist du [plan d'exécution](architecture/2026-07-plan-execution-phases-1-2.md).
> Si cette page contredit le code, le code a raison : corriger la page.

**Dernière vérification : 2026-11-11 (3e session)** — commit `c7e82fe` sur `developpement` (hors commit de clôture, documentation seule)
- **En local : `pnpm run ci` vert** sur `c7e82fe` — lint 0 erreur (174 avertissements), typecheck, audit tenant (110 endpoints : 108 conformes, 1 public, 1 interne cron, aucune violation), audit migrations, 1047 tests / 116 fichiers.
- **Base dev, lecture seule** : les nouveaux contrôles du cron appliqués aux 6 journées de caisse de l'historique (10 ventes, 4 clôtures) — aucune fausse alerte. Le vrai handler du cron lancé deux fois contre dev : résumé correct, 0 anomalie (il a écrit ses lignes d'audit en base dev).
- **Non vérifié cette session** : la CI GitHub sur `c7e82fe` (pas encore poussé au moment de la vérification) ; le staging, qui tourne toujours sur `b2cdf52` **sans** le nouveau contrôle ; la détection d'une vraie suppression sur une base réelle (il aurait fallu supprimer des ventes — couverte par les tests seulement) ; la garde par secret du cron (non modifiée, non rejouée) ; l'e2e ; `pnpm build` en local ; un passage réel du cron à 4 h UTC ; l'effet du réglage « Only build production ».
- **Hérité de la session précédente, non revu** : CI GitHub verte et staging déployé sur `b2cdf52` ; parcours caisse, cron avec secret et Sentry déclarés corrects par Yohan sur le staging.

## Branches

| Branche | Rôle | État |
|---|---|---|
| `main` | Staging Vercel | `b2cdf52`, poussée, déployée. **En retard** : ne contient pas le contrôle du lien entre journées |
| `developpement` | Travail quotidien | `c7e82fe` + deux commits de documentation. Poussée en fin de session du 2026-11-11 ; CI GitHub non constatée |

Aucune branche de travail ouverte. `main` n'a **aucune protection de branche** sur GitHub : un
push y part sans attendre la CI.

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

2. **Sauvegarde automatique de la base** (reportée par décision). `backup.yml` n'a jamais fonctionné
   et GitHub l'a désactivé ; Cloudflare R2 exige une carte bancaire. Le jour venu : 6 secrets
   ([runbook](runbooks/backup-restore.md), §1.4), `gh workflow enable backup.yml`, exercice de
   restauration. Laisser désactivé d'ici là.

**Résolu le 2026-11-11, pas encore sur le staging** : le cron contrôle le raccord entre deux
journées et compare chaque journée à sa clôture (`server/utils/chainDayBoundaries.ts`, `7c5f719`).

## Prochaines actions, dans l'ordre

1. **Mettre le contrôle du lien entre journées sur le staging** : CI verte sur `developpement`,
   puis merge vers `main` selon le [runbook staging](runbooks/deploy-staging-vercel.md). Aucune
   migration. Au premier passage du cron, lire le résumé : deux champs nouveaux,
   `registersWithoutClosure` et `lateClosuresChecked`. Si des ventes ont été purgées à la main sur
   le staging alors qu'une clôture existe pour la veille, l'alerte partira, à juste titre.
2. **À trancher par Yohan : faut-il une vérification complète périodique avant le pilote ?** Le
   cron ne relit que la veille (et les journées clôturées en retard) : une suppression portant sur
   un jour plus ancien n'est revue par aucun passage automatique.
3. A3 (e2e) : job sauté tant que la variable de dépôt `E2E_ENABLED` ne vaut pas `true`. Le
   rebrancher sans coût (base dev avec un utilisateur dédié, ou Supabase local dans Docker pendant
   la CI). Détail dans [e2e/README.md](../e2e/README.md).
4. Trancher l'hébergement (Vercel serverless ou conteneur) **avant le premier commerce pilote**.

## Côté fondateur (hors code)

- Dossier de certification INFOCERT/AFNOR ou LNE.
- **Le 2026-11-12 au matin** : Vercel → Cron Jobs, vérifier que le premier passage automatique de
  4 h UTC (5 h à Paris en hiver) est en succès.
- **Sentry** : confirmer que la règle d'alerte envoie un mail à chaque événement et pas seulement à
  la création d'une alerte, et que « Data Scrubber » et « Prevent Storing of IP Addresses » sont actifs.
- **Aperçus Vercel** : réglage « Only build production » posé le 2026-11-11. Au prochain push sur
  `developpement`, le déploiement « Preview » doit apparaître « Canceled ».
- **Protection de branche sur `main`** : absente. Réglage décrit dans le runbook staging.
- **Le dépôt GitHub est public** (vérifié le 2026-11-11) : à confirmer que c'est voulu. Sa page
  d'accueil déclarée, `fympos.vercel.app`, répond 404 : à corriger ou à retirer.
- `git stash drop` : un stash du 2025-05-30 sans intérêt, que la session Claude ne peut pas supprimer.
- **Base dev** : la caisse 1 a une vente le 2026-11-10 sans clôture ; elle refusera toute vente
  tant que cette journée n'est pas clôturée (page Synthèse).
- Choix du TPE (Stripe Terminal, SumUp…) et test d'une imprimante thermique 80 mm.

## Reste à faire côté code, sans urgence

Limites du contrôle de chaîne, connues et documentées dans le code :
- **Ce que la chaîne seule ne voit pas** : les toutes dernières ventes supprimées avant toute
  clôture et toute vente suivante, ou une journée effacée avec sa clôture. Il faut un témoin
  extérieur (recoupement avec le journal d'audit, archive signée) — à traiter avec la certification.
- **Vente validée pendant qu'un autre poste clôture la même caisse** : ni `create.post.ts` ni
  `close-day.post.ts` ne prennent de verrou ; la vente échapperait à la clôture et le cron
  alerterait (écart de nombre). Supposé à la lecture du code, non reproduit.
- Le hash de clôture n'est pas recalculable (l'horodatage hashé n'est pas stocké).
- Deux ventes à cheval sur minuit avec des horloges d'instances divergentes : fausse alerte
  possible (ordre `id` ≠ ordre `saleDate`). Non analysé au-delà de la lecture.
- **Contrat miroir** : le comptage de `chainDayBoundaries.ts` reproduit celui de
  `close-day.post.ts`. Changer l'un sans l'autre = fausse alerte chaque nuit. Figé par
  `tests/api/closeDay.test.ts` et inscrit dans les zones critiques de `CLAUDE.md`.

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
- `pnpm audit:tenant` ne parcourt que `server/api` : l'isolation d'un module de `server/utils`
  repose sur ses propres tests.

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
- Les deux relectures du 2026-11-11 (3e session) ont abouti sans atteindre la limite d'usage ;
  celle de `gardien-nf525` a trouvé deux corrections utiles et un cas non couvert.
- Une vérification sur staging n'exige pas de basculer `.env` : `psql` lit l'adresse dans
  `.env.staging` sans l'afficher, en session `READ ONLY` pour une lecture. Le poste reste sur dev.
- Vérifier des requêtes sur de vraies données sans serveur : un script `tsx -r dotenv/config` hors
  dépôt, qui importe les modules du projet par chemin absolu (fait le 2026-11-11, base dev).
- L'adresse publique du staging est dans la mémoire Claude du projet, pas dans le dépôt (public).
- À confirmer par Yohan : la confirmation sur zone critique lui a-t-elle bien été posée lors de
  l'édition de `server/middleware/auth.global.ts` ?
- Limite connue : les garde-fous ne voient pas une modification faite par commande shell. Le
  2026-11-11, plusieurs fichiers ont été édités par script (cron, alerte, audit, tests) ; aucun
  n'est une zone 🔴.
- Un « vert en local » n'est fiable que si `node_modules` vient d'un `pnpm install` propre. En cas
  d'écart avec la CI, la CI fait foi.
