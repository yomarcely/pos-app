# 11 — Plan de corrections post-audit (2026-06-12)

> Plan de prompts à exécuter dans Claude Code (VS Code), issu de l'audit complet du 2026-06-12.
> **1 prompt = 1 session Claude Code.** Ne pas enchaîner deux prompts dans la même session
> (contexte pollué = régressions). Chaque prompt est autonome et copiable tel quel.

## Comment utiliser ce plan

1. Ouvrir une **nouvelle session** Claude Code, coller le prompt, idéalement en **plan mode**
   (`Shift+Tab`) pour valider l'approche avant d'écrire du code.
2. Avant de committer : `pnpm ci` (lint + typecheck + audits + tests) doit être vert.
3. Une branche par prompt (`fix/p1-1-tenant-header`, etc.), merger avant de passer au suivant.
4. Cocher la checklist en fin de fichier après chaque merge.
5. L'ordre des phases est important. L'ordre **dans** une phase l'est moins (sauf mention).

**Règle d'or** : si Claude propose de toucher un fichier hors du périmètre du prompt, refuser
et noter pour plus tard. Les prompts sont volontairement étroits.

---

## PHASE 1 — Sécurité & intégrité (critique, à faire en premier)

### P1.1 — Faille tenant : valider le header `x-tenant-id`

```text
Dans server/utils/supabase.ts, la fonction getTenantFromUser (lignes 30-52) accepte le header
x-tenant-id sans AUCUNE validation (priorité 1, retour immédiat ligne 32-33). Un utilisateur
authentifié peut forger ce header et accéder aux données d'un autre tenant : c'est une faille
critique d'isolation multi-tenant (broken access control).

Corrige ainsi :
1. Construis la liste des tenants autorisés de l'utilisateur depuis user.app_metadata (et
   user_metadata en fallback) : tenant_id, tenantId, tableau tenants[] (id | tenant_id | slug),
   plus user.id (convention 1 user = 1 tenant, priorité 4 actuelle).
2. Si le header x-tenant-id est présent : il doit figurer dans cette liste, sinon retourner null
   (assertAuth lèvera l'erreur) — ne pas lever de 403 détaillé qui confirmerait l'existence du tenant.
3. Sans header : comportement actuel inchangé (metadata → tenants[0] → user.id → null).

Contraintes :
- Ne modifie QUE getTenantFromUser. Ne touche pas à assertAuth ni au middleware.
- Respecte l'invariant CLAUDE.md : server/utils/supabase.ts n'est importé que par
  server/middleware/auth.global.ts.
- Ajoute des tests unitaires : header autorisé accepté, header non autorisé rejeté, header
  égal à user.id accepté, absence de header = comportement inchangé, user sans metadata.
- Vérifie ensuite que plugins/01.api-fetch.client.ts envoie bien un x-tenant-id qui correspond
  au tenant de l'utilisateur connecté (sinon les utilisateurs légitimes seraient bloqués).
Termine par pnpm ci.
```

### P1.2 — Bug NF525 : `saleDate` du hash ≠ `saleDate` stockée

```text
Bug critique dans server/api/sales/create.post.ts : le hash NF525 est calculé avec un
new Date() (ticketData, ~ligne 416) mais la vente est insérée avec un AUTRE new Date()
(~ligne 449). generateTicketHash inclut saleDate.toISOString() avec les millisecondes
(server/utils/nf525.ts:66), et verifyTicketChain (nf525.ts:229-252) recalcule le hash depuis
la date STOCKÉE. Résultat : la vérification de chaîne (server/api/sales/verify-chain.get.ts)
signale quasiment chaque ticket comme corrompu.

Corrige ainsi :
1. Dans create.post.ts, crée UNE seule constante saleDate = new Date() avant la construction
   de ticketData, et utilise-la à la fois dans ticketData ET dans l'insert de la vente.
2. Vérifie qu'il n'y a pas d'autre divergence entre ce qui est hashé et ce qui est stocké/relu :
   compare champ par champ ticketData (création) vs la reconstruction dans verify-chain.get.ts
   (lignes 104-121). Documente dans un commentaire chaque correspondance non triviale.
3. Ajoute un test d'intégration "round-trip" : créer le payload d'une vente, calculer son hash,
   simuler le stockage (decimal → string → Number comme le fait verify-chain), recalculer le
   hash, assert qu'ils sont identiques. Ce test doit échouer avant le fix et passer après.
4. Les ventes existantes ont des hashes calculés avec une date jamais stockée : elles resteront
   invérifiables. Ajoute une note datée dans docs/audit/08-nf525-tests.md expliquant que la
   vérification de contenu n'est fiable qu'à partir de ce commit (le chaînage previousHash →
   currentHash, lui, reste vérifiable sur tout l'historique).

Zone critique CLAUDE.md (create.post.ts + nf525.ts) : ne change RIEN d'autre dans ces fichiers,
n'altère pas l'algorithme de hash lui-même. Termine par pnpm ci.
```

