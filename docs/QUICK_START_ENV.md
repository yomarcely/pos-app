# Quick Start - Configuration des Environnements

Guide rapide pour démarrer avec les différents environnements.

## 🚀 Démarrage Rapide (Development)

```bash
# 1. Copier le template
cp .env.example .env.development

# 2. Éditer avec vos valeurs
# Minimum requis : DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY

# 3. Activer l'environnement
npm run env:dev

# 4. Lancer l'application
npm run dev
```

## 📋 Commandes Disponibles

### Gestion des environnements

```bash
npm run env:dev          # Basculer vers development
npm run env:staging      # Basculer vers staging
npm run env:prod         # Basculer vers production
npm run env:check        # Vérifier la configuration
```

### Base de données

```bash
npm run db:generate      # Générer les migrations
npm run db:migrate       # Appliquer les migrations
npm run db:studio        # Ouvrir Drizzle Studio
npm run db:seed          # Seed les données de test
```

## 🔧 Configuration Minimale

### .env.development

```bash
DATABASE_URL=postgresql://user:password@host:5432/pos_app_dev?sslmode=require
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_JWT_SECRET=your_jwt_secret
DEFAULT_TENANT_ID=your_tenant_id
JWT_SECRET=dev_secret_change_in_production
NODE_ENV=development
PORT=3000
```

## 🏗️ Configuration Staging

1. Créer un projet Supabase séparé pour staging
2. Copier les credentials dans `.env.staging`
3. Activer : `npm run env:staging`
4. Build : `npm run build && npm run preview`

## 🚀 Déploiement Production

### Option 1 : Vercel

```bash
# Ajouter les variables dans Vercel Dashboard
# Environment Variables > Production

# Déployer
vercel --prod
```

### Option 2 : Railway

```bash
# Ajouter les variables dans Railway Dashboard
# Variables > Production

# Déployer
railway up --environment production
```

### Option 3 : Docker

```bash
# Build
docker build -t pos-app .

# Run avec variables
docker run --env-file .env.production -p 3000:3000 pos-app
```

## ⚠️ Sécurité

### À faire avant de commiter

```bash
# Vérifier qu'aucun secret n'est committé
git status

# Les fichiers suivants doivent être ignorés :
# .env
# .env.development
# .env.staging
# .env.production

# Seul .env.example doit être committé
```

### Générer des secrets forts

```bash
# JWT Secret (64 caractères)
openssl rand -base64 64

# API Key (32 caractères hex)
openssl rand -hex 32
```

## 📚 Documentation Complète

Pour plus de détails, consultez [ENVIRONMENTS.md](ENVIRONMENTS.md)

## 🆘 Troubleshooting

### Erreur : "DATABASE_URL is not defined"

```bash
# Vérifier le fichier .env
cat .env | grep DATABASE_URL

# Recharger les variables
npm run env:dev
```

### Erreur : "Connection refused"

```bash
# Vérifier que PostgreSQL est lancé (local)
pg_isready

# Ou vérifier l'URL Supabase
curl https://your-project.supabase.co
```

### Variables non chargées

```bash
# Redémarrer le serveur Nuxt
# Ctrl+C puis npm run dev
```

## ✅ Checklist Avant Production

- [ ] Tous les secrets sont dans le secrets manager (pas en .env)
- [ ] `JWT_SECRET` fait au moins 64 caractères
- [ ] `DB_SSL=true` est activé
- [ ] Les clés NF525 INFOCERT sont configurées
- [ ] Email DPO est configuré
- [ ] Backups automatiques sont activés
- [ ] Monitoring est configuré
- [ ] Logs sont centralisés

---

**Besoin d'aide ?** Consultez la [documentation complète](ENVIRONMENTS.md)
