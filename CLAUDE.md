# CLAUDE.md — FymPOS

> Contrat de travail entre Claude Code et FymPOS. Lire intégralement avant toute action.
> Ne jamais modifier ce fichier sans validation explicite.

---

## 🧭 Projet

**FymPOS** — POS SaaS conforme NF525, multi-tenant (`tenantId` sur toutes les tables), mono-dev.
Stack : Nuxt 4 + TS strict, Drizzle ORM / PostgreSQL, Supabase Auth, Pinia, Vitest.
UI : ShadCN-Nuxt + Reka UI + Tailwind 4. Validation : Zod. Logger : Pino.

---

## 📁 Points non-évidents (le reste est auto-découvrable)

```
composables/useEstablishmentRegister.ts   # SINGLETON module-level (établ./caisse)
middleware/auth.global.ts                  # client (redirect /login)
server/middleware/auth.global.ts           # serveur Nitro (assertAuth)
utils/                                     # racine — cartUtils (centimes+LRM), formatters
stores/shortcutBoard.ts                    # localStorage persisté par establishmentId
plugins/01.api-fetch.client.ts             # override $fetch → injecte Authorization + x-tenant-id
plugins/02.session-restore.client.ts       # pré-monte session avant render
```

---

## ⚠️ Zones critiques

🔴 **Ne toucher qu'avec tests de régression** :
- `server/api/sales/create.post.ts` (587 l.) — création vente, chaîne NF525
- `server/api/sales/close-day.post.ts` — clôture, hash NF525
- `server/utils/nf525.ts` — hash SHA-256, chaînage, numérotation
- `server/database/schema.ts` (1101 l.) — impact N endpoints
- `stores/cart.ts` + `utils/cartUtils.ts` — logique caisse, centimes
- `composables/useEstablishmentRegister.ts` — singleton sélection établ./caisse

🟠 **Complexité élevée** :
- `server/utils/sync.ts` (800 l.) — propagation multi-établissement
- `server/api/sync-groups/[id]/resync.post.ts` (562 l.) — opération destructive

### Risques ouverts
- **Signature NF525 temporaire** (`nf525.ts:157`) : `TEMP_SIGNATURE_*` tant que `INFOCERT_PRIVATE_KEY` absente — bloquant certification
- **Numérotation NF525 basée sur position `isActive`** (`sales/create.post.ts:175`) : désactiver un établ. décale les numéros suivants

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
4. **Tenant** : tous les endpoints appellent `getTenantIdFromEvent` (sauf `PUBLIC_ENDPOINTS`).
5. **SignOut** : `stores/auth.ts:signOut()` reset les singletons (`useSellersStore().clearSeller()` + `useEstablishmentRegister().reset()`). Ajouter un singleton = mettre à jour `signOut`.
6. **Finance** : calculs en centimes entiers. Points d'entrée : `utils/cartUtils.ts` (client), `server/utils/financialValidation.ts` (serveur). Pas de math float ad-hoc.
7. **Hash NF525** : une seule fonction `generateTicketHash` dans `server/utils/nf525.ts`. Toute modification invalide les chaînes existantes = migration data.

---

## 🔐 Convention auth serveur

### `event.context.auth`
```ts
event.context.auth = {
  user: User,          // objet Supabase
  accessToken: string,
  tenantId: string,
}
```

### Lire le tenantId
**Toujours** : `getTenantIdFromEvent(event)` depuis `server/utils/tenant.ts` (lève 401 si absent).
**Jamais** lire `event.context.auth.tenantId` directement.

### Ordre de résolution `getTenantFromUser`
1. Header `x-tenant-id`
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
```

---

## 📊 Pointeurs

- Audits : [docs/audit/](docs/audit/)
- Architecture Supabase vs Drizzle : [docs/architecture/supabase-vs-drizzle.md](docs/architecture/supabase-vs-drizzle.md)
- Journal des sessions : [docs/journal.md](docs/journal.md)
- Checklist pré-déploiement : [docs/pre-deploy-checklist.md](docs/pre-deploy-checklist.md)
- Index structurel : [codebase_index.md](codebase_index.md)

*Dernière mise à jour : 2026-04-22 — version stricte (invariants + zones critiques uniquement)*
