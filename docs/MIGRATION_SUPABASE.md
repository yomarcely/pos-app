# Guide : Appliquer le Schéma sur Supabase

## Problème Identifié

La connexion directe PostgreSQL à Supabase est bloquée :
```
Error: ENOTFOUND db.sbsdlmwtlvejfnszxrcp.supabase.co
```

**Causes possibles** :
1. Projet Supabase en pause (gratuit inactif > 7 jours)
2. Problème de réseau / pare-feu
3. VPN qui bloque le port 5432

## ✅ Solution : Appliquer via le SQL Editor

### Étape 1 : Vérifier l'état du projet Supabase

1. Ouvrez https://supabase.com/dashboard/projects
2. Trouvez votre projet : **sbsdlmwtlvejfnszxrcp**
3. Si le statut est **"Paused"** :
   - Cliquez sur **"Resume Project"**
   - Attendez 2-3 minutes que le projet redémarre
   - ⚠️ Les projets gratuits se mettent en pause après 7 jours d'inactivité

### Étape 2 : Ouvrir le SQL Editor

Accédez directement au SQL Editor :
https://supabase.com/dashboard/project/sbsdlmwtlvejfnszxrcp/sql/new

Ou depuis le dashboard :
1. Cliquez sur votre projet **sbsdlmwtlvejfnszxrcp**
2. Menu latéral → **SQL Editor**
3. Cliquez sur **"New query"**

### Étape 3 : Copier le schéma SQL

Le schéma complet a été généré dans :
```bash
scripts/full-schema.sql
```

**Option A - Depuis votre éditeur** :
1. Ouvrez le fichier [scripts/full-schema.sql](../scripts/full-schema.sql)
2. Copiez TOUT le contenu (Cmd+A puis Cmd+C)

**Option B - Depuis le terminal** :
```bash
cat scripts/full-schema.sql | pbcopy
```

### Étape 4 : Exécuter dans Supabase

1. **Collez** le SQL dans le SQL Editor de Supabase (Cmd+V)
2. **Vérifiez** que tout le contenu est bien présent (devrait faire ~400 lignes)
3. Cliquez sur **"Run"** (ou Cmd+Enter)
4. Attendez l'exécution (10-20 secondes)

### Étape 5 : Vérifier la création des tables

Exécutez cette requête pour voir toutes les tables créées :

\`\`\`sql
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
\`\`\`

**Vous devriez voir** :
- ✅ archives (11 colonnes)
- ✅ audit_logs (11 colonnes)
- ✅ brands (7 colonnes)
- ✅ categories (11 colonnes)
- ✅ closures (16 colonnes)
- ✅ customers (19 colonnes)
- ✅ movements (7 colonnes)
- ✅ products (23 colonnes)
- ✅ sale_items (15 colonnes)
- ✅ sales (22 colonnes)
- ✅ sellers (7 colonnes)
- ✅ stock_movements (12 colonnes)
- ✅ suppliers (11 colonnes)
- ✅ variation_groups (7 colonnes)
- ✅ variations (9 colonnes)

**Total : 15 tables**

## 🔧 Problèmes Courants et Solutions

### Erreur : "relation already exists"

Si vous voyez cette erreur, c'est que les tables existent déjà partiellement.

**Solution 1 - Supprimer et recréer** :
1. Dans le SQL Editor, décommentez la section DROP TABLE (lignes 17-33 du schema)
2. Exécutez d'abord les DROP TABLE
3. Puis exécutez tout le reste

**Solution 2 - Utiliser Drizzle Push** :
Si votre projet Supabase est maintenant actif, essayez :
```bash
npm run db:push
```

### Erreur : "permission denied"

Vous devez être connecté avec un compte qui a les droits d'administration sur le projet.

### Le projet ne redémarre pas

Si le projet reste en pause :
1. Vérifiez votre quota (projets gratuits : 2 max)
2. Contactez le support Supabase si besoin
3. Solution temporaire : créez un nouveau projet

## 📊 Après la Migration

### 1. Tester la connexion locale

```bash
# Vérifier que la connexion fonctionne
npm run db:studio
```

Cela devrait ouvrir Drizzle Studio avec toutes vos tables.

### 2. Seed des données de test

```bash
# Peupler avec des données d'exemple
npm run db:seed
```

### 3. Démarrer l'application

```bash
# Lancer le serveur de développement
npm run dev
```

### 4. Vérifier dans Supabase

Dashboard → **Table Editor** → Vous devriez voir toutes les tables listées

## 🎯 Si la connexion PostgreSQL fonctionne maintenant

Si après avoir réactivé le projet, la connexion fonctionne :

```bash
# Méthode recommandée : Push le schéma
npm run db:push

# Ou appliquer les migrations
npm run db:migrate

# Puis seed
npm run db:seed
```

## 🔍 Vérification Complète

Exécutez ces requêtes pour vérifier l'intégrité :

### Tables et indexes
\`\`\`sql
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
\`\`\`

### Foreign keys
\`\`\`sql
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public';
\`\`\`

## 📝 Checklist Finale

- [ ] Projet Supabase actif (pas en pause)
- [ ] SQL Editor accessible
- [ ] Schéma SQL exécuté sans erreur
- [ ] 15 tables créées
- [ ] Tous les index créés
- [ ] Foreign keys en place
- [ ] Triggers created
- [ ] `npm run db:studio` fonctionne
- [ ] `npm run db:seed` exécuté
- [ ] `npm run dev` démarre sans erreur

## 🆘 Besoin d'Aide ?

### Option 1 : Réactiver et retry
```bash
# Après réactivation du projet
npm run db:push
npm run db:seed
npm run dev
```

### Option 2 : Application manuelle complète
1. SQL Editor → Copier/Coller scripts/full-schema.sql
2. RUN
3. Vérifier les tables dans Table Editor

### Option 3 : Nouveau projet Supabase
Si problèmes persistants :
1. Créer un nouveau projet Supabase
2. Copier la nouvelle DATABASE_URL
3. Mettre à jour .env.development
4. Exécuter npm run db:push

## 📚 Ressources

- [SQL Editor Supabase](https://supabase.com/dashboard/project/sbsdlmwtlvejfnszxrcp/sql)
- [Table Editor](https://supabase.com/dashboard/project/sbsdlmwtlvejfnszxrcp/editor)
- [Drizzle Docs - Push](https://orm.drizzle.team/kit-docs/commands#push)
- [Guide environnements](ENVIRONMENTS.md)

---

**Note** : Une fois la migration réussie, la commande `npm run db:push` fonctionnera pour les mises à jour futures.
