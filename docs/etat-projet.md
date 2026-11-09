# État du projet — FymPOS

> **La page à lire en début de session.** Elle dit où en est le projet *maintenant*.
> Elle est **réécrite** à chaque fin de session, pas complétée : ce qui est terminé part dans le
> [journal](journal.md). Les règles sont dans [CLAUDE.md](../CLAUDE.md), les décisions dans le §10 du
> [doc d'architecture](architecture/2026-07-audit-architecture-cible.md), le reste à faire dans la
> checklist du [plan d'exécution](architecture/2026-07-plan-execution-phases-1-2.md).
> Si cette page contredit le code, le code a raison : corriger la page.

**Dernière vérification : 2026-11-10** — 934 tests / 114 fichiers verts (Vitest, mesurés sur `c83bba1` ; seuls des fichiers de doc et de config ont changé depuis).
Non relancés ce jour : lint, typecheck, e2e. Non vérifiés : état de la CI GitHub, état du staging.

## Branches

| Branche | Rôle | État |
|---|---|---|
| `main` | Staging Vercel | Code du 2026-07-03 (`65a5e35`), 17 commits de retard sur `developpement` |
| `developpement` | Travail quotidien | Contient A5 et le chantier environnement Claude (phases 1 et 2), mergés et poussés le 2026-11-10 |
| `feat/a5-alerting-invariants` | Alerting NF525 (A5) | Mergée dans `developpement` — supprimable |
| `chore/env-claude` | Chantier environnement Claude | Mergée dans `developpement` — supprimable, la phase 3 partira d'une nouvelle branche |

Dernier commit de code : 2026-09-11. Aucun développement entre cette date et le 2026-11-10.

## Bloquants

1. **Dérive de schéma à vérifier sur staging, puis sur prod**, avant tout merge `developpement` → `main`.
   Trois colonnes peut-être absentes (`sale_items.variation_id`, `customers.is_archived`,
   `customers.archived_at`) ; `db:migrate` ne les rattrapera pas. Procédure de vérification et de
   rattrapage en tête du [runbook staging](runbooks/deploy-staging-vercel.md). Constaté le 2026-09-10, pas encore fait.
2. **Certification NF525** : signature factice (`TEMP_SIGNATURE_`) tant que le dossier INFOCERT/LNE
   n'a pas abouti. Bloquant légal pour la mise en production réelle.

## Prochaines actions, dans l'ordre

1. `gh auth login` dans le terminal (GitHub CLI installé le 2026-11-10, pas encore connecté), puis
   lire le résultat de la **première CI sur `developpement`** : `gh run list --branch developpement`.
   Elle n'a jamais tourné sur cette branche, son résultat est inconnu.
2. Dérouler la vérification de schéma du bloquant n°1.
3. Poser `CRON_SECRET` sur Vercel, puis merger `developpement` dans `main`.
   Sans le secret, la vérification quotidienne des chaînes reste inaccessible (fermée par défaut).
4. A3 (e2e) : confirmer que les secrets `E2E_*` sont posés sur GitHub (sans eux le job e2e échoue,
   sans bloquer la CI), observer le job sur quelques runs, puis le rendre bloquant.
5. Trancher l'hébergement (Vercel serverless ou conteneur) **avant le premier commerce pilote**.
6. Chantier environnement Claude : utiliser `/debut-session` et `/fin-session` pendant deux
   semaines, noter ce qui manque, puis phase 3 (ci-dessous).

## Côté fondateur (hors code)

- Dossier de certification INFOCERT/AFNOR ou LNE.
- `CRON_SECRET` sur Vercel.
- Choix du TPE (Stripe Terminal, SumUp…) et test d'une imprimante thermique 80 mm.
- Exercice de restauration d'un backup R2 : la procédure n'a jamais été testée en réel.
- À confirmer : Preview Deployments Vercel désactivés et protection de branche sur `main`
  (réglages manuels décrits dans le runbook staging).

## Reste à faire côté code, sans urgence

- A4a / A4b — RLS PostgreSQL : pas commencé. L'isolation des tenants repose aujourd'hui sur le
  filtrage applicatif (`getTenantIdFromEvent` + audit statique `pnpm audit:tenant`).
- B1 → B7 — couche domaine ; B2, B4 et B5 rétrogradés depuis l'abandon de l'offline.
- Suppression des colonnes `products.stock` / `stockByVariation` (gelées) = B7.
- Ménage git : 4 branches mortes, un stash sur « initial commit », `package-lock.json` suivi alors
  que le projet utilise pnpm.

## Chantier en cours — environnement Claude

Objectif : reprendre le projet sans relire six documents, et rendre les règles de CLAUDE.md
mécaniques plutôt que déclaratives. Plan validé le 2026-11-10.

| Phase | Contenu | État |
|---|---|---|
| 1 — Assainir | `.claude/` versionné, CLAUDE.md resynchronisé, cette page, journal rattrapé, README corrigé, permissions resserrées | Fait le 2026-11-10 |
| 2 — Rituels | Skills `/debut-session` et `/fin-session`, `.claude/settings.json` partagé (refus, confirmations, résumé de démarrage via `.claude/hooks/etat-session.sh`), CI aussi sur `developpement` | Fait le 2026-11-10. `/debut-session` essayé et validé par Yohan le jour même. Restent à éprouver : `/fin-session` et le résumé de démarrage |
| 3 — Garde-fous | Hooks (migrations intouchables, confirmation sur zones 🔴, commandes de base bloquées hors dev), agents relecteurs `gardien-nf525` et `gardien-tenant-auth` | À faire, après deux semaines d'usage de la phase 2 |
