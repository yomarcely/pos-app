# Architecture : Frontière Supabase / Drizzle

> Date : 2026-03-15
> Auteur : Claude Code (audit session 2)
> Statut : Analyse — lecture seule, aucune modification

---

## Tableau de synthèse

| Couche | Technologie | Fichiers clés | Raison |
|---|---|---|---|
| **Auth login / signup / logout** | Supabase Auth JS client | `stores/auth.ts`, `composables/useSupabaseClient.ts` | Supabase Auth gère les sessions côté navigateur (JWT, refresh token, persisted session) |
| **Init client frontend** | Supabase JS (`createClient`) | `plugins/00.supabase.ts` | Plugin Nuxt qui expose `$supabase` dans toute l'app |
| **Vérification JWT serveur** | Supabase Admin SDK (`supabaseServerClient`) | `server/utils/supabase.ts` | Appel `getUser(token)` pour valider les tokens entrants via l'API Admin Supabase |
| **Extraction du tenant** | Supabase user metadata | `server/utils/supabase.ts` → `getTenantFromUser()` | Le `tenantId` est stocké dans `app_metadata` ou `user_metadata` Supabase |
| **Guard auth global** | Supabase Admin SDK | `server/middleware/auth.global.ts` | Tous les endpoints `/api/` passent par `assertAuth()` qui utilise Supabase Admin |
| **Données clients** | Drizzle ORM | `server/api/clients/`, `server/database/schema.ts` | CRUD dans la table `customers` via Drizzle |
| **Données produits** | Drizzle ORM | `server/api/products/`, `server/database/schema.ts` | CRUD dans les tables `products`, `product_stocks`, `product_establishments` |
| **Données ventes / tickets** | Drizzle ORM | `server/api/sales/`, `server/utils/nf525.ts` | Toute la logique NF525 passe par Drizzle |
| **Clôtures de caisse** | Drizzle ORM | `server/api/closures/`, `server/api/sales/close-day.post.ts` | Conformité fiscale, hash de chaînage — Drizzle uniquement |
| **Mouvements de stock** | Drizzle ORM | `server/api/movements/`, `server/utils/createMovement.ts` | Audit trails, mouvements atomiques |
| **Synchronisation multi-établissements** | Drizzle ORM | `server/utils/sync.ts`, `server/api/sync-groups/` | Tables `sync_groups`, `sync_rules`, `sync_logs` — Drizzle |
| **Audit logs RGPD** | Drizzle ORM | `server/utils/audit.ts` | Table `audit_logs` — Drizzle |
| **Schéma DB** | Drizzle ORM | `server/database/schema.ts` | Source de vérité unique, toutes les tables définies en TypeScript |

---

## Frontière claire : Auth seul passe par Supabase côté serveur

```
CLIENT (navigateur)
  └── Supabase JS client (plugins/00.supabase.ts)
        ├── signIn / signOut / signUp    → Supabase Auth
        ├── onAuthStateChange            → Supabase Auth
        └── getSession / getUser         → Supabase Auth

SERVEUR (Nitro)
  └── server/middleware/auth.global.ts
        └── assertAuth(event)            → Supabase Admin SDK (JWT validation)
              ├── getUser(token)          → Supabase Admin SDK
              └── getTenantFromUser()     → extrait tenantId des métadonnées Supabase

  └── Tous les endpoints /api/
        └── db.*                         → Drizzle ORM (PostgreSQL direct)
```

---

## Vérification des routes clients (BATCH 3)

Les deux routes clients identifiées dans l'audit comme "potentiellement liées à Supabase" :

### `server/api/clients/index.post.ts`
- **Imports** : `db` (Drizzle), `customers`, `customerEstablishments`, `establishments`, `auditLogs` (Drizzle schema), `getTenantIdFromEvent` (lit `event.context.auth.tenantId` posé par le middleware)
- **Supabase** : **AUCUN import direct Supabase**
- **Verdict** : 100% Drizzle. Le `tenantId` vient du contexte auth posé par le middleware `assertAuth()`.

### `server/api/clients/[id].put.ts`
- **Imports** : `db` (Drizzle), `customers` (Drizzle schema), `getTenantIdFromEvent`
- **Supabase** : **AUCUN import direct Supabase**
- **Verdict** : 100% Drizzle.

**Conclusion** : L'audit initial signalait ces routes comme "mentionnant Supabase" — ceci était peut-être vrai dans une version antérieure. Dans l'état actuel du code, ces routes sont purement Drizzle. La frontière est propre.

---

## Risques identifiés

### 1. Couplage fort Auth / Tenant metadata
Le `tenantId` est stocké dans les `user_metadata` Supabase. Si Supabase change son API de métadonnées, `getTenantFromUser()` devrait être mis à jour. Ce couplage est documenté mais non abstrait.

### 2. `supabaseServerClient` peut être `null`
Si `SUPABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY` ne sont pas définis, `supabaseServerClient` est `null`. `assertAuth()` lance alors une erreur 500. Ce cas est géré explicitement.

### 3. Double client Supabase
- `plugins/00.supabase.ts` crée un client avec `anonKey` (frontend, sessions persistées)
- `server/utils/supabase.ts` crée un client avec `serviceRoleKey` (serveur, accès admin)
Ces deux clients sont légitimes et distincts, mais doivent rester clairement séparés.

### 4. `server/utils/supabase.ts` exposé côté serveur uniquement
Ce fichier ne doit **jamais** être importé côté client (le `serviceRoleKey` ne doit pas fuiter dans le bundle). À ce jour, tous ses imports sont dans `server/middleware/` — correct.

**Vérification BATCH 3 (2026-03-15)** — Grep exhaustif sur tous les fichiers `.ts` et `.vue` du projet :
- Résultat : **0 import côté client confirmé**
- Seul import trouvé : `server/middleware/auth.global.ts:1` (légitime, côté serveur Nitro)
- Zones vérifiées : `components/`, `pages/`, `stores/`, `composables/`, `plugins/`, `middleware/` (client-side)
- Statut : ✅ Aucune fuite de `serviceRoleKey` dans le bundle client

---

## Recommandations

| # | Recommandation | Priorité | Statut |
|---|---|---|---|
| 1 | Documenter la convention `event.context.auth` dans CLAUDE.md | Faible | ✅ 2026-03-15 — Section `## 🔐 Convention auth serveur` ajoutée dans CLAUDE.md |
| 2 | Ajouter un test unitaire pour `getTenantFromUser()` couvrant les 4 chemins de fallback | Moyen | ✅ 2026-03-15 — `tests/unit/getTenantFromUser.test.ts` créé (11 cas de test) |
| 3 | Si Supabase Auth est remplacé à terme, seuls `server/utils/supabase.ts` + `middleware/auth.global.ts` + `stores/auth.ts` + `plugins/00.supabase.ts` sont à modifier | Informatif | 📋 Documenté dans CLAUDE.md |

---

*Dernière mise à jour : 2026-03-15 — par Claude Code (audit session 3 : BATCH 1-2-3 exécutés — R1 ✅, R2 ✅, sécurité serviceRoleKey vérifiée)*
