# CLAUDE.md — FymPOS

> Contrat de travail entre Claude Code et FymPOS. Lire intégralement avant toute action.
> Ne jamais modifier ce fichier sans validation explicite.
>
> **Début de session** : lire [docs/etat-projet.md](docs/etat-projet.md) — branche active, bloquants, prochaine action.
> Ce fichier-ci ne contient que ce qui est stable (règles, invariants, conventions) ; l'état courant n'y a pas sa place.

---

## 🧭 Projet

**FymPOS** — POS SaaS conforme NF525, multi-tenant (`tenantId` sur toutes les tables), mono-dev.
Stack : Nuxt 4 + TS strict, Drizzle ORM / PostgreSQL, Supabase Auth, Pinia, Vitest.
UI : ShadCN-Nuxt + Reka UI + Tailwind 4. Validation : Zod. Logger : Pino.

---

## 📁 Points non-évidents (le reste est auto-découvrable)

```
stores/establishmentRegister.ts            # store Pinia (sélection établ./caisse) — wrapper compat : composables/useEstablishmentRegister.ts
middleware/auth.global.ts                  # client (redirect /login)
server/middleware/auth.global.ts           # serveur Nitro (assertAuth)
utils/                                     # racine — cartUtils (centimes+LRM), formatters
stores/shortcutBoard.ts                    # localStorage persisté par establishmentId
plugins/01.api-fetch.client.ts             # override $fetch → injecte Authorization + x-tenant-id
plugins/02.session-restore.client.ts       # pré-monte session avant render
server/database/connection.ts              # type DbExecutor — voir invariant 8 (transactions)
server/utils/apiResponse.ts                # createApiError → erreurs { code, retryable } ; helpers de pagination
server/utils/businessDay.ts                # « jour métier » Europe/Paris — jamais toISOString/setHours pour un jour
```

---

## ⚠️ Zones critiques