### P1.3 — Stock négatif silencieux

```text
Dans server/api/sales/create.post.ts (~lignes 623-664), le stock est décrémenté sans aucune
borne : newStock = oldStock - quantity peut devenir négatif silencieusement. En retail la
survente doit rester POSSIBLE (le stock système est souvent faux), mais elle doit être EXPLICITE.

Implémente :
1. Dans la transaction de vente, quand newStock < 0 (stock principal OU stockByVariation) :
   la vente passe quand même, mais ajoute un champ booléen oversell sur le mouvement de stock
   correspondant (nouvelle colonne stock_movements.oversell, default false) et logge un warning
   structuré (logger.warn) avec productId, variation, oldStock, quantity.
2. Nouvelle migration via pnpm db:generate UNIQUEMENT (règle absolue CLAUDE.md : jamais de
   migration à la main, jamais modifier une migration existante).
3. La réponse de l'endpoint inclut déjà stockWarnings/stockUpdateLogs : enrichis-la pour que le
   client sache QUELS articles sont en survente (nom du produit + stock restant).
4. Côté caisse, composables/useCheckout.ts affiche actuellement "Stock insuffisant pour certains
   articles — la vente continue" : remplace par un toast listant les articles concernés.
5. Tests : vente avec stock suffisant (oversell=false), vente en survente (passe + flag + warning),
   survente sur variation.

Zone critique : tests de régression d'abord (caractérise le comportement actuel avant de coder).
Termine par pnpm ci.
```

### P1.4 — Fuites d'erreurs internes + validation des query params

```text
Plusieurs endpoints renvoient error.message brut au client dans le catch final, ce qui expose
des détails internes (erreurs SQL, noms de colonnes). Exemples confirmés :
- server/api/sales/create.post.ts ~ligne 845
- server/api/sales/verify-chain.get.ts ~ligne 168

Travail :
1. Fais un grep sur server/api/ pour le pattern "error instanceof Error ? error.message" dans
   les createError de statusCode 500, et liste tous les endpoints concernés.
2. Pour chacun : conserve le logger.error détaillé, mais renvoie un message générique en
   français au client ("Une erreur interne s'est produite"). NE CHANGE PAS les erreurs 4xx
   métier (messages volontairement explicites pour l'UI).
3. Dans verify-chain.get.ts : valide les query params (startDate, endDate, limit, registerId)
   avec un schéma Zod (dates au format YYYY-MM-DD, limit borné à 5000, registerId entier
   positif) et renvoie un 400 propre si invalide.
4. Tests sur verify-chain : params invalides → 400 ; erreur interne simulée → message générique.
Termine par pnpm ci.
```

### P1.5 — Migration "hygiène DB" : unicités par tenant + index composites

