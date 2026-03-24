# Tests manuels FymPOS

> Version : mars 2026
> Objectif : valider l'état fonctionnel complet avant ajout de nouvelles features
> Durée totale estimée : 3h30 à 4h30 (selon données disponibles)

---

## Comment utiliser ce document

1. **Avant de commencer** : prépare l'environnement (voir section ci-dessous)
2. **Coche chaque case** au fur et à mesure : `- [x]`
3. **Note les anomalies** directement dans le fichier sous l'item concerné avec `> ⚠️ Bug observé : ...`
4. **Priorité de passage** : sections 🔴 d'abord, puis 🟠, puis 🟡
5. **Régression rapide** : si tu as peu de temps, saute directement à la section finale "Régression rapide"

---

## Environnement de test

Avant de commencer, s'assurer que :

- [ ] L'application tourne en local (`pnpm dev`) ou sur l'environnement de staging
- [ ] La base de données est accessible (vérifier `pnpm drizzle-kit studio` si besoin)
- [ ] Un compte utilisateur de test existe (email + mot de passe connus)
- [ ] Des données de seed sont présentes (produits, clients, vendeurs, établissements)
- [ ] Un second compte ou un second tenant est disponible si tu veux tester le multi-tenant
- [ ] Les outils de dev du navigateur sont ouverts (onglet Réseau pour vérifier les appels API)
- [ ] Désactiver les extensions de navigateur susceptibles de bloquer les requêtes

**Données de test recommandées à avoir en base avant de commencer :**
- Au moins 2 produits avec TVA différentes (ex : un à 5,5% et un à 20%)
- Au moins 1 produit avec variations (ex : taille S/M/L)
- Au moins 1 client existant
- Au moins 1 vendeur existant
- Au moins 1 établissement avec une caisse enregistreuse assignée
- Stock non nul sur au moins 3 produits

---

## 01 — Authentification

> ⏱ Durée estimée : 15-20 min

> ⚠️ **Zones à risque connues**
> - La restauration de session après rechargement repose sur `restoreSession()` dans `stores/auth.ts`. En cas d'erreur réseau, la session est perdue silencieusement → l'utilisateur est redirigé vers `/login`.
> - `signOut` sans réseau : l'état local est nettoyé même si Supabase échoue (comportement voulu).
> - `signUp` : après inscription, le store auth doit être hydraté avant la redirection vers le dashboard.

### Connexion

- [ ] **[Nominal] Connexion avec identifiants valides**
  - Prérequis : compte utilisateur existant
  - Étapes : aller sur `/login`, saisir email + mot de passe corrects, cliquer "Se connecter"
  - Résultat attendu : redirection vers `/dashboard` ou `/caisse`, le nom de l'utilisateur apparaît dans l'interface

- [ ] **[Erreur] Connexion avec mauvais mot de passe**
  - Étapes : saisir un email valide + mauvais mot de passe
  - Résultat attendu : message d'erreur visible (pas de redirection), champs non effacés

- [ ] **[Erreur] Connexion avec email inconnu**
  - Étapes : saisir un email qui n'existe pas
  - Résultat attendu : message d'erreur visible (pas de détail "email inexistant" pour éviter l'énumération)

- [ ] **[Limite] Champs vides**
  - Étapes : cliquer "Se connecter" sans rien saisir
  - Résultat attendu : validation côté client, pas d'appel API envoyé

### Session et restauration

- [ ] **[Nominal] Restauration de session après rechargement de page**
  - Prérequis : être connecté
  - Étapes : recharger la page (F5 / Cmd+R)
  - Résultat attendu : l'utilisateur reste connecté, pas de redirection vers `/login`

- [ ] **[Nominal] Le guard auth redirige vers `/login` si non connecté**
  - Étapes : en étant déconnecté, tenter d'accéder directement à `/caisse` ou `/dashboard` via l'URL
  - Résultat attendu : redirection immédiate vers `/login`

### Déconnexion

- [ ] **[Nominal] Déconnexion normale**
  - Étapes : cliquer sur le bouton de déconnexion
  - Résultat attendu : redirection vers `/login`, session effacée (F5 ne restaure pas la session)

### Inscription

- [ ] **[Nominal] Inscription d'un nouvel utilisateur**
  - Prérequis : adresse email non utilisée
  - Étapes : aller sur `/signup` (si la page est accessible), remplir nom + email + mot de passe, valider
  - Résultat attendu : redirection vers le dashboard, utilisateur connecté immédiatement (store auth hydraté)
  - ⚠️ Note : vérifier que l'utilisateur est bien connecté (nom visible) — bug connu corrigé (signUp hors store)

### Multi-tenant (si applicable)

- [ ] **[Nominal] Sélection de tenant si l'utilisateur appartient à plusieurs établissements**
  - Prérequis : compte avec plusieurs tenants dans `app_metadata`
  - Étapes : se connecter, observer si un sélecteur de tenant apparaît
  - Résultat attendu : l'utilisateur peut choisir son établissement, le bon `tenantId` est utilisé pour les appels API suivants

---

## 02 — Caisse (Point de vente)

> ⏱ Durée estimée : 45-60 min

> ⚠️ **Zones à risque connues**
> - La création de vente (`POST /api/sales/create`) est le point le plus critique du système. Elle déclenche : débit de stock, calcul NF525, hash de chaînage, audit trail.
> - Le serveur revalide les totaux avec une tolérance de 2 centimes (correction P1). Un écart de plus de 2 centimes déclenche un rejet 400.
> - `validateStock()` côté client est une vérification UX, pas une garantie. La validation autoritaire est côté serveur.
> - La vérification de clôture du jour (`checkDayClosure`) est faite à l'ouverture de la vue caisse. Si la caisse est déjà clôturée, on ne devrait pas pouvoir vendre.
> - Le panier suspendu (`pendingCart`) est géré dans `stores/cart.ts`. Une récupération incorrecte peut mélanger deux paniers.

