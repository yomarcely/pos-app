# Documentation FymPOS

> Le contrat de travail et les invariants du projet sont dans [CLAUDE.md](../CLAUDE.md) — à lire en premier.
> Cet index ne liste que des documents **vivants**. Ce qui est terminé part dans un dossier `archive/`.

## 🧭 Où je vais — architecture & roadmap

| Document | À lire quand |
|---|---|
| [etat-projet.md](etat-projet.md) | **En début de session.** Où en est le projet maintenant : branches, bloquants, prochaines actions. Une page, réécrite à chaque fin de session |
| [architecture/2026-07-audit-architecture-cible.md](architecture/2026-07-audit-architecture-cible.md) | Document de référence : état des lieux, architecture cible, roadmap. **Le tableau « Décisions actées » (§10) est la mémoire longue du projet** — toute décision structurante s'y ajoute |
| [architecture/2026-07-plan-execution-phases-1-2.md](architecture/2026-07-plan-execution-phases-1-2.md) | Les prompts prêts à jouer, un par session, avec la checklist d'avancement |
| [architecture/supabase-vs-drizzle.md](architecture/supabase-vs-drizzle.md) | Comprendre la frontière Auth (Supabase) / DB (Drizzle) |
| [audit/11-plan-corrections.md](audit/11-plan-corrections.md) | Le plan post-audit de juin 2026 — terminé (P1.1→P4.4), gardé comme référence des corrections apportées |

## 🚀 Mettre en production

| Document | À lire quand |
|---|---|
| [pre-deploy-checklist.md](pre-deploy-checklist.md) | Avant chaque mise en production |
| [runbooks/deploy-staging-vercel.md](runbooks/deploy-staging-vercel.md) | Déployer sur staging, ou diagnostiquer un incident serverless (5 incidents documentés) |
| [environments.md](environments.md) | Configurer dev / staging / prod, basculer avec `pnpm env:switch` |

## 🔧 Exploiter au quotidien

| Document | À lire quand |
|---|---|
| [runbooks/backup-restore.md](runbooks/backup-restore.md) | Sauvegarder ou **restaurer** la base (⚠️ procédure jamais testée en réel) |
| [runbooks/nf525-archive-export.md](runbooks/nf525-archive-export.md) | Produire une archive NF525 pour un contrôle fiscal |
| [tests-manuels.md](tests-manuels.md) | Recette manuelle complète — reste la référence tant que la suite e2e ne couvre que le chemin critique |

## 📚 Comprendre le métier

| Document | À lire quand |
|---|---|
| [synchronisation.md](synchronisation.md) | Comprendre la sync multi-établissements (stock indépendant, prix locaux, règles) |
| [journal.md](journal.md) | Retrouver *quand* et *pourquoi* quelque chose a été fait |

## 🗄️ Archives — valeur historique, ne pas s'y fier pour agir

- [audit/archive/](audit/archive/) — les 10 audits de mars-avril 2026, tous exécutés
- [legacy-migrations/](legacy-migrations/) — scripts de migration d'avant Drizzle (⚠️ ne jamais exécuter)
- `server/database/migrations-archive/` — la chaîne de migrations d'avant le squash baseline du 2026-07-06

## Ailleurs dans le dépôt

- Logger Pino : [`server/utils/LOGGER_USAGE.md`](../server/utils/LOGGER_USAGE.md)
- Dépannage migrations Supabase : [`scripts/apply-migrations-manual.md`](../scripts/apply-migrations-manual.md)
- Tests e2e Playwright : [`e2e/README.md`](../e2e/README.md)