```text
Migration unique d'hygiène sur server/database/schema.ts. Règle absolue CLAUDE.md : inventorie
d'abord les endpoints impactés (grep des tables touchées), nouvelle migration via
pnpm db:generate, jamais de modification de migration existante.

Changements :
1. sales.ticketNumber : l'index unique global (schema.ts:24) devient unique composite
   (tenantId, ticketNumber). Deux tenants peuvent légitimement générer le même numéro
   (format YYYYMMDD-Exx-Rxx-NNNNNN).
2. closures.closureHash : unique global → composite (tenantId, closureHash).
3. sellers.code : unique global → composite (tenantId, code).
4. Index composites pour les requêtes chaudes :
   - sales (tenant_id, register_id, status)
   - sales (tenant_id, establishment_id, sale_date)
   - closures (tenant_id, register_id, closure_date)
   - product_stocks (tenant_id, establishment_id, product_id)
5. AVANT de générer la migration : écris un script de vérification (ou requête SQL documentée)
   qui détecte les doublons existants qui violeraient les nouvelles contraintes uniques, à
   exécuter sur staging/prod avant d'appliquer.

Ne change AUCUN type de colonne, AUCUNE autre table. Vérifie que pnpm audit:migrations passe.
Termine par pnpm ci.
```

---

## PHASE 2 — Robustesse du poste de caisse

### P2.1 — Persistance du panier (perte au F5)

```text
Le panier (stores/cart.ts) n'est jamais persisté localement : un F5, un crash ou une expiration
de session en plein encaissement fait tout perdre. Le store shortcutBoard.ts persiste déjà en
localStorage scopé par établissement : applique le même pattern au panier.

Implémente dans stores/cart.ts :
1. Persiste en localStorage (clé scopée : fympos-cart-{tenantId}-{registerId}) : items,
   globalDiscount, globalDiscountType, client sélectionné (id seulement), vouchers appliqués,
   paiements en cours (state de useCheckout à rapatrier ou persister séparément — analyse et
   propose la solution la plus simple).
2. watch deep sur ces états → sauvegarde (débounce 300ms pour éviter le thrashing).
3. Restauration au montage de la page caisse SI la clé correspond au tenant/register courant,
   avec un toast discret "Panier restauré". Purge de la clé après vente validée ou panier vidé.
4. Garde-fou : si le JSON stocké est corrompu ou dépasse 500 Ko, purge silencieuse.
5. Respecte l'invariant CLAUDE.md n°5 : ajoute la purge du panier persisté dans
   stores/auth.ts:signOut().
6. Tests store : persistance, restauration, scoping tenant/register, purge au signOut.

Zone critique cart.ts : tests de caractérisation des getters de totaux AVANT modification.
Ne touche pas à utils/cartUtils.ts. Termine par pnpm ci.
```

### P2.2 — Idempotence des ventes (clientSaleId)

```text
Objectif : rendre POST /api/sales/create idempotent pour protéger du double-submit et préparer
un futur mode offline (rejeu sans doublon).

Implémente :
1. Colonne sales.clientSaleId (uuid, nullable, unique composite avec tenantId) via une nouvelle
   migration pnpm db:generate. Inventorie les endpoints impactés avant (règle CLAUDE.md).
2. Côté client : stores/cart.ts génère un clientSaleId (crypto.randomUUID()) à l'ajout du
   premier article ; il est persisté avec le panier (cf. P2.1 si déjà mergé), envoyé dans le
   payload de useCheckout.ts, et régénéré après vente réussie ou panier vidé.
3. Côté serveur, dans server/api/sales/create.post.ts, AVANT la transaction : si une vente
   existe déjà avec ce (tenantId, clientSaleId), retourner cette vente existante avec un flag
   duplicate: true au lieu d'en créer une nouvelle (réponse 200, même shape).
4. Validation Zod : clientSaleId uuid optionnel (rétro-compatible si absent).
5. Tests : même payload envoyé 2 fois → une seule vente créée, deuxième réponse duplicate:true ;
   deux clientSaleId différents → deux ventes.

Zone critique create.post.ts : modification minimale (un check en tête + un champ à l'insert).
Termine par pnpm ci.
```

### P2.3 — Verrou UI, erreurs bloquantes, retry réseau

