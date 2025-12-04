# Configuration des Environnements - POS App

## Vue d'ensemble

L'application POS supporte 3 environnements distincts :
- **Development** : Développement local avec données de test
- **Staging** : Tests d'intégration et QA (réplique de production)
- **Production** : Environnement client avec données réelles

## Structure des fichiers

```
pos-app/
├── .env.example              # Template avec toutes les variables (à commiter)
├── .env.development          # Configuration développement (ignoré par git)
├── .env.staging              # Configuration staging (ignoré par git)
├── .env.production           # Configuration production (ignoré par git)
├── drizzle.config.ts         # Config Drizzle par défaut
├── drizzle.config.development.ts
├── drizzle.config.staging.ts
└── drizzle.config.production.ts
```

## Configuration initiale

### 1. Premier démarrage (Development)

```bash
# Copier le template
cp .env.example .env.development

# Éditer avec vos valeurs de développement
nano .env.development

# Lancer l'application
npm run dev
```

### 2. Configuration Staging

```bash
# Créer un projet Supabase séparé pour le staging
# Puis copier et configurer
cp .env.example .env.staging

# Éditer avec les valeurs staging
nano .env.staging

# Lancer en mode staging
NODE_ENV=staging npm run dev
```

### 3. Configuration Production

```bash
# ⚠️ NE JAMAIS stocker les secrets en local
# Utiliser les secrets managers de votre plateforme :
# - Vercel : Environment Variables
# - Netlify : Environment Variables
# - Railway : Variables
# - Docker : Docker Secrets

# Pour tests locaux uniquement :
cp .env.example .env.production
nano .env.production
NODE_ENV=production npm run build
```

## Variables d'environnement

### Base de données

```bash
# Option 1 : URL complète (recommandé pour staging/production)
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# Option 2 : Paramètres séparés (développement local)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=pos_app_dev
DB_SSL=false
```

### Supabase (Auth & Database)

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret
DEFAULT_TENANT_ID=your_tenant_id
SEED_TENANT_ID=your_seed_tenant_id
```

### NF525 - Certification

```bash
# ⚠️ CRITIQUE : Clés fournies par INFOCERT après certification
INFOCERT_PRIVATE_KEY=your_private_key
INFOCERT_MERCHANT_ID=your_merchant_id
```

### Sécurité

```bash
# Générer un secret fort : openssl rand -base64 64
JWT_SECRET=your_jwt_secret_min_64_chars
```

### Archivage & RGPD

```bash
ARCHIVE_PATH=./data/archives
ARCHIVE_SCHEDULE=0 0 * * 0  # Cron format
DPO_EMAIL=dpo@example.com
CUSTOMER_DATA_RETENTION=2190  # 6 ans en jours
```

### Application

```bash
NODE_ENV=development|staging|production
PORT=3000
BASE_URL=http://localhost:3000
```

## Commandes par environnement

### Development

```bash
# Lancer le serveur de développement
npm run dev

# Migrations de base de données
npm run db:generate
npm run db:migrate
npm run db:studio

# Seed des données de test
npm run db:seed
```

### Staging

```bash
# Utiliser le fichier .env.staging
export NODE_ENV=staging

# Build
npm run build

# Démarrer
npm run preview

# Migrations
npm run db:migrate:staging

# Seed avec données anonymisées
npm run db:seed:staging
```

### Production

```bash
# ⚠️ Ces commandes doivent être exécutées via CI/CD

# Build
NODE_ENV=production npm run build

# Démarrer
NODE_ENV=production npm start

