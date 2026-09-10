# FymPOS — Document d'architecture & roadmap stratégique

> Audit réalisé le 2026-07-06 (branche `developpement`, be05ded) par analyse complète du dépôt.
> ~80 700 lignes TS/Vue, 33 tables, 110 fichiers de tests (~943 tests), 251 commits sur 13 mois.
> Document de référence — les décisions actées sont consignées en fin de fichier (§10).

---

## 1. État des lieux — synthèse

**Ce qu'est FymPOS aujourd'hui** : un monolithe Nuxt 4 (SSR + API Nitro) multi-tenant par colonne `tenantId`, déployé sur Vercel (serverless), base PostgreSQL Supabase (pooler), auth Supabase. Chaîne NF525 fonctionnelle (hash SHA-256 chaîné par caisse, numérotation immuable, avoirs chaînés, archivage R2), fidélité, sync multi-établissement, RBAC 3 rôles, ~943 tests, CI complète (`lint + typecheck + audit tenant + audit migrations + coverage`).

**Verdict global** : projet remarquablement discipliné pour un mono-dev — documentation (CLAUDE.md contractuel, 11 audits, journal, runbooks, index structurel), invariants explicites, couverture de tests. Les fondations métier (centimes entiers, chaînage NF525, idempotence `clientSaleId`, jour métier Europe/Paris) sont saines. Les trois dettes structurelles :

1. **Couplage au runtime serverless** en tension physique avec un POS transactionnel ;
2. **Absence de couche domaine explicite** (logique de vente dans des handlers HTTP de 600–1000 lignes) ;
3. **Absence de mode hors ligne** — la fonctionnalité différenciante n°1 d'un POS professionnel.

---

## 2. Audit détaillé

### 2.1 Architecture générale

**Bien** : monolithe modulaire assumé — le bon choix à ce stade. Frontière client/serveur nette : le client ne calcule que pour l'affichage, le serveur revalide (`recomputeTotalTTC`, tolérance 2¢). Les invariants du CLAUDE.md (auth posée uniquement par le middleware, service-role key confinée à 4 fichiers, `$fetch` unique) sont de vrais garde-fous architecturaux, vérifiés par grep/CI.