```text
Trois faiblesses du flow d'encaissement à corriger ensemble (composables/useCheckout.ts,
components/caisse/ColRight.vue, plugins/01.api-fetch.client.ts) :

1. VERROU UI : pendant isSubmitting, désactive (disabled + opacité) le bouton de validation,
   les boutons d'ajout de paiement et la modification du panier. Actuellement seul un guard
   "if (isSubmitting) return" existe : un double-clic ou une modification du panier pendant la
   requête est possible.
2. ERREUR BLOQUANTE : si la validation de vente échoue (réseau ou 4xx/5xx), remplace le toast
   éphémère par un Dialog modal (composants ShadCN existants) affichant : le message d'erreur,
   le total du panier, et deux actions "Réessayer" / "Fermer". Le panier est INTACT (vérifie
   qu'aucun reset n'a lieu en cas d'échec).
3. RETRY RÉSEAU : pour la soumission de vente uniquement (idempotente grâce au clientSaleId de
   P2.2 — prérequis), retry automatique 3 tentatives avec backoff (1s, 2s, 4s) sur erreur
   réseau ou 5xx. Pas de retry sur 4xx. Affiche "Nouvelle tentative…" dans le bouton.

Ne crée pas de couche HTTP générique : le retry ne concerne que validerVente. Tests composable :
double-clic ne soumet qu'une fois ; échec 500 → modal + panier intact ; succès après retry.
Termine par pnpm ci.
```

### P2.4 — 401 : tentative de refresh avant logout

```text
plugins/01.api-fetch.client.ts (lignes ~14-16) déconnecte brutalement au moindre 401 :
auth.signOut() + redirect /login. Si le token expire en pleine vente, le caissier perd sa
session devant le client.

Implémente :
1. Sur 401 : tente UNE FOIS supabase.auth.refreshSession() (via le client de
   plugins/00.supabase.ts / stores/auth.ts). Si succès : rejoue la requête originale avec le
   nouveau token et continue normalement. Si échec : comportement actuel (signOut + /login).
2. Anti-boucle : pas de re-tentative si la requête rejouée reprend un 401 ; pas de refresh
   concurrent (mutex simple : si un refresh est en cours, attendre sa promesse).
3. Le panier persisté (P2.1) survit au logout-relogin : vérifie que la purge au signOut
   distingue "déconnexion volontaire" (purge) et "session expirée" (conserver le panier) —
   propose la solution la plus simple, par exemple un flag passé à signOut().
4. Tests : 401 + refresh OK → requête rejouée ; 401 + refresh KO → logout ; pas de boucle.

Invariant CLAUDE.md n°3 : tout passe par ce plugin, ne crée pas de client $fetch alternatif.
Termine par pnpm ci.
```

### P2.5 — Raccourcis clavier caisse

```text
La page caisse n'a aucun raccourci clavier : tout se fait à la souris/tactile, ce qui ralentit
fortement un caissier au comptoir. Crée composables/useCaisseShortcuts.ts (avec
useEventListener de @vueuse/core, déjà en dépendance) monté UNIQUEMENT sur pages/caisse :

- F1 : ajouter le solde restant en paiement Espèces
- F2 : ajouter le solde restant en paiement Carte
- F10 ou Ctrl+Entrée : valider la vente (si solde = 0)
- Suppr : retirer la dernière ligne du panier
- Échap : fermer le dialog/drawer ouvert, sinon focus sur le champ de recherche produit
- Ctrl+S (preventDefault) : mettre le ticket en attente
- / : focus recherche produit

Contraintes :
1. Les raccourcis sont INACTIFS quand le focus est dans un input/textarea (sauf Échap et F-keys),
   pour ne pas interférer avec la saisie scanner/recherche.
2. Désactivés pendant isSubmitting et quand la journée est clôturée (isDayClosed).
3. Affiche les raccourcis en hint discret sur les boutons concernés (ex: "Espèces (F1)").
4. preventDefault sur les F-keys interceptées (F1 = aide navigateur sinon).
5. Tests du composable : mapping touches → actions, inactivité dans un input, inactivité
   pendant isSubmitting.

N'introduis pas de lib de hotkeys externe. Termine par pnpm ci.
```

### P2.6 — Flow de retour + impression automatique