### Préparation

- [ ] La page `/caisse` s'affiche sans erreur
- [ ] Un vendeur est sélectionné (ou la sélection vendeur fonctionne)
- [ ] Un établissement et une caisse sont sélectionnés

### Ajout de produits

- [ ] **[Nominal] Ajout d'un produit simple au panier**
  - Prérequis : un produit sans variation en stock
  - Étapes : chercher le produit dans la liste, cliquer dessus
  - Résultat attendu : le produit apparaît dans le panier avec quantité 1, le total TTC est correct

- [ ] **[Nominal] Ajout d'un produit avec variation (taille, couleur…)**
  - Prérequis : un produit avec au moins un groupe de variations
  - Étapes : cliquer sur le produit, un sélecteur de variation apparaît, choisir une variation
  - Résultat attendu : le produit + sa variation apparaissent dans le panier

- [ ] **[Limite] Ajout du même produit deux fois**
  - Étapes : cliquer deux fois sur le même produit (sans variation)
  - Résultat attendu : soit la quantité passe à 2 (regroupement), soit deux lignes distinctes — comportement cohérent

- [ ] **[Limite] Ajout d'un produit en rupture de stock**
  - Prérequis : un produit avec stock = 0
  - Étapes : tenter de l'ajouter au panier
  - Résultat attendu : message d'erreur ou produit désactivé dans la liste, pas d'ajout silencieux

### Modification du panier

- [ ] **[Nominal] Modification de quantité**
  - Étapes : augmenter et diminuer la quantité d'une ligne du panier
  - Résultat attendu : le total se recalcule correctement à chaque modification

- [ ] **[Limite] Quantité à 0 ou negative**
  - Étapes : tenter de passer la quantité à 0
  - Résultat attendu : la ligne est supprimée ou un minimum de 1 est imposé

- [ ] **[Nominal] Suppression d'un article**
  - Étapes : cliquer sur le bouton de suppression d'une ligne
  - Résultat attendu : la ligne disparaît, le total se recalcule

### Remises

- [ ] **[Nominal] Remise sur ligne en pourcentage**
  - Prérequis : article à 10,00 € TTC avec TVA 20%
  - Étapes : appliquer une remise de 10% sur la ligne
  - Résultat attendu : prix affiché = 9,00 €, HT recalculé correctement

- [ ] **[Nominal] Remise sur ligne en valeur fixe (€)**
  - Prérequis : article à 10,00 € TTC
  - Étapes : appliquer une remise de 2,00 € sur la ligne
  - Résultat attendu : prix affiché = 8,00 €, HT recalculé correctement

