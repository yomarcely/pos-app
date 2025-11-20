# 🏗️ Architecture Backend - Point de Vente

## 📋 Vue d'ensemble

Ce backend est conçu pour être **conforme NF525** (certification anti-fraude TVA) et **RGPD**, avec un système de **synchronisation hybride** (local + cloud).

---

## 🔒 Conformité NF525

### Exigences respectées

✅ **Inaltérabilité** : Chaînage cryptographique SHA-256 des tickets
✅ **Sécurisation** : Hash et signature INFOCERT de chaque vente
✅ **Conservation** : Archivage automatique pendant 6 ans minimum
✅ **Traçabilité** : Logs d'audit complets (qui, quoi, quand)

### Chaînage cryptographique

Chaque ticket de caisse est chaîné au précédent via SHA-256 :

```
Ticket N-1 (hash: ABC123)
    ↓
Ticket N (previousHash: ABC123, currentHash: DEF456)
    ↓
Ticket N+1 (previousHash: DEF456, currentHash: GHI789)
```

⚠️ **Important** : Si un ticket est modifié, toute la chaîne devient invalide (détection de fraude).

---

## 🛡️ Conformité RGPD

### Principes implémentés

- **Consentement explicite** : Enregistré en BDD avec horodatage
- **Minimisation des données** : Collecte uniquement des données nécessaires
- **Droit à l'oubli** : Fonction d'anonymisation des clients
- **Portabilité** : Export des données client en JSON
- **Sécurité** : Chiffrement recommandé pour données sensibles

### Tables concernées

- `customers` : Contient `gdprConsent`, `gdprConsentDate`, `isAnonymized`
- `audit_logs` : Trace toutes les actions RGPD (anonymisation, export, etc.)

---

## 🗄️ Structure de la base de données

### Tables principales

1. **sales** : Ventes avec hash NF525 et signature INFOCERT
2. **sale_items** : Lignes de vente (produits vendus)
3. **products** : Catalogue produits avec gestion stock
4. **customers** : Clients avec consentement RGPD
5. **sellers** : Vendeurs/Caissiers
6. **stock_movements** : Historique mouvements de stock (audit)
7. **audit_logs** : Logs de toutes les actions (NF525 + RGPD)
8. **archives** : Métadonnées des archives périodiques
9. **sync_queue** : File d'attente pour synchronisation cloud

### Relations

```
sales (1) ←→ (N) sale_items
sales (N) ←→ (1) customers
sales (N) ←→ (1) sellers
sales (1) ←→ (N) stock_movements
```

---

## 🌐 Architecture Hybride (Local + Cloud)

### Mode Offline (Local)

- PostgreSQL installé localement sur le PC du magasin
- Toutes les ventes sont enregistrées en local
- **Avantage** : Fonctionne sans Internet
- **Inconvénient** : Pas de backup automatique

### Mode Online (Cloud)

- PostgreSQL hébergé sur un serveur distant
- Synchronisation en temps réel
- **Avantage** : Backup automatique, accès multi-magasins
- **Inconvénient** : Nécessite une connexion Internet stable

### Mode Hybride (Recommandé)

- PostgreSQL local + synchronisation périodique vers le cloud
- En cas de perte de connexion, l'application continue de fonctionner
- Dès le retour d'Internet, les données sont synchronisées

#### Configuration

```env
# Local
DB_HOST=localhost
DB_PORT=5432

# Cloud
SYNC_ENABLED=true
SYNC_API_URL=https://api.votredomaine.com
SYNC_INTERVAL=300000  # 5 minutes
```

#### Table `sync_queue`

Toutes les opérations (ventes, modifications) sont ajoutées à cette table avec :
- `status`: `pending` → `synced` | `failed`
- `attempts`: Nombre de tentatives
- `lastError`: Erreur de synchronisation

---

## 🚀 Installation

### 1. Installer PostgreSQL

#### Windows
```bash
# Télécharger depuis https://www.postgresql.org/download/windows/
# Ou via Chocolatey
choco install postgresql
```

#### Mac
```bash
brew install postgresql
brew services start postgresql
```

#### Linux
```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Créer la base de données

```bash
# Se connecter à PostgreSQL
psql -U postgres

# Créer la base
CREATE DATABASE pos_app;

# Créer un utilisateur (optionnel)
CREATE USER pos_user WITH PASSWORD 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON DATABASE pos_app TO pos_user;
```

### 3. Configurer les variables d'environnement

```bash
# Copier le fichier d'exemple
cp .env.example .env

# Éditer les valeurs
nano .env
```

### 4. Générer et appliquer les migrations

```bash
# Générer les migrations Drizzle
pnpm drizzle-kit generate