```text
Deux irritants caisse à corriger :

1. RETOUR MULTI-ARTICLES : components/caisse/ColMiddle.vue (~lignes 310-335) ouvre un dialog
   "Remettre en stock ?" PAR article retourné. Remplace par un seul dialog de confirmation de
   retour listant les articles, avec une checkbox par ligne "Remettre en stock" (cochée par
   défaut) et une checkbox d'en-tête "Tout remettre en stock". Le flag restockOnReturn existe
   déjà sur les items (types ProductInCart).

2. IMPRESSION AUTO : dans le dialog de succès de vente (SaleSuccessDialog), l'impression exige
   un clic. Ajoute un paramètre "Impression automatique du ticket" (persisté en localStorage,
   scopé par register, activé par défaut) : à la validation de la vente, déclenche
   usePrintDocument automatiquement, le dialog restant affiché avec un bouton "Réimprimer".
   Chaque réimpression manuelle appelle l'endpoint d'audit existant le plus proche (regarde
   server/utils/audit.ts) ou, s'il n'y en a pas, ajoute un événement d'audit "ticket_reprint"
   (traçabilité NF525 des réimpressions).

Tests : dialog de retour unique (composant), préférence d'impression persistée.
Termine par pnpm ci.
```

---

## PHASE 3 — NF525, intégrité financière, RBAC

### P3.1 — Vouchers : verrouillage transactionnel

```text
Dans server/api/sales/create.post.ts, les bons d'achat (usedVoucherIds) sont validés AVANT la
transaction (~lignes 327-364) puis marqués 'used' DANS la transaction sans relecture : deux
ventes simultanées peuvent consommer le même bon (double-dépense).

Corrige :
1. Déplace la validation des vouchers DANS la transaction, avec SELECT ... FOR UPDATE
   (db.select().for('update') en Drizzle) sur les lignes loyaltyVouchers concernées.
2. Re-vérifie status='active' + non expiré + appartient au client APRÈS acquisition du lock ;
   si un bon n'est plus valide, rollback avec un 409 explicite listant le code du bon.
3. La validation pré-transaction actuelle peut rester comme "fast fail" UX, mais la source de
   vérité est la re-vérification verrouillée.
4. Test d'intégration : deux créations de vente concurrentes (Promise.all) avec le même
   voucher → exactement une réussit, l'autre reçoit 409.

Zone critique create.post.ts : périmètre strictement limité au bloc vouchers.
Termine par pnpm ci.
```

### P3.2 — Avoirs chaînés NF525 (gros chantier — plan mode obligatoire)

```text
Lance-toi en PLAN MODE et propose-moi un plan avant tout code.

Contexte : server/api/sales/[id]/cancel.post.ts marque une vente status='cancelled' + audit
log, mais aucun document ne matérialise l'annulation dans la chaîne NF525 (la chaîne de tickets
ne porte aucune trace cryptographique de l'événement). La norme attend que l'annulation
produise un ticket d'avoir chaîné comme une vente normale.

Objectif : l'annulation crée un AVOIR = une vente de type 'credit_note' à montants négatifs qui :
1. Prend le prochain numéro de ticket de la séquence normale (même mécanique establishment/register).
2. Entre dans la chaîne de hash (previousHash → currentHash) comme n'importe quelle vente.
3. Référence la vente d'origine (colonne originalSaleId, nouvelle migration via pnpm db:generate).
4. Reprend les lignes de la vente d'origine en quantités négatives, gère le re-stockage (la
   logique stock de cancel.post.ts existe déjà — réutilise-la, et corrige au passage le N+1 :
   pré-fetch des productStocks en une requête au lieu d'une par item, lignes ~101-144).
5. La vente d'origine garde status='cancelled' + un lien vers l'avoir.
6. verify-chain.get.ts et close-day.post.ts doivent intégrer les avoirs correctement (totaux
   négatifs inclus dans la clôture).

Exigences : tests de caractérisation du flux cancel AVANT refactor (règle CLAUDE.md), puis tests
du nouveau flux (avoir chaîné, hash vérifiable round-trip, clôture cohérente, annulation
d'une vente déjà annulée → 409). Zones critiques multiples : un seul module à la fois, suis
ton plan validé.
```