# Migrations (avec précaution)
npm run db:migrate:production
```

## Scripts package.json recommandés

Ajoutez ces scripts à votre `package.json` :

```json
{
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "start": "node .output/server/index.mjs",
    "preview": "nuxt preview",

    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:push": "drizzle-kit push",
    "db:seed": "tsx server/database/seed.ts",

    "db:migrate:dev": "dotenv -e .env.development -- drizzle-kit migrate",
    "db:migrate:staging": "dotenv -e .env.staging -- drizzle-kit migrate",
    "db:migrate:production": "dotenv -e .env.production -- drizzle-kit migrate",

    "db:seed:dev": "dotenv -e .env.development -- tsx server/database/seed.ts",
    "db:seed:staging": "dotenv -e .env.staging -- tsx server/database/seed-staging.ts",

    "env:check": "node scripts/check-env.js"
  }
}
```

## Bonnes pratiques de sécurité

### ✅ À FAIRE

1. **Ne JAMAIS commiter les fichiers .env avec des vraies valeurs**
   - `.env.development`, `.env.staging`, `.env.production` doivent être dans `.gitignore`

2. **Utiliser des secrets managers en production**
   - Vercel Environment Variables
   - Railway Variables
   - AWS Secrets Manager
   - HashiCorp Vault

3. **Générer des secrets forts**
   ```bash
   # JWT Secret (64 caractères minimum)
   openssl rand -base64 64

   # API Key
   openssl rand -hex 32
   ```

4. **Rotation régulière des secrets**
   - JWT secrets tous les 3-6 mois
   - API keys après un départ d'employé
   - Clés NF525 selon les exigences INFOCERT

5. **Séparer les bases de données par environnement**
   - Dev : base locale ou cloud dev
   - Staging : base cloud séparée avec données anonymisées
   - Production : base cloud sécurisée avec backups

### ❌ À ÉVITER

1. ❌ Commiter des fichiers `.env` avec des vraies valeurs
2. ❌ Utiliser les mêmes secrets entre dev/staging/production
3. ❌ Partager les secrets par email/Slack
4. ❌ Hardcoder des secrets dans le code
5. ❌ Utiliser la base de production pour le développement

## Vérification de la configuration

### Script de validation

Créez `scripts/check-env.js` :

```javascript
const required = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'JWT_SECRET'
]

const missing = required.filter(key => !process.env[key])

if (missing.length > 0) {
  console.error('❌ Variables manquantes:', missing.join(', '))
  process.exit(1)
}

console.log('✅ Configuration valide')
```

Exécutez avant chaque déploiement :
```bash
npm run env:check
```

## Déploiement par environnement

### Vercel

```bash
# Staging
vercel --env-file=.env.staging

# Production
vercel --prod --env-file=.env.production
```

### Railway

```bash
# Staging
railway up --environment staging

# Production
railway up --environment production
```

### Docker

```bash
# Build avec secrets
docker build --secret id=env,src=.env.production -t pos-app .

# Run avec variables
docker run --env-file .env.production pos-app
```

## Gestion des migrations de base de données

### Development

```bash
# Générer une migration après modification du schéma
npm run db:generate

# Appliquer les migrations
npm run db:migrate:dev
```

### Staging

```bash
# Tester les migrations sur staging avant production
npm run db:migrate:staging

# Vérifier l'intégrité des données
npm run db:verify:staging
```

### Production

```bash
# ⚠️ TOUJOURS faire un backup avant
# Exécuter via CI/CD avec approbation manuelle
npm run db:backup:production
npm run db:migrate:production
npm run db:verify:production
```

## Troubleshooting

### Erreur : "DATABASE_URL is not defined"

```bash
# Vérifier que le fichier .env existe
ls -la .env*

# Vérifier que les variables sont chargées
echo $DATABASE_URL

# Recharger les variables
source .env.development
```

### Erreur : "SSL connection required"

```bash
# Ajouter sslmode=require à l'URL
DATABASE_URL=postgresql://...?sslmode=require

# Ou activer SSL dans la config
DB_SSL=true
```

### Erreur : "Invalid JWT Secret"

```bash
# Générer un nouveau secret fort
openssl rand -base64 64

# L'ajouter à votre .env
JWT_SECRET=nouveau_secret_généré
```

## Support

Pour toute question sur la configuration des environnements :
1. Consultez [.env.example](.env.example) pour les variables disponibles
2. Vérifiez les logs : `npm run dev -- --debug`
3. Contactez l'équipe DevOps

---

**Dernière mise à jour** : Décembre 2025