# Appliquer les migrations
pnpm drizzle-kit migrate
```

### 5. (Optionnel) Seed la base avec des données de test

```bash
# TODO: Créer un script de seed
pnpm db:seed
```

---

## 📡 API Endpoints

### Ventes

#### `POST /api/sales/create`

Créer une nouvelle vente (conforme NF525).

**Corps de la requête :**
```json
{
  "items": [
    {
      "productId": 1,
      "productName": "Produit A",
      "quantity": 2,
      "unitPrice": 10.50,
      "variation": "noir",
      "discount": 0,
      "discountType": "%",
      "tva": 20
    }
  ],
  "seller": {
    "id": 1,
    "name": "Jean Dupont"
  },
  "customer": {
    "id": 5,
    "firstName": "Marie",
    "lastName": "Martin"
  },
  "payments": [
    {
      "mode": "Espèces",
      "amount": 21.00
    }
  ],
  "totals": {
    "totalHT": 17.50,
    "totalTVA": 3.50,
    "totalTTC": 21.00
  },
  "globalDiscount": {
    "value": 0,
    "type": "%"
  }
}
```

**Réponse :**
```json
{
  "success": true,
  "sale": {
    "id": 123,
    "ticketNumber": "20250120-000042",
    "saleDate": "2025-01-20T14:30:00Z",
    "totalTTC": "21.00",
    "hash": "abc123def456...",
    "signature": "INFOCERT_SIG_..."
  }
}
```

---

## 🔐 Certification INFOCERT

### Étapes pour la certification

1. **Contacter INFOCERT** : [infocert.fr](https://www.infocert.fr)
2. **Fournir les documents** :
   - SIRET de l'entreprise
   - Descriptif technique de l'application (ce README)
   - Schéma de base de données
   - Code source du chaînage cryptographique
3. **Audit technique** : INFOCERT vérifie la conformité NF525
4. **Obtenir la clé de signature** : Clé privée à mettre dans `.env`
5. **Certificat délivré** : Valide pour le contrôle fiscal

### Configuration post-certification

```env
INFOCERT_PRIVATE_KEY=<clé fournie par INFOCERT>
INFOCERT_MERCHANT_ID=<votre ID commerce>
```

---

## 📊 Archivage automatique (NF525)

### Fréquence

- **Quotidien** : Sauvegarde des ventes du jour
- **Mensuel** : Archive ZIP du mois
- **Annuel** : Archive globale de l'année

### Format des archives

```json
{
  "period": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2025-01-31T23:59:59Z"
  },
  "stats": {
    "salesCount": 1523,
    "totalAmount": 45670.50
  },
  "tickets": [
    {
      "ticketNumber": "20250101-000001",
      "saleDate": "2025-01-01T10:15:00Z",
      "totalTTC": 30.00,
      "hash": "abc123...",
      "signature": "INFOCERT_...",
      "previousHash": null
    }
  ],
  "archiveHash": "def456..."
}
```

### Localisation

```
./data/archives/
  ├── daily/
  │   ├── 2025-01-20.json.gz
  │   └── ...
  ├── monthly/
  │   ├── 2025-01.zip
  │   └── ...
  └── yearly/
      ├── 2025.zip
      └── ...
```

⚠️ **Conservation obligatoire** : 6 ans minimum (loi fiscale).

---

## 🛠️ Commandes utiles

```bash
# Démarrer le serveur de dev
pnpm dev

# Générer des migrations
pnpm drizzle-kit generate

# Appliquer les migrations
pnpm drizzle-kit migrate

# Ouvrir Drizzle Studio (interface graphique)
pnpm drizzle-kit studio

# Vérifier l'intégrité de la chaîne NF525
pnpm run verify-chain

# Créer une archive manuelle
pnpm run create-archive --period=monthly
```

---

## 🐛 Troubleshooting

### Erreur de connexion PostgreSQL

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution** : Vérifier que PostgreSQL est démarré
```bash
# Windows
pg_ctl status

# Mac/Linux
brew services list  # Mac
sudo systemctl status postgresql  # Linux
```

### Hash NF525 invalide

```
Error: Chain verification failed
```

**Solution** : Ne **JAMAIS** modifier manuellement une vente en BDD. Utiliser uniquement les API.

### Sync cloud échoue

```
Sync failed: Network error
```

**Solution** : Vérifier la configuration `SYNC_API_URL` et la connexion Internet.

---

## 📞 Support

- **Documentation Drizzle** : [orm.drizzle.team](https://orm.drizzle.team)
- **NF525** : [economie.gouv.fr/dgfip/professionnels](https://www.economie.gouv.fr/dgfip/professionnels/logiciels-de-caisse)
- **RGPD** : [cnil.fr](https://www.cnil.fr)
- **INFOCERT** : [infocert.fr](https://www.infocert.fr)

---

## 📝 TODO

- [ ] Implémenter le système de sync automatique
- [ ] Créer un script de seed pour les données de test
- [ ] Ajouter l'archivage automatique (cron job)
- [ ] Implémenter l'API d'export RGPD
- [ ] Ajouter l'authentification JWT pour les API
- [ ] Créer un dashboard d'administration
- [ ] Tests unitaires et d'intégration
- [ ] Documentation Swagger/OpenAPI