### P3.3 — Clôture bloquante + tickets en attente

```text
Deux corrections sur server/api/sales/close-day.post.ts :

1. ASSERTION BLOQUANTE : assertHTplusTVAequalsTTC (~ligne 149, défini dans
   server/utils/financialValidation.ts) logge un warning si HT + TVA ≠ TTC mais laisse la
   clôture se faire. Change : en cas d'écart > 1 centime, la clôture échoue avec un 409
   détaillant l'écart et les totaux. Ajoute un paramètre force: true (validé Zod) pour clôturer
   quand même en enregistrant une anomalie dans l'audit log (logClosure enrichi).
2. TICKETS EN ATTENTE : avant de clôturer, vérifie s'il existe des pending_sales pour cet
   établissement/registre. S'il y en a : la réponse l'indique (count + liste sommaire) et la
   clôture est refusée SAUF si force: true (les tickets en attente restants sont alors
   journalisés dans l'audit log de clôture — traçabilité NF525 des paniers abandonnés).
3. Côté UI (pages/clotures ou synthese, repère où la clôture est déclenchée) : affiche le 409
   proprement avec le détail et propose "Forcer la clôture" derrière une confirmation.

Tests : clôture saine ; écart de totaux → 409 ; force → passe + audit ; pending présents → 409.
Zone critique close-day : caractérise le comportement actuel d'abord. Termine par pnpm ci.
```

### P3.4 — RBAC minimal (admin / manager / caissier)

```text
Lance-toi en PLAN MODE et propose-moi un plan avant tout code.

Aucun contrôle de rôle n'existe côté serveur : tout utilisateur authentifié du tenant peut
clôturer, modifier les prix, anonymiser des clients, lancer un resync destructif. Implémente un
RBAC minimal à 3 rôles, SANS système de permissions générique :

1. Le rôle vit dans user.app_metadata.role ('admin' | 'manager' | 'cashier'), défaut 'admin'
   pour la rétro-compatibilité (les comptes existants ne doivent rien perdre).
2. server/middleware/auth.global.ts ajoute role dans event.context.auth. Nouveau helper
   server/utils/roles.ts : assertRole(event, 'admin' | 'manager') qui lève 403.
3. Applique assertRole sur les endpoints sensibles — propose-moi la liste exacte dans ton plan,
   a minima : establishments (create/update/delete), registers, sellers (write), sync-groups
   (tout, dont resync), tax-rates (write), database/*, archives, clients/[id]/anonymize,
   products (write) = manager+, sales/close-day = manager+, reports/stats = manager+.
4. Côté UI : masque les entrées de navigation et boutons inaccessibles (le 403 serveur reste
   la vraie barrière). Un composable useUserRole() suffit.
5. Tests : caissier → 403 sur un endpoint admin ; manager → accès clôture ; absence de rôle →
   traité comme admin (rétro-compat).

Invariant CLAUDE.md : event.context.auth n'est posé QUE par le middleware ; les endpoints lisent
via des helpers. Mets à jour la section "Convention auth serveur" de CLAUDE.md avec le champ role.
```

### P3.5 — Source unique de stock (gros chantier — plan mode obligatoire)

