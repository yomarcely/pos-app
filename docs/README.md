# Documentation POS App

## Architecture & Setup

| Document | Description |
|----------|-------------|
| [architecture-backend.md](./architecture-backend.md) | Architecture backend, conformite NF525/RGPD, schema DB |
| [environments.md](./environments.md) | Configuration des 3 environnements (dev/staging/prod) |
| [auth-supabase.md](./auth-supabase.md) | Analyse de l'authentification Supabase (JWT, sessions, RLS) |
| [rls-setup.md](./rls-setup.md) | Row Level Security : configuration et verification |
| [security-headers.md](./security-headers.md) | Headers de securite HTTP (CSP, HSTS, etc.) |
| [migration-guide.md](./migration-guide.md) | Guide de migration base de donnees |

## Conformite

| Document | Description |
|----------|-------------|
| [nf525.md](./nf525.md) | Ameliorations NF525 (hash crypto, signature, archivage) |

## Synchronisation multi-etablissements

| Document | Description |
|----------|-------------|
| [synchronisation.md](./synchronisation.md) | Documentation complete du systeme de sync |
| [interface-sync.md](./interface-sync.md) | Interface de configuration de la synchronisation |
| [recap-synchronisation.md](./recap-synchronisation.md) | Recap des fonctionnalites de sync |

## Suivi du projet

| Document | Description |
|----------|-------------|
| [plan-amelioration.md](./plan-amelioration.md) | Plan d'amelioration en 3 phases (securite, qualite, perf) |
| [progress-tracker.md](./progress-tracker.md) | Suivi de progression et journal de bord |

## Autres

- Logger Pino : voir `server/utils/LOGGER_USAGE.md`
- Troubleshooting Supabase : voir `scripts/apply-migrations-manual.md` et `scripts/fix-supabase-connection.md`