🔴 **Ne toucher qu'avec tests de régression** :
- `server/api/sales/create.post.ts` — création vente, chaîne NF525
- `server/api/sales/close-day.post.ts` — clôture, hash NF525
- `server/utils/nf525.ts` — hash SHA-256, chaînage, numérotation
- `server/database/schema.ts` — impact N endpoints
- `stores/cart.ts` + `utils/cartUtils.ts` — logique caisse, centimes
- `stores/establishmentRegister.ts` — store Pinia sélection établ./caisse (persistance localStorage scopée tenant ; `composables/useEstablishmentRegister.ts` n'est qu'un wrapper d'API)

🟠 **Complexité élevée** :
- `server/utils/sync.ts` — propagation multi-établissement
- `server/api/sync-groups/[id]/resync.post.ts` — opération destructive

### Risques ouverts
- 🔴 **Signature NF525 temporaire** (`server/utils/nf525.ts`, chercher `TEMP_SIGNATURE_`) : signature factice tant que `INFOCERT_PRIVATE_KEY` est absente — bloquant ; l'auto-attestation éditeur n'est plus admise (loi de finances 2025), certification organisme accrédité requise (dossier INFOCERT/LNE à mener côté fondateur)
- 🟠 **Colonnes stock deprecated non supprimées** (`server/database/schema.ts`, chercher `@deprecated`) : `products.stock`/`stockByVariation` sont gelées (plus aucune écriture) mais existent encore — migration de suppression à faire dans un 2e temps (P3.5 phase 2 = B7 du plan d'exécution)

**Résolus — ne plus les traiter comme ouverts** : validation du header `x-tenant-id` (P1.1), hash sur une seule `saleDate` (P1.2), survente explicite `oversell` (P1.3), panier persisté (P2.1), avoirs `credit_note` chaînés (P3.2), numérotation immuable `establishmentNumber`/`registerNumber` (migration 0013), chaîne de migrations rejouable de zéro (baseline du 2026-07-06). Détail : [plan post-audit](docs/audit/11-plan-corrections.md) et [journal](docs/journal.md).

**À garder en tête malgré la résolution** :
- Les ventes antérieures au fix P1.2 restent invérifiables en contenu (note dans docs/audit/archive/08-nf525-tests.md).
- Baseline : `pnpm db:migrate` seul amorce une base vierge ; l'ancienne chaîne est archivée dans `server/database/migrations-archive/` ; une base existante se bascule selon le runbook deploy-staging-vercel, section « Bascule baseline ». La bascule *marque* la baseline sans l'exécuter : un schéma en retard n'est pas rattrapé par `db:migrate`.

---

## 🚫 Règles absolues — JAMAIS sans validation explicite

1. Ne jamais modifier les migrations Drizzle existantes — créer une nouvelle migration
2. Ne jamais modifier `server/database/schema.ts` sans inventorier les endpoints impactés
3. Discipline refactor : un module à la fois, tests de caractérisation d'abord, pas de suppression sans grep des usages
4. Ne jamais toucher aux calculs financiers sans tests de régression
5. Ne jamais lancer `resync.post.ts` hors contexte de test isolé
6. Ne jamais modifier `server/utils/supabase.ts` sans repasser `assertAuth` → `event.context.auth` → `getTenantIdFromEvent`
7. Ne jamais désactiver un établissement en production sans audit numérotation NF525
8. Ne jamais ajouter d'entrée dans `PUBLIC_ENDPOINTS` sans audit sécurité
9. Ne jamais pousser du code utilisant `ALLOW_AUTH_BYPASS=true` hors dev local
10. Ne jamais importer `server/utils/supabase.ts` hors de `server/middleware/` (fuite `SUPABASE_SERVICE_ROLE_KEY`)

---

## 🔒 Invariants architecturaux

1. **Auth** : `event.context.auth` posé UNIQUEMENT par `server/middleware/auth.global.ts`. Endpoints lisent via `getTenantIdFromEvent(event)`.
2. **Service role key** : `server/utils/supabase.ts` importé QUE par `server/middleware/auth.global.ts`. Vérif : `grep -r "utils/supabase" . | grep -v server/middleware`.
3. **HTTP client** : tous les `$fetch` passent par `plugins/01.api-fetch.client.ts`. Pas de client alternatif.
4. **Tenant** : tous les endpoints appellent `getTenantIdFromEvent` (sauf `PUBLIC_ENDPOINTS` et `CRON_ENDPOINTS`, voir invariant 9).
5. **SignOut** : `stores/auth.ts:signOut()` reset les stores/singletons (`useSellersStore().clearSeller()` + `useEstablishmentRegisterStore().$reset()`). Ajouter un store/singleton à état persistant = mettre à jour `signOut`.
6. **Finance** : calculs en centimes entiers. Points d'entrée : `utils/cartUtils.ts` (client), `server/utils/financialValidation.ts` (serveur). Pas de math float ad-hoc.
7. **Hash NF525** : une seule fonction `generateTicketHash` dans `server/utils/nf525.ts`. Toute modification invalide les chaînes existantes = migration data.
8. **Transactions** : tout helper qui écrit en base et peut être appelé depuis `db.transaction` accepte un paramètre `DbExecutor` (`server/database/connection.ts`) et reçoit `tx`. Écrire via le `db` global pendant qu'une transaction est ouverte = auto-deadlock en mode pooler (staging/prod, 1 connexion) : c'est la cause des ventes et mouvements figés du 2026-07-03.
9. **Endpoints internes (cron)** : `/api/internal/*` passe par `CRON_ENDPOINTS` dans `server/middleware/auth.global.ts`, liste volontairement distincte de `PUBLIC_ENDPOINTS`. Authentification par `CRON_SECRET` comparé en temps constant, fermé par défaut si le secret est absent. `event.context.auth` n'y est jamais posé (`getTenantIdFromEvent` lèverait 401) : l'endpoint détermine lui-même les tenants traités. Y ajouter une route demande le même audit que la règle absolue n°8.

---

## 🔐 Convention auth serveur

### `event.context.auth`
```ts
event.context.auth = {
  user: User,          // objet Supabase
  accessToken: string,
  tenantId: string,
  role: 'admin' | 'manager' | 'cashier',  // RBAC — posé par le middleware uniquement
}
```

### Lire le tenantId
**Toujours** : `getTenantIdFromEvent(event)` depuis `server/utils/tenant.ts` (lève 401 si absent).
**Jamais** lire `event.context.auth.tenantId` directement.

### Lire le rôle (RBAC)
**Jamais** lire `event.context.auth.role` directement. Helpers dans `server/utils/roles.ts` :
- `assertRole(event, 'admin' | 'manager')` — lève **403** si privilèges insuffisants.
  Hiérarchie : `cashier (0) < manager (1) < admin (2)` ; `assertRole(event, 'manager')` passe
  pour manager **et** admin.
- `getRoleFromEvent(event)` / `resolveRole(user)` — défaut **`admin`** si rôle absent/invalide
  (rétro-compat : les comptes existants sans `app_metadata.role` conservent l'accès complet).
- Le rôle vit dans `user.app_metadata.role` (métadonnée de confiance Supabase) et n'est posé
  dans `event.context.auth` QUE par `server/middleware/auth.global.ts` (via `resolveRole`).
- `roles.ts` ne doit **jamais** importer `server/utils/supabase.ts` (règle 10).
- Côté client : composable `composables/useUserRole.ts` (masquage nav/boutons uniquement ;
  le **403 serveur reste la seule vraie barrière**).

### Ordre de résolution `getTenantFromUser`
1. Header `x-tenant-id` — accepté **uniquement** s'il figure dans les tenants autorisés de l'utilisateur (métadonnées de confiance + son propre `user.id`) ; sinon `null` → 400, sans 403 qui confirmerait l'existence du tenant visé (P1.1)
2. `user.app_metadata.tenant_id` (ou `tenantId`, `user_metadata`)
3. `user.app_metadata.tenants[0]`
4. `user.id` (fallback SaaS self-serve)
5. `null` → `assertAuth` lève 400

### Remplacer Supabase Auth
Exactement 4 fichiers : `server/utils/supabase.ts`, `server/middleware/auth.global.ts`, `stores/auth.ts`, `plugins/00.supabase.ts`. Endpoints inchangés.

---

## 💬 Commandes non-évidentes

```bash
pnpm db:generate          # créer une migration (jamais à la main)
pnpm db:migrate           # appliquer les migrations
pnpm db:seed              # seed — RUN_SEED=1 requis
pnpm env:switch           # bascule d'environnement (dev/staging/prod)
pnpm ci                   # lint + typecheck + audits tenant/migrations + tests — vert avant tout commit
pnpm e2e:local            # smoke Playwright du chemin critique (voir e2e/README.md)
```

⚠️ `db:migrate`, `db:push` et `db:seed` agissent sur la base désignée par `.env`. Après un `pnpm env:switch`, ce n'est plus la base dev : vérifier l'environnement actif avant de les lancer, et revenir sur dev ensuite (`pnpm env:dev`).

### Branches
- `developpement` : travail quotidien, base Supabase dev. Une branche par tâche, mergée dans `developpement`.
- `main` : staging — chaque push déclenche un déploiement Vercel. Ne merger `developpement` → `main` que stable, migrations appliquées sur staging.
- Détail et procédures : [docs/runbooks/deploy-staging-vercel.md](docs/runbooks/deploy-staging-vercel.md).

---

## 📊 Pointeurs

- **État courant** : [docs/etat-projet.md](docs/etat-projet.md)
- Architecture cible, roadmap et décisions actées (§10) : [docs/architecture/2026-07-audit-architecture-cible.md](docs/architecture/2026-07-audit-architecture-cible.md)
- Plan d'exécution et checklist d'avancement : [docs/architecture/2026-07-plan-execution-phases-1-2.md](docs/architecture/2026-07-plan-execution-phases-1-2.md)
- Plan post-audit (terminé) : [docs/audit/11-plan-corrections.md](docs/audit/11-plan-corrections.md)
- Audits archivés : [docs/audit/archive/](docs/audit/archive/)
- Architecture Supabase vs Drizzle : [docs/architecture/supabase-vs-drizzle.md](docs/architecture/supabase-vs-drizzle.md)
- Journal des sessions : [docs/journal.md](docs/journal.md)
- Checklist pré-déploiement : [docs/pre-deploy-checklist.md](docs/pre-deploy-checklist.md)

*Dernière mise à jour : 2026-11-10 — resynchronisation avec le code (tailles de fichiers retirées, résolution `x-tenant-id` corrigée, invariants 8 et 9 ajoutés) et renvoi de l'état courant vers docs/etat-projet.md*