```text
Lance-toi en PLAN MODE et propose-moi un plan avant tout code. Règle absolue CLAUDE.md :
inventaire complet des usages avant tout changement de schema.ts.

Problème : le stock vit en DOUBLE dans server/database/schema.ts : products.stock /
products.stockByVariation (~lignes 346-352) ET productStocks (par établissement). La vente ne
met à jour que productStocks ; l'API produits expose les deux (server/api/products/index.get.ts
lignes 98-101 et 113-117). Divergence garantie à terme.

Objectif : productStocks devient l'UNIQUE source de vérité.
1. Phase d'inventaire (à présenter dans ton plan) : grep exhaustif des lectures ET écritures de
   products.stock, products.stockByVariation, products.minStock, minStockByVariation — endpoints,
   stores, composants, seed. Tableau usage → remplacement.
2. Toute lecture "stock global d'un produit" devient un agrégat SUM sur productStocks (ou la
   valeur de l'établissement sélectionné quand il y en a un).
3. Les écritures sur products.stock sont supprimées ou redirigées vers productStocks.
4. Migration en 2 temps : d'abord le code n'écrit plus jamais products.stock (colonne gelée),
   ensuite seulement une migration de suppression (séparée, plus tard — ne la fais PAS dans
   cette session, marque les colonnes deprecated en commentaire comme tva l'est déjà).
5. Tests de régression sur : création de vente, annulation, mouvements, page stocks, alertes
   de stock bas.

Découpe en plusieurs sessions si l'inventaire révèle plus de 10 fichiers à modifier — dans ce
cas livre d'abord l'inventaire + le plan de découpage, et on enchaînera.
```

### P3.6 — Archives : intégrité réelle

```text
server/api/archives/create.post.ts "signe" les archives avec un SHA-256 d'elles-mêmes
(archiveSignature = sha256(hash + période)) et les stocke inline en DB : quiconque a accès à la
base peut modifier ET re-signer. Valeur probante nulle.

Solution pragmatique (sans attendre INFOCERT) :
1. Exporte chaque archive vers le bucket R2 déjà utilisé pour les backups (réutilise la config/
   credentials du workflow de backup — regarde .github/workflows et scripts/), dans un préfixe
   archives/{tenantId}/, avec le hash SHA-256 dans les métadonnées de l'objet.
2. Si R2 n'est pas accessible depuis le runtime serveur (credentials absents), l'archive est
   créée en DB comme aujourd'hui avec un statut 'pending_export' + un endpoint ou script de
   ré-export. Ne casse pas le flux existant.
3. Documente dans docs/runbooks/ la procédure de vérification d'intégrité (hash DB vs objet R2)
   et la recommandation d'activer l'Object Lock / versioning côté Cloudflare (action manuelle).
4. Tests : génération d'archive avec hash stable, statut pending_export sans credentials.

Quand la signature INFOCERT réelle arrivera (generateTicketSignature, nf525.ts:153-168), elle
remplacera le sha256 — ne l'implémente pas maintenant, laisse le TODO.
```

---

## PHASE 4 — Nettoyage & dette (sessions courtes, quand tu as 1h)

### P4.1 — Purge des `any` en production

```text
Dans eslint.config.js, passe '@typescript-eslint/no-explicit-any' de 'off' à 'warn', lance
pnpm lint, et corrige TOUS les any des fichiers de PRODUCTION (pas les tests) : typage explicite
ou unknown + narrowing. Fichiers connus : composables/useEstablishmentRegister.ts,
components/caisse/{AddClientForm,ColLeft,ColMiddle}.vue, utils/productHelpers.ts,
plugins/01.api-fetch.client.ts, pages/{produits,clients,synthese,stocks,dashboard}/.
Le 'as any' de nuxt.config.ts:75 (plugin tailwind/vite) peut rester avec un commentaire.
Aucun changement de comportement : pnpm ci doit passer à l'identique.
```

### P4.2 — Code mort & exemples

```text
Supprime après vérification grep des usages (règle CLAUDE.md : pas de suppression sans grep) :
1. stores/tickets.ts + tests/stores/ticketsStore.test.ts (store orphelin, zéro import).
2. pages/sentry-example-page.vue et server/api/sentry-example-api.ts.
3. Les 4 fonctions identifiées mortes dans docs/audit/04-dead-code.md si toujours sans usage.
Vérifie qu'aucune route/nav ne pointe vers les pages supprimées. pnpm ci vert.
```

### P4.3 — N+1 et limites de requêtes

