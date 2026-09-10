# Plan d'exécution — Phases 1+2 (2026-07-06)

> Plan de prompts issu de l'audit d'architecture ([2026-07-audit-architecture-cible.md](2026-07-audit-architecture-cible.md)).
> **1 prompt = 1 session Claude Code.** Ne pas enchaîner deux prompts dans la même session.
> Chaque prompt est autonome et copiable tel quel, idéalement en plan mode.
>
> **Décisions actées** (§10 du doc d'audit) : baseline migrations et RLS validés (règle n°1).
> **Mise à jour du 2026-09-10 : l'offline (Phase 3) est ABANDONNÉ — FymPOS reste un SaaS
> online-only.** Conséquence : la décision « rester sur Vercel » est rouverte (sans filet
> offline, la disponibilité serveur devient le produit) et les prompts B2/B4/B5 perdent leur
> justification principale — voir la section « Suite du plan » en fin de fichier.

## Comment utiliser ce plan

1. Nouvelle session Claude Code, coller le prompt, valider l'approche en plan mode.
2. Avant de committer : `pnpm ci` vert.
3. Une branche par prompt (`feat/a1-api-errors`, etc.), merger avant le prompt suivant.
4. Cocher la checklist en fin de fichier après chaque merge.
5. **L'ordre est important** : A2 (baseline) avant A3 (e2e CI) avant A4 (RLS) ; B1 avant B2 ; B2 avant B4.

**Règle d'or** : si Claude propose de toucher un fichier hors périmètre, refuser et noter pour plus tard.

---

## PHASE A — Filet de sécurité & infra (sur Vercel)

### A1 — Erreurs API normalisées (code machine + retryable)

```text
Objectif : normaliser le format d'erreur de l'API pour préparer le client offline (qui devra
distinguer les erreurs rejouables des erreurs définitives) et améliorer le support.

Contexte : les endpoints utilisent createError() de H3 avec message seul. Il existe déjà
server/utils/apiResponse.ts — pars de ce qui s'y trouve, ne crée pas un module concurrent.

Implémente :
1. Dans server/utils/apiResponse.ts : un helper createApiError(statusCode, code, message, opts?)
   qui produit un createError H3 dont data contient { code: string, retryable: boolean }.
   - code : slug machine stable en SCREAMING_SNAKE_CASE (ex: CART_EMPTY, DAY_ALREADY_CLOSED,
     REGISTER_INACTIVE, TENANT_FORBIDDEN, RATE_LIMITED, INTERNAL).
   - retryable : défaut false pour 4xx, true pour 5xx et 429 ; surchargeable.
2. Adopte createApiError UNIQUEMENT dans : server/api/sales/create.post.ts,
   server/api/sales/close-day.post.ts, server/api/movements/create.post.ts et
   server/utils/validation.ts (les erreurs Zod 400 → code VALIDATION_ERROR + détails).
   Ne touche PAS aux autres endpoints (adoption progressive, ce prompt pose le standard).
   Zone critique 🔴 (create.post.ts, close-day.post.ts) : changement de la forme des erreurs
   UNIQUEMENT, zéro changement de logique, zéro changement des status codes existants.
3. Côté client : composables/useFetchError.ts — extractFetchError expose aussi code et
   retryable s'ils sont présents (rétro-compatible si absents).
4. Documente la convention (liste des codes existants + règle retryable) dans un bloc de
   commentaire en tête de apiResponse.ts.
5. Tests : unitaires sur createApiError (mapping retryable par défaut, surcharge), et mise à
   jour des tests API existants qui assertent sur les erreurs de ces 3 endpoints (les messages
   ne changent pas, seul data s'enrichit — les tests existants ne devraient quasiment pas bouger ;
   si un test casse sur autre chose que data, c'est une régression, corrige le code pas le test).

Termine par pnpm ci.
```

### A2 — Baseline squash des migrations (VALIDÉ règle n°1 le 2026-07-06)

```text
Objectif : rendre la chaîne de migrations rejouable de zéro. Aujourd'hui 22 tables sur 33 n'ont
pas de CREATE TABLE dans les migrations (schéma initial créé via db:push) — impossible d'amorcer
une base vierge par pnpm db:migrate seul, ce qui bloque les environnements jetables et le e2e CI.

VALIDATION EXPLICITE : la règle absolue n°1 du CLAUDE.md (ne jamais modifier les migrations
existantes) a été levée pour CE chantier précis le 2026-07-06 (cf. docs/architecture/
2026-07-audit-architecture-cible.md §10). Les anciennes migrations sont ARCHIVÉES, jamais éditées.

Procédure :
1. Archive l'existant : déplace server/database/migrations/*.sql et le journal meta vers
   server/database/migrations-archive/ (avec un README expliquant pourquoi et datant l'opération).
2. Regénère une baseline : avec un dossier migrations vide, pnpm db:generate doit produire une
   unique migration 0000_baseline contenant TOUT le schéma actuel (33 tables, index, FK, enums).
   Vérifie qu'elle est bien générée depuis server/database/schema.ts sans modification manuelle.
3. Preuve de rejouabilité : sur une base PostgreSQL vierge locale (docker run postgres:17 ou
   base locale jetable), enchaîne db:migrate → db:seed → pnpm test. Documente la commande exacte
   dans le README de migrations-archive.
4. Bases existantes (dev/staging/prod) : elles ont déjà le schéma. Adapte
   scripts/mark-migrations-applied.ts pour marquer la baseline comme appliquée sans l'exécuter,
   et documente la procédure de bascule par environnement dans
   docs/runbooks/deploy-staging-vercel.md (section nouvelle, datée).
5. Adapte scripts/audit-migrations.ts (utilisé par pnpm ci) à la nouvelle structure.
6. Mets à jour CLAUDE.md : le risque ouvert « chaîne de migrations non rejouable » passe en ✅
   avec renvoi vers ce plan.

Interdits : ne modifie AUCUN fichier de l'archive après déplacement ; ne touche pas au schéma
lui-même (aucune colonne ajoutée/supprimée) ; la baseline doit produire un schéma STRICTEMENT
identique à celui des bases existantes (compare via pg_dump --schema-only ou
scripts/generate-full-schema.ts avant/après et colle le diff — vide — dans la PR).

Termine par pnpm ci + la preuve de rejouabilité (étape 3) dans le message de PR.
```

### A3 — Suite e2e Playwright smoke en CI

```text
Objectif : première validation automatique de bout en bout du chemin critique complet
(login → sélection établissement/caisse → vente → clôture → vérification de chaîne NF525).
Aujourd'hui ce chemin n'est validé que manuellement (docs/tests-manuels.md).

Prérequis : baseline migrations mergée (A2) — la CI peut amorcer une base vierge.

Implémente :
1. Ajoute @playwright/test en devDependency, config playwright.config.ts séparée de Vitest
   (dossier e2e/ à la racine, ne PAS mélanger avec tests/).
2. Environnement e2e local/CI :
   - PostgreSQL jetable (service docker en CI GitHub Actions, container local en dev),
     amorcé par db:migrate + db:seed.
   - Auth : utilise un projet Supabase dédié aux tests (variables SUPABASE_URL/ANON_KEY de test
     via secrets GitHub) avec un utilisateur seedé. INTERDIT d'utiliser ALLOW_AUTH_BYPASS
     (règle absolue n°9) : le e2e doit traverser le vrai login.
   - Serveur : nuxt build + node .output/server/index.mjs (pas nuxt dev) pour tester le build prod.
3. Scénario smoke unique (un seul fichier, e2e/smoke.spec.ts) :
   a. Login avec l'utilisateur de test → redirection dashboard.
   b. Sélection établissement + caisse.
   c. Caisse : ajout d'un produit seedé au panier, sélection vendeur, paiement espèces,
      validation → assert ticketNumber au format YYYYMMDD-Exx-Ryy-NNNNNN dans la réponse/UI.
   d. Deuxième vente → assert que le séquentiel s'incrémente.
   e. Clôture de journée → assert succès.
   f. Appel GET /api/sales/verify-chain (via request context authentifié) → assert isValid=true.
4. CI : nouveau job e2e dans .github/workflows/ci.yml, APRÈS le job actuel, non-bloquant au
   début (continue-on-error: true + issue de suivi pour le rendre bloquant après 2 semaines
   de stabilité).
5. Documente le lancement local dans e2e/README.md (une commande).

Ne modifie aucun code applicatif dans ce prompt — si le e2e révèle un bug, note-le dans la PR
et ouvre un prompt de correction séparé. Termine par pnpm ci + le run Playwright vert en local.
```

### A4a — RLS défense-en-profondeur : socle + domaine pilote (VALIDÉ le 2026-07-06)

```text
Objectif : ajouter une barrière PostgreSQL (Row Level Security) sous la discipline applicative
tenantId. Aujourd'hui un WHERE tenantId oublié dans une jointure = fuite cross-tenant ; avec
RLS, la même erreur retourne 0 ligne (échec bruyant et sûr). Validé règle n°1 le 2026-07-06.

Contexte technique IMPORTANT :
- La connexion Drizzle (server/database/connection.ts) utilise un rôle propriétaire des tables :
  il faut ENABLE + FORCE ROW LEVEL SECURITY pour que les policies s'appliquent aussi au owner.
- SET LOCAL ne vit que dans une transaction (pooler Supabase transaction-mode, max 1 connexion —
  cf. commentaires DbExecutor dans connection.ts). Le mécanisme est donc un wrapper transactionnel.

Implémente :
1. server/database/tenantTx.ts : export withTenantTx<T>(tenantId: string,
   fn: (tx: DbExecutor) => Promise<T>) qui ouvre db.transaction, exécute
   SET LOCAL app.tenant_id = <tenantId> (via sql paramétrée, jamais d'interpolation), puis fn(tx).
   Variante withTenantTxFromEvent(event, fn) qui appelle getTenantIdFromEvent.
2. Nouvelle migration (pnpm db:generate ou migration SQL custom drizzle si le DDL policy n'est
   pas généré par drizzle-kit — dans ce cas via drizzle-kit generate --custom, JAMAIS un fichier
   SQL nu hors journal) pour le DOMAINE PILOTE UNIQUEMENT : tables suppliers et brands
   (périmètre volontairement petit et à faible risque) :
   - ALTER TABLE ... ENABLE ROW LEVEL SECURITY; ALTER TABLE ... FORCE ROW LEVEL SECURITY;
   - CREATE POLICY tenant_isolation ... USING (tenant_id = current_setting('app.tenant_id', true))
     WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
3. Migre les endpoints suppliers/* et brands/* pour exécuter leurs requêtes via withTenantTx.
4. Seed et scripts : server/database/seed.ts doit continuer de fonctionner (il écrit plusieurs
   tenants) — pose SET app.tenant_id par bloc tenant, ou exécute les inserts de ces 2 tables
   dans des withTenantTx.
5. Tests :
   - Unitaires sur withTenantTx (SET LOCAL posé, tenantId paramétré).
   - Test d'intégration NÉGATIF (le plus important) : une requête sur suppliers SANS withTenantTx
     retourne 0 ligne alors que la table contient des données ; une requête via withTenantTx avec
     le mauvais tenantId retourne 0 ligne ; avec le bon tenantId retourne les données.
   - Un INSERT avec tenant_id différent du SET LOCAL doit être rejeté (WITH CHECK).
6. Documente le pattern (quand utiliser withTenantTx, comment étendre à une nouvelle table)
   en tête de tenantTx.ts.

Déploiement : staging d'abord, prod après 1 semaine sans anomalie. Ne touche à AUCUNE autre
table que suppliers/brands dans ce prompt. Termine par pnpm ci.
```

### A4b — RLS : généralisation à toutes les tables tenant

```text
Objectif : étendre le RLS posé en A4a (suppliers/brands) à toutes les tables portant tenantId.

Prérequis : A4a mergé et stable sur staging depuis au moins 1 semaine.

Implémente :
1. Inventaire : liste les 33 tables de server/database/schema.ts, identifie celles portant
   tenantId (toutes normalement — vérifie), et pour chacune TOUS les endpoints/helpers qui y
   accèdent (grep). Colle l'inventaire dans la PR.
2. Ordre de migration par vagues de risque croissant, UNE vague = un commit :
   - Vague 1 : référentiels (categories, taxRates, variationGroups, variations).
   - Vague 2 : personnes (customers, customerEstablishments, sellers, sellerEstablishments).
   - Vague 3 : catalogue/stock (products, productStocks, productEstablishments, movements,
     stockMovements) — attention aux helpers createMovement/createInventoryPreparation qui
     acceptent DbExecutor : ils doivent recevoir le tx de withTenantTx, pas db.
   - Vague 4 : sync (syncGroups, syncGroupEstablishments, syncRules, syncLogs) — sync.ts
     propage cross-établissement mais TOUJOURS même tenant : vérifie et documente.
   - Vague 5 : zone critique 🔴 (sales, saleItems, closures, archives, auditLogs,
     establishments, registers, loyaltyVouchers). Pour sales/create.post.ts et
     close-day.post.ts : la transaction existante devient le withTenantTx (SET LOCAL en
     première instruction, avant le pg_advisory_xact_lock). Tests de régression NF525
     complets avant/après (les ~42 tests nf525 + tests API sales + e2e A3).
3. Chaque vague : migration policies + adaptation endpoints + tests négatifs (pattern A4a).
4. Fin de chantier : scripts/audit-tenant-isolation.ts évolue pour vérifier EN PLUS que toute
   table tenantId a sa policy RLS (requête pg_policies) — le filet applicatif reste en place.
5. Mets à jour CLAUDE.md : nouvel invariant architectural « toute requête tenant passe par
   withTenantTx ; RLS FORCE sur toutes les tables tenant » + retire le risque correspondant.

Rollback : chaque vague est réversible par migration inverse (DISABLE RLS). Ne jamais
désactiver RLS en prod sans post-mortem écrit. Termine par pnpm ci + e2e vert.
```

### A5 — Alerting proactif sur les invariants NF525

```text
Objectif : détecter une chaîne NF525 brisée ou une anomalie de caisse AVANT le commerçant ou
le contrôle fiscal, via Sentry (déjà branché client+serveur) et un contrôle périodique.

Implémente :
1. Sentry sur les invariants, aux points où l'audit trail les détecte déjà
   (server/utils/audit.ts) — ajoute un Sentry.captureMessage(level: 'error' | 'warning') dans :
   - logChainVerification quand isValid=false (error, avec ticketNumbers cassés en extra).
   - logClosureAttemptFailed (warning).
   - logSystemError (error — vérifie qu'il n'y a pas déjà double-capture via l'intégration
     Sentry Nuxt ; si l'exception est déjà capturée par le handler global, ne capture pas deux fois).
   - Survente : dans le flux de vente, si plus de 5 mouvements oversell=true sur 10 minutes
     pour un même établissement (compteur in-memory simple, même pattern que
     server/utils/rateLimiter.ts), émets un warning « survente en rafale » (signal de stock
     système décorrélé du réel).
2. Vérification de chaîne planifiée : Vercel Cron (vercel.json, crons) appelant un nouvel
   endpoint interne GET /api/internal/verify-chains.get.ts qui :
   - est protégé par un secret d'en-tête (CRON_SECRET en env — PAS ajouté à PUBLIC_ENDPOINTS,
     règle n°8 : ajoute-le à la liste des chemins skippés par le middleware auth avec
     vérification du secret AVANT tout traitement, et documente pourquoi dans le code).
   - itère les tenants actifs, exécute la vérification de chaîne du jour métier précédent
     (réutilise la logique de server/api/sales/verify-chain.get.ts — extrais-la en helper
     partagé si nécessaire, sans changer son comportement).
   - capture Sentry par tenant en échec, log Pino un résumé.
   - Fréquence : 1x/jour à 06:00 Europe/Paris (après la nuit, avant l'ouverture).
3. Tests : unitaires sur le compteur de survente en rafale ; test API sur verify-chains
   (secret absent → 401, secret présent → parcours ; mock des tenants).

Termine par pnpm ci.
```

---

## PHASE B — Couche domaine

### B1 — Caractérisation exhaustive de la création de vente

```text
Objectif : filet de tests AVANT l'extraction de la couche service (B2), conformément à la
règle absolue n°3 (tests de caractérisation d'abord). Aucun code de production modifié.

Contexte : server/api/sales/create.post.ts (999 lignes) va être découpé en B2. Les tests
existants (tests/api/sales.test.ts + tests unitaires nf525/financialValidation) couvrent
beaucoup, mais il faut une caractérisation du COMPORTEMENT COMPLET du handler comme boîte noire.

Implémente (tests/api/sales-create.charact.test.ts, style des *.charact.test.ts existants) :
1. Inventorie d'abord TOUS les chemins du handler en le lisant intégralement : idempotence
   clientSaleId, validations (panier vide, vendeur, paiements, échange total=0, register
   inactif/mauvais établissement), garde de clôture (findLastUnclosedBusinessDay), validation
   financière (tolérance 2¢), transaction (advisory lock, previousHash, sequenceNumber, hash,
   signature, insert sale/items, stock avec oversell, snapshot prix d'achat, fidélité points/
   vouchers, avoir credit_note), audit, forme de la réponse (success, sale, stockWarnings,
   duplicate). Colle l'inventaire en commentaire de tête du fichier de test.
2. Un test par chemin, qui fixe le comportement ACTUEL (même s'il te semble discutable —
   caractérisation, pas amélioration ; note les surprises en commentaire // SURPRENANT:).
3. Objectif de couverture : les lignes de create.post.ts non couvertes après ce prompt doivent
   être énumérées dans la PR avec justification (ex: branche défensive inatteignable).
4. Ne modifie AUCUN fichier de production. Si tu découvres un bug réel, ne le corrige pas :
   documente-le dans la PR pour un prompt de correction dédié.

Termine par pnpm ci + le rapport de couverture du fichier dans la PR.
```

### B2 — Extraction de `server/services/sales.ts` (recordSale)

```text
Objectif : extraire la logique de création de vente du handler HTTP vers une couche service
réutilisable. Justification depuis l'abandon de l'offline (2026-09-10) : lisibilité d'un handler
de 944 lignes, click & collect (autre canal d'entrée) et tests domaine sans HTTP. Ce n'est plus
un prérequis bloquant — prompt à jouer quand le fichier gêne, pas avant. Prérequis : B1 mergé.

Architecture cible (cf. docs/architecture/2026-07-audit-architecture-cible.md §5) :
- server/api/sales/create.post.ts → ~50-80 lignes : validateBody → getTenantIdFromEvent →
  appel service → mise en forme réponse/erreurs (createApiError de A1).
- server/services/sales.ts → recordSale(input: RecordSaleInput): Promise<RecordSaleResult> :
  idempotence, validations métier, garde de clôture, transaction complète (advisory lock,
  chaînage NF525, stock, fidélité, audit). Le service reçoit tenantId en paramètre explicite,
  ne touche JAMAIS à event/H3 (aucun import h3 dans server/services/).
- Les erreurs du service : classe SaleError { code, statusCode, retryable } (ou équivalent)
  que le handler traduit en createApiError — le service ne fait pas de createError H3.

Contraintes strictes :
1. Zone critique 🔴 : ZÉRO changement de comportement. Les tests B1 + tests existants passent
   SANS modification (si un test de caractérisation doit changer, c'est une régression).
2. Découpage mécanique d'abord (déplacer, pas réécrire) : pas d'« amélioration » opportuniste,
   pas de renommage de champs, pas de refonte des requêtes SQL. Les améliorations viendront
   dans des prompts ultérieurs sur une base testable.
3. Le hash NF525, la numérotation et l'advisory lock restent STRICTEMENT identiques
   (server/utils/nf525.ts non touché).
4. Respecte le pattern DbExecutor existant (helpers appelés dans la transaction).
5. Types : RecordSaleInput dérive du schéma Zod existant (z.infer<typeof createSaleRequestSchema>)
   + tenantId — supprime l'interface manuelle CreateSaleRequest dupliquée dans create.post.ts
   (lignes ~41-85) qui dérive déjà silencieusement du schéma.
6. Nouveaux tests : tests/services/sales.test.ts qui appelle recordSale SANS passer par le
   handler HTTP (c'est la preuve que l'extraction a réussi) — au minimum : vente nominale,
   idempotence, jour non clôturé → erreur, survente → flag.

Après merge : create.post.ts sort de la zone 🔴 « 999 lignes » du CLAUDE.md — mets à jour la
section Zones critiques (le service devient la zone critique à la place du handler).
Termine par pnpm ci.
```

### B3 — Types uniques via z.infer (généralisation)

```text
Objectif : supprimer la duplication types manuels / schémas Zod dans tout le projet — une seule
source de vérité (z.infer), fin des dérives silencieuses payload/validation.

(B2 a déjà traité le cas de CreateSaleRequest.)

Implémente :
1. Inventaire : pour chacun des 12+ schémas de server/validators/*.schema.ts, cherche les
   interfaces/types TS manuels décrivant la même forme (dans les endpoints, types/*.ts, stores,
   composables). Colle l'inventaire (schéma → doublons trouvés → décision) dans la PR.
2. Pour chaque doublon côté SERVEUR : remplace par z.infer<typeof schema> exporté depuis le
   fichier validator. Les endpoints importent le type depuis le validator.
3. Pour les types PARTAGÉS client/serveur (ex: types/pos.ts SalePayload vs sale.schema.ts) :
   le type client devient un import du z.infer serveur SI cela ne fait pas fuiter de code
   serveur dans le bundle client (import type uniquement — vérifie avec nuxt build que le
   bundle client ne grossit pas). Si un type client diverge volontairement du payload serveur,
   documente la divergence en commentaire au lieu d'unifier.
4. Interdit : modifier la FORME d'un schéma Zod pour « faire coller » un type — ce prompt ne
   change aucune validation, aucun comportement runtime. Uniquement des types.
5. pnpm typecheck est le juge : toute erreur révélée par l'unification est soit une vraie
   dérive (corrige le TYPE, pas le schéma), soit à documenter dans la PR.

Termine par pnpm ci.
```

### B4 — Événements de domaine : table outbox + émission

```text
Objectif : poser l'infrastructure d'événements de domaine (pattern transactional outbox) pour
découpler les effets transverses (sync, fidélité, futurs webhooks/stats) des flux d'écriture.
Cf. docs/architecture/2026-07-audit-architecture-cible.md §5.3. Prérequis : B2 mergé.

Contrainte Vercel (décision 2026-07-06 : on reste en serverless) : pas de worker résident.
Consommation = Vercel Cron (toutes les minutes) + déclenchement opportuniste post-réponse.

Implémente :
1. Migration : table domain_events — id bigserial, tenant_id varchar(64) not null (+ policy RLS
   si A4b est passé sur cette vague), event_type varchar(64), payload jsonb, created_at,
   processed_at nullable, attempts int default 0, last_error text nullable.
   Index (processed_at, created_at) pour le polling, index tenant_id.
2. server/services/events.ts :
   - emitDomainEvent(tx: DbExecutor, event: { tenantId, type, payload }) — INSERT dans la MÊME
     transaction que l'écriture métier (c'est tout l'intérêt du pattern : événement et donnée
     commitent ou échouent ensemble).
   - processPendingEvents({ limit }) — SELECT ... WHERE processed_at IS NULL ORDER BY id
     FOR UPDATE SKIP LOCKED, dispatch vers les consommateurs enregistrés, marque processed_at
     ou incrémente attempts + last_error (abandon après 10 tentatives, Sentry).
   - Registre de consommateurs : registerConsumer(eventType, handler) — les handlers doivent
     être IDEMPOTENTS (documente-le en tête de fichier).
3. Émission : dans server/services/sales.ts (recordSale), émets sale.recorded
   { saleId, ticketNumber, establishmentId, registerId, customerId?, totalTTC } dans la
   transaction. N'émets QUE cet événement pour l'instant (close-day et stock viendront avec
   leurs extractions de service respectives).
4. Déclenchement :
   - Endpoint POST /api/internal/process-events protégé par CRON_SECRET (même pattern que A5).
   - vercel.json : cron toutes les minutes.
   - Opportuniste : après le commit de recordSale, event.waitUntil(processPendingEvents(...))
     depuis le handler (latence quasi-nulle dans le cas nominal, le cron n'est que le filet).
5. Aucun consommateur métier dans ce prompt (B5 branchera sync) — ajoute uniquement un
   consommateur de log Pino pour valider la mécanique de bout en bout.
6. Tests : émission dans la transaction (rollback → pas d'événement), processPendingEvents
   (traitement, idempotence du marquage, SKIP LOCKED simulé par 2 appels concurrents si
   testable, échec → attempts++, abandon → Sentry mocké).

Termine par pnpm ci.
```

### B5 — sync.ts : la propagation devient un consommateur d'événements

```text
Objectif : sortir la propagation multi-établissement (server/utils/sync.ts, 800 lignes,
complexité 🟠) du chemin synchrone des requêtes d'écriture produits/clients, en la branchant
sur l'outbox de B4. Bénéfices : latence d'écriture réduite, découplage, rejeu en cas d'échec.

Prérequis : B4 mergé. Règle n°3 : caractérisation d'abord.

Étape 1 — caractérisation (ne rien modifier) :
- Inventorie tous les appels à propagateProductChange / propagateCustomerChange (grep) et le
  comportement attendu (quels champs propagés selon syncRules, vers quels établissements).
- Tests de caractérisation sur les fonctions de propagation si les tests existants ne couvrent
  pas déjà ces chemins (vérifie tests/api/sync-groups + tests unitaires éventuels).

Étape 2 — bascule :
1. Les endpoints produits/clients qui appelaient la propagation inline émettent à la place
   (dans leur transaction) product.changed / customer.changed { entityId, establishmentId,
   changedFields }.
2. Consommateurs enregistrés (registerConsumer de B4) qui appellent la logique EXISTANTE de
   sync.ts — tu déplaces l'appel, pas la logique. sync.ts lui-même n'est pas réécrit.
3. Idempotence : la propagation doit être rejouable sans effet double (vérifie que les writes
   de sync.ts sont des upserts/updates absolus, pas des incréments — documente).
4. UI : la propagation devient asynchrone (décalage de quelques secondes max). Vérifie qu'aucun
   écran ne relit immédiatement les données propagées après une écriture (grep les flux
   d'édition produit/client) ; si c'est le cas, note-le dans la PR — on décidera si on attend
   l'événement ou si on assume l'éventuelle latence.
5. resync.post.ts (opération destructive, règle n°5) : NE PAS TOUCHER dans ce prompt.

Tests : caractérisation verte avant/après ; test d'intégration « update produit → événement
émis → consommateur propage → champs synchronisés selon les rules ».
Termine par pnpm ci.
```

### B6 — Éclatement de schema.ts par domaine

```text
Objectif : découper server/database/schema.ts (1439 lignes, 33 tables, zone critique) en
modules par domaine, sans AUCUN impact runtime ni migration.

Implémente :
1. server/database/schema/ avec : sales.ts (sales, saleItems, closures, archives),
   catalog.ts (products, categories, brands, suppliers, taxRates, variationGroups, variations),
   stock.ts (productStocks, productEstablishments, movements, stockMovements),
   people.ts (customers, customerEstablishments, sellers, sellerEstablishments),
   org.ts (establishments, registers), sync.ts (syncGroups, syncGroupEstablishments, syncRules,
   syncLogs), loyalty.ts (loyaltyVouchers + tables fidélité), audit.ts (auditLogs),
   events.ts (domain_events si B4 est passé) — ajuste le découpage à l'inventaire réel.
2. Les relations Drizzle vont dans le fichier de leur table source ; les imports croisés entre
   domaines sont normaux (FK).
3. server/database/schema.ts devient un fichier de ré-exports (export * from './schema/...') :
   AUCUN import existant ne change dans le reste du code (grep pour vérifier).
4. Preuve de non-impact : pnpm db:generate ne doit produire AUCUNE migration (drizzle-kit voit
   un schéma identique). C'est le critère d'acceptation n°1 — colle la sortie dans la PR.
5. drizzle.config.ts : vérifie que le chemin de schéma couvre le nouveau dossier.

Interdit : renommer une table, une colonne, un export ; toucher au contenu des définitions.
Pur déplacement. Termine par pnpm ci + preuve db:generate vide.
```

### B7 — Suppression des colonnes stock deprecated (P3.5 phase 2)

```text
Objectif : clore la dette stock — supprimer products.stock et products.stockByVariation,
gelées depuis P3.5 (@deprecated, plus aucune écriture ; la vérité est dans productStocks).

Implémente :
1. Grep exhaustif de TOUTES les lectures restantes de products.stock / stockByVariation
   (serveur, client, types, tests, seed). Colle l'inventaire dans la PR. Pour chaque lecture
   restante : bascule vers productStocks (ou supprime si code mort). Attention particulière à
   utils/productHelpers.ts, stores/products.ts et server/utils/productOverrides.ts.
2. Quand plus AUCUNE référence : retire les colonnes de server/database/schema.ts (règle n°2 :
   l'inventaire de l'étape 1 EST l'inventaire des endpoints impactés) puis pnpm db:generate
   pour la migration de DROP COLUMN.
3. Avant le DROP en staging/prod : vérifie en SQL qu'aucune divergence résiduelle n'existe
   entre l'ancienne colonne et productStocks (requête de contrôle dans la PR) — si divergence,
   STOP et rapporte.
4. Mets à jour CLAUDE.md (risque ouvert 🟠 « colonnes stock deprecated » → ✅).

Termine par pnpm ci + e2e vert (le flux de vente déstocke).
```

---

## Checklist de suivi

### Phase A — filet de sécurité & infra
- [x] A1 — Erreurs API normalisées (code + retryable)
- [x] A2 — Baseline squash migrations ✅ règle n°1 levée le 2026-07-06
- [ ] A3 — e2e Playwright smoke en CI
- [ ] A4a — RLS socle + pilote suppliers/brands
- [ ] A4b — RLS généralisé (5 vagues)
- [x] A5 — Alerting Sentry invariants + verify-chain planifié — branche `feat/a5-alerting-invariants` (2026-09-10, non mergée : merge suspendu par la vérif de schéma staging ; reste à poser `CRON_SECRET` sur Vercel)

### Phase B — couche domaine
- [ ] B1 — Caractérisation création de vente
- [ ] B2 — Extraction services/sales.ts (recordSale)
- [ ] B3 — Types uniques z.infer
- [ ] B4 — Outbox événements de domaine + émission sale.recorded
- [ ] B5 — sync.ts consommateur d'événements
- [ ] B6 — Éclatement schema.ts par domaine
- [ ] B7 — Suppression colonnes stock deprecated

### Suite du plan — révisée le 2026-09-10 (SaaS online-only)

**Abandonné, ne pas planifier :**
- ~~Phase 3 offline / local-first~~ — décision produit du 2026-09-10 : FymPOS reste un SaaS
  online-only. Plus de PWA local-first, plus de réplication Dexie, plus d'outbox client, plus
  de ticket provisoire hors ligne (et plus de question offline au dossier de certification).

**Ce qui monte en priorité à la place** (le serveur n'a plus de filet — il *est* la caisse) :
- Finir A3 (e2e) et A5 (alerting invariants) : ce sont désormais les seuls détecteurs de panne.
- **Trancher l'hébergement avant le premier commerce pilote** (conteneur long-lived vs Vercel,
  §4.1 + §10 du doc d'audit) — décision rouverte, plus « après certification ».
- Matériel terrain : imprimante thermique ESC/POS, TPE, abstraction périphériques (R9).

**Conservé, sans urgence :**
- B2 (services/sales.ts) et B4/B5 (outbox) — motivés par la lisibilité, le click & collect et
  les tests domaine, plus par l'offline.
- Extraction services closures + stock (même pattern que B2), sessions vendeur PIN.
- Tauri : uniquement si un périphérique l'exige (jamais pour l'offline).