**À améliorer** : pas de couche entre HTTP et SQL. `server/api/sales/create.post.ts` fait 999 lignes malgré les extractions (loyalty, idempotence, closureGuard…) : validation, orchestration, règles NF525, stock, fidélité et SQL dans un seul handler. Conséquences : logique de vente non réutilisable (obligatoire pour l'offline), tests d'API qui mockent l'infrastructure au lieu de tester le domaine pur, chaque nouvelle fonctionnalité engraisse le même fichier.

**Risque** : chaque évolution de la vente retraverse la zone critique 🔴 entière. **Bénéfice d'une couche service** : handler ~50 lignes, domaine testable sans HTTP ni DB réelle, offline possible sans dupliquer la logique.

### 2.2 Runtime & infrastructure — point de friction n°1

Les commentaires du code racontent une bataille perdue d'avance : `nuxt.config.ts` monte `maxDuration` à 60s parce que des fonctions Vercel mouraient **en pleine transaction de vente en gardant le `pg_advisory_xact_lock`** (caisse paralysée, staging 2026-07-03) ; `connection.ts` documente l'auto-deadlock du pooler transaction-mode (`max: 1` connexion → helpers `DbExecutor`) ; le rate limiter in-memory est structurellement inopérant en serverless.

Inadéquation de fond : **un POS est une application transactionnelle à écritures sérialisées par caisse (verrous, chaînage de hash, numérotation), avec exigence de latence stable — exactement le profil que le serverless gère le plus mal** (cold starts, connexions éphémères, exécutions tuées, pas d'état partagé). Trois incidents déjà payés pour compenser ce mismatch. Voir §4.1.

### 2.3 Organisation & séparation des responsabilités

**Bien** : découpage par domaine cohérent partout (validators, endpoints, composables, tests). Extractions successives (useCheckout, productOverrides, useProductEditor…) = discipline de refactor incrémental. `utils/cartUtils.ts` et `server/utils/financialValidation.ts` comme seuls points d'entrée financiers = excellent.

**À améliorer** : `server/utils/` est un fourre-tout de 24 fichiers mélangeant infrastructure (logger, rateLimiter, r2Storage), domaine (nf525, loyalty, financialValidation) et orchestration (sync, closureGuard). Duplication types manuels / schémas Zod (interface `CreateSaleRequest` vs `createSaleRequestSchema`) = risque de dérive silencieuse — Zod devrait être l'unique source (`z.infer`).

### 2.4 Qualité, lisibilité, conventions

**Bien** : TS strict, ESLint 9 flat config, Zod partout en entrée, conventions stables, commentaires qui expliquent le *pourquoi* avec dates et incidents (rare et précieux). Français cohérent dans le domaine.

**À améliorer** : fichiers au-delà du seuil de maintenabilité individuelle (create.post.ts 999 l., schema.ts 1439 l., sync.ts 800 l., resync 562 l.). `schema.ts` à éclater par domaine (ré-export index, zéro migration).

### 2.5 Modularité & extensibilité

**Bien** : validators par domaine + endpoints REST → ajout d'un CRUD trivial.

**Risque principal** : les effets de bord transverses sont câblés en dur *dans* les flux. `sync.ts` propage inline pendant la requête ; fidélité et audit appelés inline dans create.post.ts. Chaque fonctionnalité transverse future (webhooks, stats temps réel, e-mail de reçu, marketplace) devra rallonger les handlers ou dupliquer le pattern. **Réponse : bus d'événements de domaine interne** (§5.3) : la vente émet `sale.recorded`, les consommateurs s'y abonnent.

### 2.6 Scalabilité & performances

**Bien** : index `tenantId` systématiques, pagination (B2), centimes entiers, advisory lock sérialisant correctement la numérotation.

**Réalité** : un tenant POS = quelques dizaines de ventes/heure/caisse. **PostgreSQL mono-instance multi-tenant tiendra des milliers de commerces** — le goulot n'est pas la charge, c'est la latence et la disponibilité perçues à la caisse. Limites actuelles : advisory lock par établissement sérialise toutes les caisses d'un établissement (acceptable longtemps), propagation sync synchrone allonge les writes, `max: 1` connexion plafonne le débit par instance. Ces limites disparaissent avec le changement de runtime.

### 2.7 Sécurité

**Bien** : un des points forts. Header `x-tenant-id` validé (P1.1), RBAC serveur (403 = seule barrière réelle), CSP durcie en prod, HSTS, rate limiting sur login, service-role key confinée + vérifiée par grep, audit trail NF525, anonymisation RGPD, `audit:tenant` en CI.

**À améliorer** :
1. **Isolation tenant 100 % applicative.** La connexion Drizzle est un rôle privilégié : le RLS Supabase ne s'applique pas à ces requêtes. Un `WHERE tenantId` oublié dans une jointure complexe = fuite cross-tenant. **Défense en profondeur** : RLS avec policy `tenant_id = current_setting('app.tenant_id')` + `SET LOCAL app.tenant_id` posé par un wrapper de transaction. Coût modéré, une classe entière de bugs devient impossible.
2. Rate limiter in-memory — résolu par le runtime long-lived (correct mono-instance) ou Redis au multi-instance.

### 2.8 Gestion des erreurs

**Bien** : `createError` H3 systématique, `validateBody` → 400, Sentry client+serveur, Pino structuré, `logSystemError` dans l'audit trail, try/finally dans useCheckout.

**À améliorer** : pas de format d'erreur API normalisé (code machine + message humain + retryable). Nécessaire pour l'API publique et pour un client offline qui doit distinguer « rejouable » (réseau, 5xx) de « définitif » (400, 403 clôture). À poser dans `apiResponse.ts`.

### 2.9 Dépendances

**Bien** : stack resserrée et mainstream, pnpm verrouillé.

**Attention** : `@neondatabase/serverless` présent mais la connexion utilise `postgres-js` — à retirer si inutilisé. Couplage Supabase Auth bien contenu (4 fichiers documentés). Sentry + `import-in-the-middle` = deps les plus fragiles aux upgrades Nuxt.

### 2.10 Tests

**Bien** : ~943 tests, pyramide correcte (unit NF525/finance sans mock, handlers API, composants, caractérisation avant refactor), CI qui gate sur coverage.

**Manques** : **aucun test end-to-end réel** (pas de Playwright) — le chemin critique complet (login → caisse → vente → clôture) n'est validé que manuellement. Pour un logiciel certifié, une suite e2e smoke sur staging est le meilleur investissement test restant. Aussi : pas de test de charge/latence sur `sales/create`.

### 2.11 Cohérence globale

Le projet est cohérent avec lui-même à un degré inhabituel : incidents → commentaires datés, audits → plans, plans → PRs cochées. Seule incohérence stratégique : les choix d'infra (Vercel serverless) faits pour un SaaS web classique, pas pour un POS.

---

## 3. Vision produit — ce qu'un POS professionnel exige

1. **La caisse doit encaisser, toujours.** Coupure fibre, 4G saturée, incident Supabase : le commerçant a une file de clients. → **local-first** : données chaudes (catalogue, clients, config) sur le terminal, vente enregistrée localement puis synchronisée. Le réseau est une optimisation, pas une dépendance.
2. **L'intégrité fiscale est non négociable.** NF525 impose inaltérabilité et chaînage — y compris hors ligne. Le design actuel (numéro + hash calculés *par le serveur* à l'insertion, idempotence `clientSaleId`) est **exactement le bon socle** : les ventes offline sont des intentions rejouées, le serveur reste l'unique autorité de numérotation et de chaînage. Ce choix est excellent — le protéger.
3. **Le matériel fait partie du produit.** Imprimante thermique, TPE, douchette, tiroir-caisse. Le navigateur seul ne suffira pas → shell natif léger à terme, sans réécrire l'app.

---

## 4. Comparaisons des solutions — décisions structurantes

### 4.1 Runtime d'hébergement

| Option | Avantages | Inconvénients | Long terme |
|---|---|---|---|
| **A. Vercel serverless** (actuel) | Zéro ops, deploy trivial, scaling auto | Cold starts à la caisse, fonctions tuées mid-transaction (incident vécu), pooler max 1 conn, état impossible, coût croissant | Lutte permanente ; chaque feature stateful devient un contournement |
| **B. Conteneur long-lived** (Fly.io, Railway, Scaleway/OVH pour « données en France ») | Pool DB réel, advisory locks fiables, rate limit in-memory OK, websockets, jobs cron internes, latence stable | Un peu d'ops (health checks), scaling manuel au début | Aligné avec le profil POS ; multi-instance bien plus tard avec Redis |
| **C. VPS géré main** | Coût minimal | Ops à temps plein pour un mono-dev, SPOF | Non raisonnable seul |

**Recommandation : B — la décision infra la plus importante de l'année.** Nitro build en conteneur Node standard (`nitro preset node-server`) : migration essentiellement du déploiement, pas du code. Bénéfices : suppression de la classe d'incidents pooler/zombie-lock, latence de vente stable, déblocage des besoins futurs (jobs d'archivage planifiés, websockets, cache catalogue).

### 4.2 Stratégie offline

| Option | Avantages | Inconvénients | Complexité |
|---|---|---|---|
| **A. Outbox ciblé** : catalogue répliqué en local (lecture), ventes en file locale rejouées (écriture), le reste online-only | S'appuie sur l'idempotence déjà en prod ; périmètre borné ; NF525 préservé (serveur = autorité) ; incrémental | Back-office online-only (acceptable) | Moyenne |
| B. Moteur de sync générique (PowerSync, ElectricSQL, Replicache) | Réplication bidirectionnelle « gratuite » | Dépendance vendor lourde sur le cœur ; modèle de conflits inadapté au chaînage NF525 ; écosystème jeune | Élevée + risque vendor |
| C. CRDT / event sourcing complet | Théoriquement robuste | Sur-ingénierie massive ; incompatible avec la sérialisation NF525 | Très élevée |

**Recommandation : A.** Propriété simplificatrice du domaine POS : *les ventes ne se modifient pas, elles s'ajoutent* (corrections = avoirs chaînés, déjà implémenté). Décomposition : **(1)** réplication descendante catalogue/clients/config avec curseur `updatedAt` ; **(2)** file montante de ventes (`clientSaleId` UUID déjà en place, endpoint déjà idempotent) ; **(3)** ticket provisoire offline, régularisé au rejeu (à valider avec l'organisme certificateur — question de conformité connue du secteur).

### 4.3 Persistance locale (client)

| Option | Verdict |
|---|---|
| **IndexedDB via Dexie** | **Recommandé.** Mature, universel (navigateurs + WebView Tauri), suffisant pour un catalogue de quelques milliers de produits, liveQuery pour la réactivité |
| SQLite WASM / OPFS | Lourd (bundle, verrous OPFS multi-onglets), utile seulement pour requêtes complexes locales — pas le cas |
| PGlite | Séduisant (même dialecte que le serveur) mais jeune ; réévaluer dans 2 ans |

### 4.4 Multi-plateforme

| Option | Verdict |
|---|---|
| **PWA d'abord, puis Tauri v2** | **Recommandé.** PWA couvre desktop + tablette immédiatement avec le code existant. Tauri v2 (desktop **et** mobile) enveloppe la même app Nuxt en SPA quand le matériel l'exige (ESC/POS direct, TPE) : binaire ~10 Mo, Rust côté host pour les drivers, un seul codebase web |
| Electron | Même rôle que Tauri mais 150 Mo + Chromium ; ne se justifie plus en 2026 |
| React Native / Flutter | Réécriture complète de l'UI caisse = exclu |

**Corollaire immédiat** : couche d'abstraction périphériques côté client (`interface ReceiptPrinter { print(doc) }`, idem TPE, douchette, tiroir), l'implémentation actuelle (iframe + `window.print()`) comme premier adaptateur.

### 4.5 Multi-tenant à l'échelle

**Rester en colonne partagée `tenantId`** — bon choix jusqu'à plusieurs milliers de tenants ; schéma/base-par-tenant explose les coûts d'ops pour un mono-dev. Complément nécessaire : RLS défense-en-profondeur (§2.7), pas le cloisonnement physique. L'isolation physique deviendra une offre « dédiée » facturée.

### 4.6 Auth

Supabase Auth : **conserver** (couplage confiné à 4 fichiers, coût de sortie connu). Seul ajout : sessions « vendeur » locales par code PIN (changement d'opérateur sans réauthentification Supabase) — concept applicatif au-dessus de l'auth.

---

## 5. Architecture cible

### 5.1 Vue d'ensemble

```
┌─────────────────────────── TERMINAL (caisse) ────────────────────────────┐
│  App Nuxt (PWA installable ; plus tard : même app dans un shell Tauri)   │
│                                                                          │
│  ┌─ UI caisse ──────────┐   ┌─ Couche locale ──────────────────────────┐ │
│  │ pages/ components/   │   │ store local (Dexie/IndexedDB)            │ │
│  │ stores Pinia         │──▶│  • réplique catalogue/clients/config     │ │
│  └──────────────────────┘   │  • OUTBOX ventes (clientSaleId, statut)  │ │
│  ┌─ Périphériques ──────┐   │ sync worker (service worker + online evt)│ │
│  │ ReceiptPrinter        │  └───────────────┬──────────────────────────┘ │
│  │ PaymentTerminal       │                  │ HTTPS (rejeu idempotent)   │
│  │ BarcodeScanner        │                  │                            │
│  │ (adaptateurs: print   │                  │                            │
│  │  dialog → WebSerial   │                  │                            │
│  │  → Tauri natif)       │                  │                            │
└──┴───────────────────────┴──────────────────┼────────────────────────────┘
                                              ▼
┌────────────────────── SERVEUR (conteneur long-lived) ────────────────────┐
│  Nitro (Nuxt server)                                                     │
│  ┌─ server/api/ ────────── handlers HTTP fins (~50 l.) ────────────────┐ │
│  │   validate (Zod) → appel service → réponse normalisée               │ │
│  └──────────────────────────────┬──────────────────────────────────────┘ │
│  ┌─ server/services/ ─── use-cases transactionnels ────────────────────┐ │
│  │   recordSale, closeBusinessDay, adjustStock, …                      │ │
│  │   (transaction, advisory lock, appels domaine, émission d'events)   │ │
│  └──────────────────────────────┬──────────────────────────────────────┘ │
│  ┌─ server/domain/ ───── logique pure, zéro I/O ───────────────────────┐ │
│  │   nf525 (hash/chaîne/numérotation), finance, loyalty, businessDay   │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│  ┌─ Événements de domaine (table outbox en DB, même transaction) ──────┐ │
│  │   sale.recorded, day.closed, stock.adjusted, customer.updated       │ │
│  │   consommateurs : sync multi-étab, stats, webhooks, e-mail, …       │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│  PostgreSQL (Supabase) — tenantId + RLS défense-en-profondeur           │
│  R2 (archives NF525) · Supabase Auth · Sentry · Pino                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Principes directeurs

1. **Le serveur reste l'unique autorité fiscale** (numéro, hash, chaînage) ; le terminal ne produit que des *intentions de vente* identifiées par `clientSaleId`.
2. **Trois couches serveur, pas plus** : `api` (HTTP), `services` (use-cases + transactions), `domain` (pur). Pas de microservices, pas de broker externe — la table outbox PostgreSQL suffit pour des années.
3. **Tout effet transverse passe par les événements de domaine.** `sync.ts` devient un consommateur ; fidélité, stats, webhooks et extensions tierces se branchent de la même façon.
4. **Le client possède ses données chaudes.** La caisse fonctionne intégralement sur le store local ; le back-office reste online-only (acceptable, borne le chantier).
5. **Contrats d'API générés depuis Zod** (types partagés + OpenAPI plus tard).

### 5.3 Insertion des évolutions futures

- **Nouveaux paiements** : interface `PaymentMethod` côté domaine + adaptateur périphérique (TPE) ; `payments[]` déjà générique.
- **Fidélité/cartes cadeaux** : migrer le déclenchement vers `sale.recorded`.
- **Commandes en ligne / click & collect** : un canal de plus qui appelle la couche service — trivial après extraction.
- **Stats/comptabilité** : consommateurs d'événements alimentant des agrégats (jamais de calcul lourd sur les tables NF525 chaudes) ; FEC déjà présent.
- **API publique/extensions** : façade versionnée + scopes OAuth par-dessus les services, webhooks alimentés par l'outbox.

---

## 6. Refactorings — priorisés et ordonnés

| # | Refactoring | Priorité | Difficulté | Effort | Bénéfices / Risques |
|---|---|---|---|---|---|
| R1 | **Extraire `server/services/sales.ts`** de create.post.ts (caractérisation d'abord — règle n°3) | Critique | Moyenne | 4–6 j | Prérequis offline + click&collect ; risque zone 🔴, mitigé par les ~943 tests |
| R2 | **Réponse d'erreur API normalisée** (code machine + retryable) dans `apiResponse.ts` | Haute | Faible | 1–2 j | Prérequis client offline |
| R3 | **RLS défense-en-profondeur** (`SET LOCAL app.tenant_id` + policies) | Haute | Moyenne | 3–5 j | Élimine la classe « fuite cross-tenant » ; oubli du SET → 0 ligne (échec bruyant = bon signe) |
| R4 | **Baseline squash migrations** (chaîne rejouable de zéro) | Haute | Moyenne | 2–3 j | Débloque environnements jetables + e2e CI |
| R5 | **Événements de domaine (outbox)** + `sync.ts` en consommateur | Haute | Élevée | 5–8 j | Découple sync/loyalty/stats ; réduit la latence de vente |
| R6 | **Types uniques via `z.infer`** | Moyenne | Faible | 1–2 j | Supprime la dérive payload/validation |
| R7 | **Éclater `schema.ts` par domaine** (ré-export index, zéro migration) | Moyenne | Faible | 1 j | Lisibilité ; aucun risque runtime |
| R8 | **Supprimer colonnes stock deprecated** (P3.5 phase 2) | Moyenne | Faible | 1 j | Clôt la dette stock |
| R9 | **Abstraction périphériques client** (ReceiptPrinter et al.) | Moyenne | Faible | 2 j | Prépare ESC/POS/TPE sans toucher la caisse |
| R10 | Retirer `@neondatabase/serverless` si inutilisé ; ranger `server/utils/` en `domain/` vs `infra/` | Faible | Faible | 0,5 j | Hygiène |

**Ordre d'exécution** : R2 → R1 → R6 → R4 → R3 → R5 → R7/R8/R9/R10 au fil de l'eau. R1 avant R5 ; R4 avant R3.

---

## 7. Roadmap

### Phase 0 — Certification & mise en production réelle *(en cours, chemin critique)*
- **Objectifs** : dossier INFOCERT/LNE lancé (côté fondateur — risque produit n°1), staging stable, premier commerce pilote.
- **Livrables** : signature réelle remplaçant `TEMP_SIGNATURE_*` (`nf525.ts:160`) ; drill backup/restore exécuté ; checklist pré-déploiement passée.
- **Dépendances** : organisme certificateur (délais externes).
- **Critères** : attestation obtenue ou dossier en instruction ; un commerce réel encaisse.

### Phase 1 — Consolidation infra & filet de sécurité *(≈ 3–4 semaines)*
- **Objectifs** : sortir du serverless, sécuriser en profondeur, automatiser la validation de bout en bout.
- **Livrables** : migration conteneur long-lived ; suite Playwright smoke (login → vente → clôture → verify-chain) sur staging en CI ; R2/R4/R3 ; alerting Sentry sur invariants.
- **Risques** : migration runtime = re-tester les timeouts DB ; mitigé par la suite e2e livrée *avant* la bascule.
- **Critères** : zéro incident pooler sur 30 jours ; e2e vert en CI ; RLS actif staging puis prod.

### Phase 2 — Couche domaine *(≈ 4–6 semaines, parallélisable avec l'instruction INFOCERT)*
- **Objectifs** : R1 (service ventes), puis clôtures et stock ; R5 (outbox + sync consommateur) ; R6/R7.
- **Critères** : create.post.ts < 100 lignes ; `recordSale` testé sans HTTP ; sync découplée de la latence de vente.

### Phase 3 — Offline / local-first — ❌ ABANDONNÉE le 2026-09-10 (cf. §10)

> **Ne pas exécuter cette phase.** Décision produit du 2026-09-10 : FymPOS reste un **SaaS
> online-only**. Le contenu ci-dessous est conservé à titre d'archive (raisonnement d'origine),
> pas comme plan actif. Ce qui remplace ce filet : le mode « SaaS résilient » déjà en prod
> (panier persisté `utils/cartPersistence.ts`, retry back-off réseau/5xx dans `useCheckout.ts`,
> idempotence `clientSaleId`) — il couvre les micro-coupures, pas les pannes longues, et c'est
> assumé. Conséquence directe : la **disponibilité serveur devient le produit** (voir §10).

- **Objectifs** : la caisse encaisse sans réseau.
- **Livrables** : PWA (service worker, installable) ; réplication catalogue/clients/config vers Dexie (curseur incrémental) ; outbox de ventes avec rejeu automatique + UI d'état ; ticket provisoire offline ; note de conformité offline au dossier INFOCERT ; tests réseau dégradé (Playwright offline-mode).
- **Dépendances** : Phases 1–2.
- **Risques** : le plus gros est *fiscal* — valider le traitement des ventes offline avec le certificateur **pendant** la phase 0.
- **Critères** : démo « câble débranché, 10 ventes, re-branchement, chaîne NF525 intègre » ; clôture bloquée tant que l'outbox n'est pas vide.

### Phase 4 — Matériel & plateformes *(≈ 4–8 semaines, tirée par la demande terrain)*
- **Livrables** : R9 puis adaptateur ESC/POS (Web Serial d'abord) ; shell Tauri v2 quand un périphérique l'exige ; support tablette.
- **Critères** : impression thermique sans dialog navigateur chez le pilote ; même codebase web dans le shell.

### Phase 5 — SaaS à l'échelle *(continu)*
- Onboarding self-serve + billing (Stripe) ; plans/quotas ; back-office admin (suites B/C en réserve) ; agrégats stats ; API publique versionnée + webhooks (sur l'outbox) ; multi-magasin avancé.

---

## 8. Checklist détaillée

### 🔴 Critique
| Tâche | Pourquoi / apport | Estim. | Dépend de |
|---|---|---|---|
| Lancer/suivre le dossier INFOCERT-LNE (fondateur) | Sans certification, produit illégal à la vente en France | continu | — |
| Signature réelle selon specs organisme (remplacer `TEMP_SIGNATURE_*`) | Conformité ; note de migration pour les tickets déjà signés en TEMP | 3–5 j | specs INFOCERT |
| Migration runtime → conteneur long-lived | Élimine la classe d'incidents pooler/zombie-lock ; latence caisse stable | 3–5 j | suite e2e d'abord |
| Suite e2e Playwright smoke en CI sur staging | Seule validation automatique du chemin critique complet | 4–6 j | R4 souhaitable |
| Drill backup-restore exécuté et chronométré | Un runbook non testé n'est pas un backup | 1 j | — |

### 🟠 Haute
| Tâche | Pourquoi / apport | Estim. | Dépend de |
|---|---|---|---|
| R2 — erreurs API normalisées | Prérequis offline ; améliore le support | 1–2 j | — |
| R1 — extraction `services/sales.ts` | Débloque offline, click&collect, tests domaine | 4–6 j | R2 |
| R4 — baseline migrations rejouable | Environnements jetables, e2e CI | 2–3 j | validation règle n°1 |
| R3 — RLS défense-en-profondeur | Supprime le risque de fuite cross-tenant | 3–5 j | R4 |
| R5 — outbox événements + sync consommateur | Découplage transverse ; base webhooks/stats | 5–8 j | R1 |
| Valider le traitement fiscal des ventes offline avec le certificateur | Évite de construire Phase 3 sur une hypothèse invalide | 0,5 j + délais | dossier ouvert |
| Alerting Sentry sur invariants (chaîne brisée, échec clôture, oversell en rafale) | Détection proactive | 1–2 j | — |

### 🟡 Moyenne
| Tâche | Pourquoi / apport | Estim. | Dépend de |
|---|---|---|---|
| PWA : service worker + manifest | Première brique offline, gain UX immédiat | 2–3 j | — |
| Réplication catalogue → Dexie (curseur `updatedAt`) | Cœur du local-first lecture | 5–8 j | PWA, R1 |
| Outbox client de ventes + UI d'état de sync | Cœur du local-first écriture | 8–12 j | réplication, R2 |
| R9 — abstraction périphériques + adaptateur actuel | Prépare ESC/POS/TPE | 2 j | — |
| Adaptateur ESC/POS Web Serial | Impression pro sans dialog | 3–5 j | R9 |
| R6 — types uniques `z.infer` | Supprime la dérive payload/validation | 1–2 j | R1 |
| R7 — éclater schema.ts par domaine | Lisibilité | 1 j | — |
| R8 — suppression colonnes stock deprecated | Clôt P3.5 | 1 j | audit usages |
| Test de charge `sales/create` (k6) | Objectiver latence + coût advisory lock | 1–2 j | runtime migré |
| Sessions vendeur par PIN (verrouillage caisse) | Réalité terrain multi-vendeurs | 3–5 j | — |

### 🟢 Faible
| Tâche | Pourquoi | Estim. |
|---|---|---|
| R10 — hygiène deps + rangement `server/utils/` | Clarté | 0,5 j |
| OpenAPI générée depuis Zod | Prépare l'API publique | 2–3 j |
| Shell Tauri v2 (quand un périphérique l'exige) | Distribution desktop + drivers natifs | 5–8 j |
| Rate limiter Redis (Upstash) | Seulement au multi-instance | 1 j |
| Mise à jour CLAUDE.md/index | Garder le contrat exact | 0,5 j |

---

## 9. Conclusion — avis global

**Points forts** : discipline d'ingénierie exceptionnelle pour un mono-dev ; fondations métier justes (centimes, chaînage NF525 serveur-autoritaire, idempotence `clientSaleId`, avoirs chaînés, jour métier) ; sécurité au-dessus de la moyenne ; couplages vendor contenus et documentés. L'idempotence des ventes est à elle seule la moitié du problème offline — déjà en prod.

**Faiblesses** : logique de vente enfermée dans des handlers HTTP massifs ; infra serverless en conflit structurel avec le domaine (trois incidents documentés) ; aucun offline ; isolation tenant purement applicative ; pas de e2e ; effets transverses câblés inline.

**Risques à anticiper** : ① délai INFOCERT — externe, incompressible, existentiel ; ② construire l'offline sans validation fiscale préalable ; ③ usure mono-dev sur les fichiers de 1000 lignes.

**Décisions à prendre rapidement** : **1)** engager le dossier de certification et y inclure la question offline ; **2)** acter la sortie du serverless ; **3)** valider le dogme « serveur = autorité fiscale, terminal = intentions rejouées » ; **4)** valider l'extraction de la couche service.

**Les choix qui détermineront la réussite** : la certification (sine qua non commercial), la fiabilité perçue à la caisse (runtime + offline), et la couche service + événements (c'est elle qui décidera si click & collect, API publique et extensions s'ajoutent en semaines ou en trimestres). Rien dans l'existant n'exige de réécriture — l'architecture cible est une *extension* du projet actuel.

---

## 10. Décisions actées

> À compléter au fil des réunions d'architecture.

| Date | Décision | Choix | Notes |
|---|---|---|---|
| 2026-07-06 | Audit livré | — | Document initial |
| 2026-07-06 | Hébergement | **Rester sur Vercel pour l'instant** | Migration conteneur long-lived reportée (probablement après certification). Conséquences : les contournements serverless (maxDuration 60s, `DbExecutor`, timeouts pooler) restent vitaux ; consommation outbox via Vercel Cron + `waitUntil` ; RLS via wrapper transactionnel `withTenantTx`. Décision réversible — le plan garde la migration comme option ouverte. |
| 2026-07-06 | Portée du plan d'exécution | **Phases 1+2 complètes** | Prompts : e2e → R2 erreurs → R4 baseline → R3 RLS → alerting → R1 extraction service → R6 types → R5 outbox → R7/R8. L'offline (Phase 3) sera planifié dans un 2e document. Voir [2026-07-plan-execution-phases-1-2.md](2026-07-plan-execution-phases-1-2.md) |
| 2026-07-06 | Règle n°1 CLAUDE.md | **Baseline squash migrations VALIDÉE + RLS VALIDÉ** | Ordre R4 → R3. Les anciennes migrations sont archivées, jamais modifiées. |
| 2026-07-06 | Périmètre offline (Phase 3) | **Caisse seule** | Catalogue/clients répliqués en local, ventes en file rejouée. Back-office online-only. |
| 2026-09-10 | **Offline / local-first** | **ABANDONNÉ — FymPOS reste un SaaS online-only** | Annule et remplace la décision du 2026-07-06 ci-dessus. Phase 3 supprimée de la roadmap (≈ 8–12 semaines économisées), ainsi que PWA local-first, réplication Dexie et outbox client. **Bénéfice collatéral majeur** : la question du « ticket provisoire hors ligne » sort du dossier de certification — c'était la zone grise NF525 la plus risquée (validation certificateur requise avant de construire). Le filet réseau retenu est le mode « SaaS résilient » déjà en production : panier persisté, retry back-off sur réseau/5xx, idempotence `clientSaleId`. Il absorbe les micro-coupures ; une panne longue = caisse à l'arrêt, et c'est assumé. |
| 2026-09-10 | Conséquence — **hébergement** | **Décision du 2026-07-06 rouverte** | Sans filet offline, le serveur *est* la caisse : indisponibilité ou latence = commerçant qui ne vend pas. Les 5 incidents serverless vécus (cold starts, sockets morts, transactions zombies, deadlocks pooler) n'ont plus rien qui les absorbe. La migration vers un conteneur long-lived (§4.1) remonte en priorité et doit être **tranchée avant le premier commerce pilote**, pas après. |
| 2026-09-10 | Conséquence — **priorités R1/R5** | **B2 (services/sales.ts) et B4/B5 (outbox) rétrogradés** | Leur justification n°1 était « prérequis offline ». Il reste la lisibilité (`create.post.ts` à 944 lignes), le click & collect et les tests domaine — réels mais non urgents. Ce qui monte à leur place : fiabilité serveur (e2e A3, alerting A5, hébergement) et matériel (imprimante thermique, TPE). |
| 2026-09-10 | Conséquence — **Tauri / périphériques** | **R9 conservé, Tauri déclenché par le matériel seul** | Tauri n'était pas motivé par l'offline mais par l'accès natif aux périphériques. Il ne revient que si un besoin terrain l'exige (ESC/POS direct, TPE), pas avant. |