```text
1. server/api/sales/[id]/cancel.post.ts (~lignes 101-144) : remplace les SELECT par item
   (productStocks + variations) par 2 pré-fetch bulk (inArray) + Maps, comme le fait déjà
   create.post.ts lignes 548-577. (Sauter si P3.2 — avoirs — a déjà refactoré ce fichier.)
2. server/api/sales/close-day.post.ts : les totaux sont calculés en JS sur toutes les ventes
   chargées sans LIMIT. Garde le chargement pour le détail mais calcule les totaux via agrégat
   SQL (SUM en centimes : SUM(ROUND(total_ttc * 100))) et assert que JS et SQL concordent
   pendant une période de transition (logger.warn si écart).
Tests de non-régression sur les deux endpoints. pnpm ci vert.
```

### P4.4 — Singletons → stores Pinia

```text
composables/useEstablishmentRegister.ts et composables/useLoyaltyForCustomer.ts utilisent des
refs au niveau module (singletons manuels). C'est un store Pinia réinventé, avec reset manuel
obligatoire au signOut (invariant CLAUDE.md n°5).

Convertis useEstablishmentRegister en store Pinia stores/establishmentRegister.ts :
1. API publique IDENTIQUE (mêmes noms de refs/fonctions retournées) pour limiter le diff dans
   les ~10 fichiers consommateurs : le composable devient un simple wrapper qui retourne le store.
2. Conserve la persistance localStorage scopée tenant et la logique d'hydratation.
3. signOut() utilise $reset / la mécanique Pinia standard.
4. Mets à jour CLAUDE.md (section "Points non-évidents" et invariant n°5) puisque le singleton
   module-level disparaît.
5. Même opération pour useLoyaltyForCustomer dans une 2e étape de la même session si le premier
   refactor est vert, sinon reporte.
Tests existants du composable adaptés + pnpm ci vert. Zone critique CLAUDE.md : tests de
caractérisation d'abord.
```

---

## Hors périmètre Claude Code (actions fondateur)

- **Certification NF525** : contacter INFOCERT (AFNOR) et/ou LNE dès maintenant. Depuis la loi
  de finances 2025, l'attestation individuelle d'éditeur n'est plus admise — seule la
  certification par organisme accrédité vaut. Leurs exigences précises (JET, avoirs, archivage,
  signature) doivent piloter la fin de la phase 3. Délai en mois → à lancer en parallèle.
- **Drill de restauration backup** : restaurer un backup R2 sur une base vierge, chronométrer,
  documenter dans docs/runbooks/.
- **Choix TPE** (Stripe Terminal / SumUp / autre selon la cible) et **test QZ Tray** avec une
  imprimante thermique 80 mm réelle — prérequis matériels avant les prompts d'intégration
  hardware (non inclus ici, à écrire après ces choix).

## Checklist de suivi

| # | Prompt | Statut |
|---|--------|--------|
| P1.1 | Validation x-tenant-id | ☑ |
| P1.2 | Fix saleDate hash NF525 | ☑ |
| P1.3 | Stock négatif explicite | ☑ |
| P1.4 | Erreurs génériques + Zod query | ☑ |
| P1.5 | Migration hygiène DB | ☑ |
| P2.1 | Persistance panier | ☑ |
| P2.2 | Idempotence clientSaleId | ☑ |
| P2.3 | Verrou UI + modal + retry | ☑ |
| P2.4 | 401 refresh token | ☑ |
| P2.5 | Raccourcis clavier | ☑ |
| P2.6 | Retours + impression auto | ☑ |
| P3.1 | Vouchers FOR UPDATE | ☑ |
| P3.2 | Avoirs chaînés | ☑ |
| P3.3 | Clôture bloquante | ☑ |
| P3.4 | RBAC minimal | ☑ |
| P3.5 | Source unique stock | ☑ |
| P3.6 | Archives R2 | ☑ |
| P4.1 | Purge any | ☑ |
| P4.2 | Code mort | ☑ |
| P4.3 | N+1 + agrégats SQL | ☑ (N+1 cancel via P3.2, agrégats close-day via P3.3) |
| P4.4 | Singletons → Pinia | ☑ |

*Généré à partir de l'audit complet du 2026-06-12 (voir conversation d'audit). Chaque finding
cité a été vérifié dans le code (fichier:ligne) avant d'entrer dans ce plan.*
TEST