- [ ] **[Nominal] Remise globale en pourcentage**
  - Prérequis : panier avec 2 articles à 10,00 € (total : 20,00 €)
  - Étapes : appliquer une remise globale de 10%
  - Résultat attendu : total = 18,00 €, la remise est distribuée proportionnellement sur les lignes
  - ⚠️ Note : vérifier que `sum(remises lignes)` = remise globale (LRM garantit un écart max d'1 centime)

- [ ] **[Nominal] Remise globale en valeur fixe (€)**
  - Prérequis : panier avec 3 articles à 10,00 € (total : 30,00 €)
  - Étapes : appliquer une remise globale de 3,00 €
  - Résultat attendu : total = 27,00 €

- [ ] **[Limite] Remise supérieure au total**
  - Étapes : tenter une remise de 50% puis en valeur supérieure au total
  - Résultat attendu : comportement cohérent (bloqué ou cappé à 100%)

### Client et vendeur

- [ ] **[Nominal] Sélection d'un client existant**
  - Étapes : cliquer sur "Ajouter un client", chercher par nom ou créer depuis la caisse
  - Résultat attendu : le client apparaît dans le résumé de la vente

- [ ] **[Nominal] Suppression du client sélectionné**
  - Étapes : retirer le client du panier
  - Résultat attendu : aucun client rattaché à la vente

- [ ] **[Nominal] Changement de vendeur**
  - Étapes : modifier le vendeur actif
  - Résultat attendu : le nouveau vendeur est associé à la vente

### Paiements

- [ ] **[Nominal] Paiement intégral en espèces**
  - Prérequis : panier avec un article à 15,00 €
  - Étapes : sélectionner mode paiement "Espèces", saisir 15,00 €, valider
  - Résultat attendu : vente validée, ticket affiché ou confirmé, panier vidé

- [ ] **[Nominal] Paiement intégral par carte**
  - Prérequis : panier avec un article à 25,00 €
  - Étapes : sélectionner mode paiement "Carte", valider
  - Résultat attendu : vente validée, panier vidé

- [ ] **[Nominal] Paiement mixte (espèces + carte)**
  - Prérequis : panier à 30,00 €
  - Étapes : saisir 20,00 € en espèces + 10,00 € par carte, valider
  - Résultat attendu : total des paiements = 30,00 €, vente validée

- [ ] **[Limite] Paiement partiel (montant inférieur au total)**
  - Étapes : saisir un montant inférieur au total, tenter de valider
  - Résultat attendu : le bouton de validation est désactivé ou un message d'erreur apparaît

- [ ] **[Calculs] Vérification des totaux avec valeurs précises**
  - Prérequis : article "Test A" à 10,00 € TTC avec TVA 20%
  - Étapes : ajouter 3 exemplaires, ne pas appliquer de remise
  - Résultat attendu :
    - Total TTC = **30,00 €** (pas 30,0000000004 €)
    - Total HT = **25,00 €**
    - Total TVA = **5,00 €**
    - HT + TVA = TTC : 25,00 + 5,00 = 30,00 ✓

- [ ] **[Calculs] Vérification avec TVA 5,5%**
  - Prérequis : article à 10,00 € TTC avec TVA 5,5%
  - Étapes : ajouter 1 exemplaire
  - Résultat attendu :
    - Total TTC = **10,00 €**
    - Total HT = **9,48 €** (arrondi acceptable : 9,47 à 9,49 €)
    - Total TVA = **0,52 €** (arrondi acceptable)

### Validation de vente

- [ ] **[Nominal] Validation d'une vente complète**
  - Prérequis : panier avec au moins 1 article, vendeur sélectionné, mode de paiement saisi
  - Étapes : cliquer "Valider la vente"
  - Résultat attendu :
    - Vente confirmée (modal ou toast de succès)
    - Panier vidé automatiquement
    - Un numéro de ticket est généré (format `YYYYMMDD-E01-R01-NNNNNN`)
    - La vente apparaît dans la synthèse du jour

- [ ] **[Nominal] Vérification que le stock décrémente après vente**
  - Prérequis : noter le stock d'un produit avant la vente
  - Étapes : vendre 2 unités de ce produit
  - Résultat attendu : le stock du produit a diminué de 2 (vérifier dans la page Stocks ou en ajoutant à nouveau le produit au panier)

- [ ] **[Erreur] Tentative de vente avec stock insuffisant**
  - Prérequis : produit avec stock = 1
  - Étapes : ajouter 2 unités au panier, tenter de valider
  - Résultat attendu : message d'erreur clair "Stock insuffisant" (validation côté serveur), pas de vente créée

### Panier suspendu

- [ ] **[Nominal] Suspendre un panier et le récupérer**
  - Prérequis : panier avec 2-3 articles
  - Étapes : utiliser la fonction "Suspendre" (pendingCart), vider le panier ou démarrer une nouvelle vente, puis récupérer le panier suspendu
  - Résultat attendu : le panier retrouvé contient exactement les mêmes articles qu'avant la suspension

- [ ] **[Limite] Un seul panier suspendu possible**
  - Étapes : suspendre un premier panier, en préparer un second, tenter de suspendre à nouveau
  - Résultat attendu : comportement cohérent (écrasement ou blocage) — pas de perte silencieuse de données

---

## 03 — Clôtures de caisse

> ⏱ Durée estimée : 20-25 min

> ⚠️ **Zones à risque connues**
> - La clôture est une opération irréversible dans le flux NF525. Une fois clôturée, la journée ne peut pas être rouverte.
> - Les totaux de clôture sont calculés en centimes entiers (correction P2) — vérifier la cohérence HT + TVA = TTC.
> - Si `checkDayClosure` retourne `true`, la caisse ne devrait plus accepter de nouvelles ventes pour ce jour.

### Vérification de clôture

- [ ] **[Nominal] Vérification que la caisse n'est pas encore clôturée (début de journée)**
  - Étapes : ouvrir la caisse, observer si un avertissement "journée clôturée" apparaît
  - Résultat attendu : pas d'avertissement, la caisse est opérationnelle

- [ ] **[Nominal] Comportement si la journée est déjà clôturée**
  - Prérequis : effectuer une clôture de caisse
  - Étapes : tenter de revenir à la caisse et d'ajouter des articles
  - Résultat attendu : avertissement visible que la journée est clôturée, vente bloquée (ou avertissement avant validation)

### Clôture de caisse

- [ ] **[Nominal] Clôture de caisse en fin de journée**
  - Prérequis : au moins 1 vente dans la journée en cours
  - Étapes : aller dans la page des clôtures, déclencher la clôture du jour
  - Résultat attendu :
    - La clôture est créée avec les totaux corrects
    - Un hash de clôture est généré
    - La clôture apparaît dans la liste historique

- [ ] **[Calculs] Vérification des totaux de clôture**
  - Prérequis : avoir vendu exactement 3 articles à 10,00 € TTC (TVA 20%)
  - Résultat attendu dans la clôture :
    - Total TTC = **30,00 €**
    - Total HT = **25,00 €**
    - Total TVA = **5,00 €**
    - HT + TVA = TTC : vérifier que la somme est exacte à 1 centime près

- [ ] **[Limite] Clôture d'une journée sans ventes**
  - Étapes : effectuer une clôture un jour sans aucune vente
  - Résultat attendu : clôture créée avec tous les totaux à 0,00 €, pas d'erreur

### Historique des clôtures

- [ ] La liste des clôtures passées s'affiche correctement
- [ ] Chaque clôture affiche : date, établissement, caisse, totaux, hash
- [ ] **[Sécurité] Le hash de clôture est différent d'une clôture à l'autre** (même si les montants sont identiques — les dates diffèrent)

---

## 04 — NF525 / Conformité fiscale

> ⏱ Durée estimée : 20-30 min

> ⚠️ **Zones à risque connues**
> - Le chaînage NF525 est la garantie d'intégrité fiscale. Une rupture de chaîne peut indiquer une modification frauduleuse ou un bug.
> - Le hash est calculé sur des montants `.toFixed(2)` (correction P4). Les valeurs affichées et hashées sont cohérentes.
> - `verifyTicketChain` suppose que les tickets sont dans l'ordre chronologique. Un tri incorrect donnerait une fausse alerte de rupture.
> - La fonction ne vérifie pas que `ticket[0].previousHash === null` — anomalie documentée, non critique.

### Numéro de ticket

- [ ] **[Nominal] Vérification du format du numéro de ticket après une vente**
  - Prérequis : effectuer une vente complète
  - Résultat attendu : le numéro de ticket suit le format `YYYYMMDD-E01-R01-NNNNNN`
    - `YYYYMMDD` = date du jour (ex: `20260316`)
    - `E01` = identifiant établissement (2 chiffres, zéro-padded)
    - `R01` = identifiant caisse (2 chiffres, zéro-padded)
    - `NNNNNN` = séquence (6 chiffres, zéro-padded)

- [ ] **[Nominal] Incrément du numéro de séquence**
  - Prérequis : noter le numéro de la dernière vente
  - Étapes : effectuer une nouvelle vente
  - Résultat attendu : le numéro de séquence a bien augmenté de 1

### Chaîne de hash (page Synthèse ou Archives)

- [ ] **[Nominal] Vérification de la chaîne de tickets du jour**
  - Prérequis : au moins 3 ventes dans la journée
  - Étapes : aller dans la page Synthèse, déclencher la vérification de chaîne (si disponible dans l'UI)
  - Résultat attendu : la chaîne est valide, aucune rupture signalée

- [ ] **[Nominal] Le hash du premier ticket est différent des suivants**
  - Résultat attendu : le premier ticket a `previousHash = null` (ou "FIRST_TICKET"), les suivants référencent le hash du précédent

- [ ] **[Sécurité] Unicité des hash entre ventes différentes**
  - Prérequis : deux ventes avec des montants identiques mais des dates différentes
  - Résultat attendu : leurs hash sont différents (la date est incluse dans le hash)

### Tentative d'annulation

- [ ] **[Nominal] Annulation d'une vente depuis la page Synthèse**
  - Prérequis : au moins 1 vente dans la journée en cours
  - Étapes : aller dans Synthèse, trouver la vente, cliquer "Annuler"
  - Résultat attendu :
    - La vente est marquée comme annulée
    - Elle reste visible (la conformité NF525 interdit la suppression physique)
    - Le stock est recréé si applicable

- [ ] **[NF525] La chaîne de hash reste valide après une annulation**
  - Prérequis : annuler une vente puis effectuer une nouvelle vente
  - Résultat attendu : la vérification de chaîne reste valide (le ticket annulé est conservé dans la chaîne, pas supprimé)

---

## 05 — Produits

> ⏱ Durée estimée : 25-35 min

### Liste des produits

- [ ] La liste des produits s'affiche au chargement de la page `/produits`
- [ ] La liste indique le stock disponible pour chaque produit
- [ ] Les produits en rupture de stock sont visibles (distinction visuelle si implémentée)

### Recherche et filtres

- [ ] **[Nominal] Recherche par nom de produit**
  - Étapes : saisir les premières lettres d'un produit dans le champ de recherche
  - Résultat attendu : la liste se filtre en temps réel ou à la validation

- [ ] **[Nominal] Filtrage par catégorie**
  - Prérequis : au moins 2 catégories avec des produits
  - Étapes : sélectionner une catégorie dans le filtre
  - Résultat attendu : seuls les produits de cette catégorie sont affichés

- [ ] **[Nominal] Filtrage par marque**
  - Étapes : sélectionner une marque dans le filtre
  - Résultat attendu : liste filtrée correctement

- [ ] **[Nominal] Filtrage par fournisseur**
  - Étapes : sélectionner un fournisseur
  - Résultat attendu : liste filtrée correctement

- [ ] **[Limite] Recherche sans résultat**
  - Étapes : chercher un texte qui ne correspond à aucun produit
  - Résultat attendu : message "Aucun résultat" ou liste vide, pas d'erreur

### Création de produit

- [ ] **[Nominal] Création d'un produit simple**
  - Étapes : aller sur `/produits/create`, remplir les champs obligatoires (nom, prix, TVA), sauvegarder
  - Résultat attendu : le produit apparaît dans la liste, avec les bons prix HT/TTC

- [ ] **[Calculs] Vérification de la conversion HT ↔ TTC**
  - Étapes : saisir un prix TTC de 10,00 € avec TVA 20%
  - Résultat attendu : le prix HT calculé affiché = **8,33 €** (arrondi à 2 décimales)

- [ ] **[Nominal] Création d'un produit avec variations**
  - Prérequis : au moins un groupe de variations existant (ex : Taille : S/M/L)
  - Étapes : créer un produit, associer un groupe de variations
  - Résultat attendu : le produit est créé avec ses variations, chaque variation est sélectionnable à la caisse

- [ ] **[Nominal] Création rapide d'un fournisseur depuis le formulaire produit**
  - Étapes : dans le formulaire produit, utiliser le champ fournisseur pour créer un nouveau fournisseur inline
  - Résultat attendu : le fournisseur est créé et sélectionné sans quitter le formulaire

- [ ] **[Nominal] Création rapide d'une marque depuis le formulaire produit**
  - Étapes : créer une nouvelle marque inline dans le formulaire
  - Résultat attendu : idem

- [ ] **[Nominal] Création rapide d'une catégorie depuis le formulaire produit**
  - Étapes : créer une nouvelle catégorie inline dans le formulaire
  - Résultat attendu : idem

- [ ] **[Limite] Création avec champs obligatoires manquants**
  - Étapes : tenter de sauvegarder sans nom ou sans prix
  - Résultat attendu : validation côté client, erreurs affichées sur les champs manquants

### Édition de produit

- [ ] **[Nominal] Édition d'un produit existant**
  - Étapes : aller sur `/produits/[id]/edit`, modifier le prix, sauvegarder
  - Résultat attendu : le changement est visible immédiatement dans la liste

- [ ] **[Nominal] Ajout d'un code-barres**
  - Étapes : éditer un produit, renseigner un code-barres
  - Résultat attendu : le code-barres est sauvegardé

- [ ] **[Nominal] Consultation de l'historique de stock depuis la fiche produit**
  - Étapes : aller sur la fiche d'un produit, trouver la section historique de stock
  - Résultat attendu : la liste des mouvements passés s'affiche correctement

---

## 06 — Clients

> ⏱ Durée estimée : 20-25 min

### Liste et recherche

- [ ] La liste des clients s'affiche sur `/clients`
- [ ] La recherche par nom fonctionne
- [ ] La recherche par email fonctionne (si disponible)

### Création de client

- [ ] **[Nominal] Création d'un client avec auto-complétion de la ville via code postal**
  - Étapes : aller sur la page de création client, saisir un code postal français à 5 chiffres (ex: `75001`), attendre la suggestion de ville
  - Résultat attendu : une ou plusieurs villes sont proposées pour ce code postal, la sélection remplit automatiquement le champ ville
  - ⚠️ Note : appel vers `geo.api.gouv.fr` — peut échouer si hors ligne

- [ ] **[Limite] Code postal invalide (moins de 5 chiffres)**
  - Étapes : saisir `750` dans le code postal
  - Résultat attendu : pas d'appel API envoyé, pas de suggestion

- [ ] **[Nominal] Création d'un client avec RGPD non consenti**
  - Étapes : créer un client en laissant la case RGPD décochée
  - Résultat attendu : le client est créé sans données personnelles enregistrées ou avec un avertissement adapté

- [ ] **[Nominal] Création d'un client avec tous les champs**
  - Étapes : remplir nom, prénom, email, téléphone, adresse complète (rue, CP, ville)
  - Résultat attendu : client créé avec toutes les informations

- [ ] **[Limite] Création avec email déjà utilisé**
  - Étapes : créer un second client avec le même email qu'un existant (si la contrainte d'unicité existe)
  - Résultat attendu : erreur claire, pas de doublon

### Édition de client

- [ ] **[Nominal] Édition d'un client existant**
  - Étapes : aller sur `/clients/[id]/edit`, modifier le numéro de téléphone, sauvegarder
  - Résultat attendu : la modification est visible dans la fiche

- [ ] **[Nominal] Consultation de l'historique d'achats depuis la fiche client**
  - Prérequis : client ayant au moins 1 achat enregistré
  - Étapes : aller sur la fiche client, trouver la section "Historique d'achats"
  - Résultat attendu : la liste des ventes du client s'affiche avec les montants et dates

- [ ] **[Limite] Historique d'achats pour un nouveau client**
  - Étapes : ouvrir la fiche d'un client sans achat
  - Résultat attendu : message "Aucun achat" ou liste vide, pas d'erreur

### Création de client depuis la caisse

- [ ] **[Nominal] Ajout d'un nouveau client directement depuis la caisse**
  - Étapes : à la caisse, cliquer "Ajouter un client", puis "Créer un nouveau client"
  - Résultat attendu : formulaire de création inline, le client est créé et sélectionné dans la vente en cours

---

## 07 — Stock / Mouvements

> ⏱ Durée estimée : 25-30 min

> ⚠️ **Zones à risque connues**
> - Les mouvements de stock sont créés de manière atomique via `createMovement.ts`. Un mouvement créé ne peut pas être supprimé (audit trail).
> - La recherche produit dans les mouvements utilise `useMovementProductSearch` — vérifier que les suggestions fonctionnent correctement.

### Liste des mouvements

- [ ] La liste des mouvements s'affiche sur `/mouvements`
- [ ] Les mouvements récents apparaissent en tête de liste
- [ ] Chaque mouvement indique : type, produit, quantité, date, établissement

### Recherche et filtres

- [ ] **[Nominal] Recherche de produit dans le catalogue de mouvements**
  - Étapes : saisir les premières lettres d'un produit dans le champ de recherche
  - Résultat attendu : suggestions affichées, le produit est sélectionnable

- [ ] **[Nominal] Filtrage du catalogue par catégorie**
  - Étapes : sélectionner une catégorie dans les filtres du catalogue
  - Résultat attendu : seuls les produits de cette catégorie sont affichés comme cibles de mouvement

- [ ] **[Nominal] Filtrage du catalogue par marque**
  - Étapes : filtrer par marque
  - Résultat attendu : liste filtrée correctement

### Entrée de stock

- [ ] **[Nominal] Réception de stock (entrée)**
  - Prérequis : choisir un produit avec un stock connu
  - Étapes : créer un mouvement de type "Entrée" (réception) pour 5 unités de ce produit
  - Résultat attendu :
    - Le mouvement apparaît dans la liste des mouvements
    - Le stock du produit a augmenté de 5 (vérifier dans `/stocks` ou la fiche produit)

- [ ] **[Calculs] Vérification que le stock est la somme des mouvements**
  - Prérequis : noter le stock initial d'un produit
  - Étapes : créer une entrée de +10, puis une perte de -2
  - Résultat attendu : stock final = stock initial + 10 - 2

### Ajustement et perte

- [ ] **[Nominal] Ajustement de stock**
  - Étapes : créer un mouvement de type "Ajustement" (correction d'inventaire)
  - Résultat attendu : le stock est mis à jour avec la valeur ajustée

- [ ] **[Nominal] Perte de stock**
  - Étapes : créer un mouvement de type "Perte"
  - Résultat attendu : le stock diminue de la quantité perdue, le mouvement est tracé

- [ ] **[Limite] Perte supérieure au stock disponible**
  - Étapes : tenter de créer une perte de 100 unités pour un produit en ayant seulement 5
  - Résultat attendu : erreur ou avertissement, le stock ne passe pas en négatif (selon la règle métier)

### Historique

- [ ] **[Nominal] Le mouvement créé apparaît dans la liste**
  - Résultat attendu : le mouvement est immédiatement visible après création, sans rechargement manuel

### Vue des stocks

- [ ] La page `/stocks` affiche le stock actuel de tous les produits
- [ ] Les produits en rupture sont identifiables
- [ ] Les produits en stock faible (si seuil configuré) sont identifiables

---

## 08 — Synthèse / Reporting

> ⏱ Durée estimée : 20-25 min

> ⚠️ **Zones à risque connues**
> - La page Synthèse affiche les ventes du jour et permet l'annulation. L'annulation est irréversible et déclenche un mouvement de stock inverse.
> - La vérification de chaîne NF525 est accessible depuis cette page.

### Vue journalière

- [ ] **[Nominal] Consultation du résumé journalier**
  - Prérequis : au moins 1 vente dans la journée en cours
  - Étapes : aller sur `/synthese`
  - Résultat attendu : les ventes du jour sont listées avec montants corrects

- [ ] **[Nominal] Filtrage par date**
  - Étapes : sélectionner une date passée pour laquelle des ventes existent
  - Résultat attendu : les ventes de ce jour s'affichent

- [ ] **[Limite] Jour sans ventes**
  - Étapes : sélectionner un jour sans ventes
  - Résultat attendu : liste vide avec message approprié, totaux à 0,00 €

### Totaux affichés

- [ ] **[Calculs] Vérification des totaux de synthèse**
  - Prérequis : avoir vendu 2 articles à 10,00 € TTC (TVA 20%) dans la journée
  - Résultat attendu :
    - Total TTC journée = **20,00 €**
    - Total HT journée = **16,67 €** (arrondi acceptable)
    - Total TVA journée = **3,33 €** (arrondi acceptable)

- [ ] **[Nominal] Totaux par mode de paiement**
  - Prérequis : avoir des ventes en espèces et en carte
  - Résultat attendu : les totaux espèces et carte sont corrects et sommés

### Annulation de vente

- [ ] **[Nominal] Annulation d'une vente depuis la synthèse**
  - Prérequis : une vente du jour non encore annulée
  - Étapes : cliquer sur "Annuler" sur la vente concernée, confirmer
  - Résultat attendu :
    - La vente est marquée "Annulée" dans la liste
    - Les totaux du jour se recalculent (la vente annulée est exclue)
    - Le stock du produit vendu est remis à jour

- [ ] **[NF525] La vente annulée reste visible dans la liste (pas de suppression physique)**
  - Résultat attendu : la vente apparaît avec le statut "Annulée", pas disparue

---

## 09 — Établissements

> ⏱ Durée estimée : 20-25 min

### Liste des établissements

- [ ] La liste des établissements s'affiche sur `/etablissements`
- [ ] Chaque établissement montre : nom, état (actif/inactif), nombre de caisses

### CRUD établissements

- [ ] **[Nominal] Création d'un établissement**
  - Étapes : cliquer "Nouvel établissement", remplir le nom et les informations, sauvegarder
  - Résultat attendu : l'établissement apparaît dans la liste

- [ ] **[Nominal] Activation d'un établissement inactif**
  - Étapes : basculer l'état d'un établissement de "inactif" à "actif"
  - Résultat attendu : l'état est mis à jour immédiatement

- [ ] **[Nominal] Désactivation d'un établissement actif**
  - Étapes : basculer l'état de "actif" à "inactif"
  - Résultat attendu : idem

- [ ] **[Nominal] Édition d'un établissement existant**
  - Étapes : modifier le nom ou l'adresse d'un établissement
  - Résultat attendu : les modifications sont sauvegardées

### Caisses enregistreuses

- [ ] **[Nominal] Création d'une caisse enregistreuse**
  - Prérequis : être sur la fiche d'un établissement
  - Étapes : cliquer "Ajouter une caisse", remplir le nom, sauvegarder
  - Résultat attendu : la caisse apparaît dans la liste des caisses de l'établissement

- [ ] **[Nominal] Association caisse ↔ établissement**
  - Résultat attendu : la caisse est sélectionnable à la page caisse dans le sélecteur

- [ ] **[Limite] Création de caisse sans nom**
  - Étapes : tenter de créer une caisse sans saisir de nom
  - Résultat attendu : erreur de validation, pas de création

---

## 10 — Synchronisation multi-établissements

> ⏱ Durée estimée : 25-35 min

> ⚠️ **Zones à risque connues**
> - La resync complète est une opération longue et potentiellement destructive. Ne pas la déclencher en production sans sauvegarde.
> - Les N+1 dans sync.ts ont été corrigés (audit 03) : `syncProductToGroup` passe de 39 à 6 requêtes pour 3 groupes × 4 établissements.
> - `verifyTicketChain` suppose les tickets ordonnés chronologiquement — l'appelant doit garantir l'ordre.

### Groupes de synchronisation

- [ ] La liste des groupes de sync s'affiche sur `/etablissements/synchronisation`
- [ ] **[Nominal] Création d'un groupe de synchronisation**
  - Étapes : cliquer "Nouveau groupe", nommer le groupe, sauvegarder
  - Résultat attendu : le groupe apparaît dans la liste

- [ ] **[Nominal] Ajout d'établissements à un groupe**
  - Étapes : sélectionner des établissements à inclure dans le groupe
  - Résultat attendu : les établissements sont associés au groupe

- [ ] **[Nominal] Configuration des règles de synchronisation (champs à synchroniser)**
  - Étapes : configurer quels champs sont synchronisés (prix, stock, description…)
  - Résultat attendu : les règles sont sauvegardées

### Test de synchronisation

- [ ] **[Nominal] Modification d'un produit déclenche une sync vers le groupe**
  - Prérequis : un produit membre d'un groupe de sync avec 2+ établissements
  - Étapes : modifier le prix d'un produit dans l'établissement source
  - Résultat attendu : le prix est mis à jour dans les établissements cibles (vérifier dans le groupe)

- [ ] **[Nominal] Consultation des logs de synchronisation**
  - Étapes : regarder les logs de sync après une modification de produit
  - Résultat attendu : les logs indiquent les établissements synchronisés, la date, le champ modifié

- [ ] **[Nominal] Déclenchement d'une resync manuelle**
  - ⚠️ **NE PAS FAIRE EN PRODUCTION avec de vraies données** — à tester en environnement de dev/staging uniquement
  - Étapes : déclencher une resync complète sur un petit groupe de sync
  - Résultat attendu : la resync s'exécute, les logs indiquent la progression, le résultat est cohérent

---

## 11 — Vendeurs

> ⏱ Durée estimée : 15-20 min

### Liste des vendeurs

- [ ] La liste des vendeurs s'affiche sur `/vendeurs`

### CRUD vendeurs

- [ ] **[Nominal] Création d'un vendeur**
  - Étapes : aller sur la page de création, remplir le nom, associer des établissements, sauvegarder
  - Résultat attendu : le vendeur apparaît dans la liste

- [ ] **[Nominal] Édition d'un vendeur existant**
  - Étapes : modifier le nom ou les établissements associés
  - Résultat attendu : modifications sauvegardées

### Vendeur à la caisse

- [ ] **[Nominal] Sélection d'un vendeur à la caisse**
  - Étapes : aller à la caisse, sélectionner un vendeur dans le sélecteur
  - Résultat attendu : le vendeur sélectionné est associé aux ventes suivantes (visible dans la synthèse)

- [ ] **[Nominal] Persistance du vendeur sélectionné après rechargement**
  - Prérequis : sélectionner un vendeur à la caisse
  - Étapes : recharger la page
  - Résultat attendu : le même vendeur est encore sélectionné (persistance localStorage)

- [ ] **[Nominal] Déconnexion / changement de vendeur**
  - Étapes : changer de vendeur sélectionné
  - Résultat attendu : le nouveau vendeur est actif pour les ventes suivantes

- [ ] **[Nominal] Vendeur effacé à la déconnexion de l'utilisateur**
  - Étapes : se déconnecter de l'application
  - Résultat attendu : le vendeur sélectionné est réinitialisé (clearSeller au signOut)

---

## 12 — TVA

> ⏱ Durée estimée : 10-15 min

### CRUD taux de TVA

- [ ] La liste des taux de TVA s'affiche sur `/tva`
- [ ] **[Nominal] Création d'un taux de TVA**
  - Étapes : créer un taux "5,5%" avec le label approprié
  - Résultat attendu : le taux apparaît dans la liste et est disponible lors de la création d'un produit

- [ ] **[Nominal] Association d'un taux de TVA à un produit**
  - Étapes : éditer un produit, changer son taux de TVA, sauvegarder
  - Résultat attendu : le prix HT se recalcule en fonction du nouveau taux

- [ ] **[Calculs] Vérification prix HT après changement de TVA**
  - Étapes : produit à 10,00 € TTC, passer de TVA 20% à TVA 5,5%
  - Résultat attendu :
    - Avant (TVA 20%) : HT = **8,33 €**
    - Après (TVA 5,5%) : HT = **9,48 €**

- [ ] **[Limite] Suppression d'un taux de TVA utilisé par des produits**
  - Étapes : tenter de supprimer un taux de TVA qui est assigné à au moins 1 produit
  - Résultat attendu : erreur ou avertissement, pas de suppression forcée

---

## 13 — Variations

> ⏱ Durée estimée : 15-20 min

### Groupes de variations

- [ ] La liste des groupes de variations s'affiche sur `/variations`
- [ ] **[Nominal] Création d'un groupe de variations**
  - Étapes : créer un groupe nommé "Taille" avec les valeurs S, M, L
  - Résultat attendu : le groupe apparaît dans la liste avec ses valeurs

- [ ] **[Nominal] Ajout de valeurs à un groupe existant**
  - Étapes : éditer un groupe, ajouter une valeur "XL"
  - Résultat attendu : la valeur est disponible lors de l'association à un produit

- [ ] **[Nominal] Association d'un groupe de variations à un produit**
  - Étapes : éditer un produit, ajouter le groupe "Taille"
  - Résultat attendu : le produit a maintenant des variations sélectionnables à la caisse

- [ ] **[Nominal] Sélection de variation à la caisse**
  - Prérequis : produit avec variations associées
  - Étapes : ajouter ce produit au panier depuis la caisse
  - Résultat attendu : un sélecteur de variation apparaît, la variation choisie est visible dans la ligne panier

- [ ] **[Limite] Suppression d'un groupe de variations utilisé par des produits**
  - Étapes : tenter de supprimer un groupe de variations lié à des produits
  - Résultat attendu : erreur ou avertissement

---

## 14 — Catégories

> ⏱ Durée estimée : 10 min

- [ ] La liste des catégories s'affiche sur `/categories`
- [ ] **[Nominal] Création d'une catégorie**
  - Étapes : créer une catégorie "Boissons"
  - Résultat attendu : la catégorie apparaît dans la liste et dans les filtres produits

- [ ] **[Nominal] Création d'une sous-catégorie**
  - Étapes : créer "Boissons chaudes" comme enfant de "Boissons" (si la hiérarchie est supportée)
  - Résultat attendu : la sous-catégorie est visible dans l'arbre des catégories

- [ ] **[Nominal] Édition d'une catégorie**
  - Étapes : renommer une catégorie existante
  - Résultat attendu : le nouveau nom est visible partout où la catégorie est référencée

- [ ] **[Nominal] Suppression d'une catégorie vide**
  - Étapes : supprimer une catégorie sans produits associés
  - Résultat attendu : suppression réussie

- [ ] **[Limite] Suppression d'une catégorie avec produits**
  - Étapes : tenter de supprimer une catégorie ayant des produits
  - Résultat attendu : erreur ou demande de confirmation avec avertissement

---

## 15 — Marques

> ⏱ Durée estimée : 10 min

- [ ] La liste des marques est accessible
- [ ] **[Nominal] Création d'une marque**
  - Étapes : créer une marque "Nike"
  - Résultat attendu : disponible dans les filtres produits et dans le formulaire produit

- [ ] **[Nominal] Édition d'une marque**
- [ ] **[Nominal] Suppression d'une marque non utilisée**
- [ ] **[Limite] Suppression d'une marque utilisée par des produits**
  - Résultat attendu : erreur ou avertissement

---

## 16 — Fournisseurs

> ⏱ Durée estimée : 10 min

- [ ] La liste des fournisseurs est accessible
- [ ] **[Nominal] Création d'un fournisseur**
  - Étapes : créer un fournisseur avec nom et contact
  - Résultat attendu : disponible dans le formulaire produit

- [ ] **[Nominal] Édition d'un fournisseur**
- [ ] **[Nominal] Suppression d'un fournisseur non utilisé**
- [ ] **[Limite] Suppression d'un fournisseur lié à des produits**
  - Résultat attendu : erreur ou avertissement

---

## 17 — Dashboard

> ⏱ Durée estimée : 5-10 min

- [ ] Le tableau de bord s'affiche sur `/dashboard`
- [ ] Les indicateurs clés (chiffre du jour, nombre de ventes, alertes stock) s'affichent correctement
- [ ] Les alertes de rupture de stock listent les produits en stock = 0
- [ ] Les alertes de stock faible listent les produits sous le seuil configuré
- [ ] Les données changent après une vente (soit en temps réel, soit après rechargement)

---

## 🔁 Régression rapide (après chaque nouvelle feature)

> ⏱ Durée estimée : 20-30 min maximum
> Couvre les modules critiques avec les tests les plus représentatifs.

Exécuter ces tests dans l'ordre après toute modification du code :

### Auth (2 min)
- [ ] **R01** — Connexion avec identifiants valides → redirection vers dashboard
- [ ] **R02** — Rechargement de page → session restaurée, pas de redirect login

### Caisse (12 min)
- [ ] **R03** — Ajouter 1 produit simple au panier → il apparaît avec le bon prix
- [ ] **R04** — Ajouter 1 produit avec variation → la variation est visible dans la ligne panier
- [ ] **R05** — Modifier la quantité d'une ligne → le total se recalcule correctement
- [ ] **R06** — Appliquer une remise de 10% sur une ligne → prix correct affiché
- [ ] **R07** — **Validation d'une vente complète** (espèces) → vente créée, panier vidé, numéro de ticket généré au format `YYYYMMDD-E01-R01-NNNNNN`
- [ ] **R08** — Vérifier que le stock a décrémenté après la vente R07

### Calculs financiers (5 min)
- [ ] **R09** — Vendre 3 × 10,00 € TTC (TVA 20%) → Total TTC = **30,00 €**, HT = **25,00 €**, TVA = **5,00 €** (pas de décimales parasites)
- [ ] **R10** — Vendre avec remise globale de 5,00 € sur un panier à 30,00 € → Total = **25,00 €**, distribution correcte sur les lignes

### NF525 (3 min)
- [ ] **R11** — Le numéro de ticket de la vente R07 suit le format `YYYYMMDD-EXX-RXX-NNNNNN`
- [ ] **R12** — La vente R07 apparaît dans la page Synthèse avec le bon montant

### Stock (3 min)
- [ ] **R13** — Créer un mouvement d'entrée de +5 unités sur un produit → le stock augmente de 5
- [ ] **R14** — Tenter de vendre plus que le stock disponible → message d'erreur "Stock insuffisant"

### Clôture (5 min)
- [ ] **R15** — La page Clôtures s'affiche sans erreur
- [ ] **R16** — Après au moins 1 vente du jour, effectuer une clôture → les totaux de clôture correspondent aux ventes effectuées, un hash est généré

---

*Dernière mise à jour : 2026-03-16 — par Claude Code*
*Basé sur les audits : 01-cartographie, 03-supabase-fetch, 04-dead-code, 07-calculs-financiers, 08-nf525-tests, 09-stores-pinia*
