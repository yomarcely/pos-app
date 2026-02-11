# Guide : Configuration RLS (Row Level Security) sur Supabase

## 🔒 Qu'est-ce que RLS ?

Row Level Security (RLS) est une fonctionnalité de PostgreSQL qui permet de **contrôler l'accès aux données au niveau de la base de données**. C'est une couche de sécurité **supplémentaire** qui protège vos données même si :

- Votre API est compromise
- Un utilisateur trouve un moyen de contourner votre application
- Vous faites une erreur de code dans votre API

**Avec RLS activé** : Même si quelqu'un accède directement à votre base de données, il ne pourra voir/modifier **QUE ses propres données**.

## 🎯 Pourquoi c'est important pour votre POS App ?

1. **Sécurité multi-tenant renforcée** : Double protection (API + Base de données)
2. **Conformité RGPD** : Les données sont isolées au niveau le plus bas
3. **Conformité NF525** : Protection des données de ventes contre toute manipulation
4. **Défense en profondeur** : Si un attaquant contourne l'API, RLS le bloque quand même

## 📋 Comment appliquer les politiques RLS ?

### Option 1 : Via l'interface Supabase (Recommandé)

1. **Connectez-vous à votre projet Supabase**
   - Allez sur https://supabase.com
   - Ouvrez votre projet

2. **Ouvrez le SQL Editor**
   - Menu latéral : `SQL Editor`
   - Cliquez sur `New Query`

3. **Copiez-collez le contenu du fichier migration**
   ```bash
   # Le fichier est ici :
   supabase/migrations/20241205_rls_policies.sql
   ```

4. **Exécutez la migration**
   - Cliquez sur `Run` ou `Ctrl/Cmd + Enter`
   - Vérifiez qu'il n'y a pas d'erreurs

5. **Vérifiez l'activation**
   - Allez dans `Database` > `Tables`
   - Sélectionnez une table (ex: `products`)
   - Onglet `RLS` : vous devriez voir les 4 politiques (SELECT, INSERT, UPDATE, DELETE)

### Option 2 : Via Supabase CLI (Si vous utilisez les migrations locales)

```bash
# Si vous avez déjà initialisé Supabase localement
supabase migration new rls_policies

# Copiez le contenu du fichier dans la migration créée
# Puis appliquez
supabase db push
```

## 🧪 Tester que RLS fonctionne

### Test 1 : Via Supabase Dashboard

1. **Créez 2 utilisateurs de test** (si pas déjà fait)
   - User A : `testa@example.com`
   - User B : `testb@example.com`

2. **Créez des données pour chaque utilisateur**
   - Connectez-vous avec User A dans votre app
   - Créez 1-2 produits
   - Déconnectez-vous

   - Connectez-vous avec User B
   - Créez 1-2 produits différents
   - Déconnectez-vous

3. **Vérifiez dans Supabase Dashboard**
   - Allez dans `Table Editor` > `products`
   - Vous devriez voir **TOUS les produits** (car vous êtes admin)
   - Notez les `tenant_id` différents pour chaque utilisateur

### Test 2 : Via l'application

1. **Connectez-vous avec User A**
   - Vous devez voir **uniquement** les produits de User A
   - Essayez de naviguer dans l'app : aucun produit de User B ne doit apparaître

2. **Connectez-vous avec User B**
   - Vous devez voir **uniquement** les produits de User B
   - Pareil : aucun produit de User A visible

### Test 3 : Test de sécurité avancé (Optionnel)

Si vous voulez vraiment tester que RLS bloque même les requêtes directes :

```javascript
// Dans la console du navigateur (après connexion)
const { data, error } = await $fetch('/api/products', {
  headers: {
    'Authorization': 'Bearer VOTRE_TOKEN',
    'x-tenant-id': 'UID_AUTRE_UTILISATEUR' // Essayez de tricher
  }
})

// Résultat : Vous ne devriez voir QUE vos propres produits
// Même si vous changez le x-tenant-id, RLS utilise auth.uid() qui ne peut pas être falsifié
```

## ⚠️ IMPORTANT : Comprendre les limitations

### Ce que RLS protège :
✅ Accès direct à la base de données
✅ Requêtes malveillantes via l'API
✅ Tentatives de contournement des filtres applicatifs
✅ Bugs dans votre code qui oublieraient de filtrer par tenant_id

### Ce que RLS ne protège PAS :
❌ Les accès avec la clé service_role (super admin)
❌ Les migrations et scripts d'administration
❌ Les requêtes depuis Supabase Dashboard (vous êtes admin)

## 🔍 Vérifier que les politiques sont actives

### Via SQL (dans Supabase SQL Editor)

```sql
-- Lister toutes les politiques RLS
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as operation,
  qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Vous devriez voir 4 politiques par table :
- `Users can view their own [table]` (SELECT)
- `Users can create their own [table]` (INSERT)
- `Users can update their own [table]` (UPDATE)
- `Users can delete their own [table]` (DELETE)

### Via l'interface Supabase

1. Allez dans `Database` > `Tables`
2. Cliquez sur une table (ex: `products`)
3. Onglet `Policies`
4. Vous devriez voir vos 4 politiques listées

## 🛠️ Dépannage

### "RLS is enabled but no policies exist"

Si vous voyez cette erreur, c'est que :
- RLS est activé ✅
- Mais aucune politique n'a été créée ❌

**Solution** : Exécutez la migration SQL complète.

### "operator does not exist: character varying = uuid"

Cette erreur signifie que :
- `tenant_id` est stocké en VARCHAR dans la base
- `auth.uid()` retourne un UUID
- Il faut caster le type

**Solution** : Dans le fichier de migration, toutes les occurrences de `auth.uid()` ont été remplacées par `auth.uid()::TEXT` pour matcher le type VARCHAR.

### "new row violates row-level security policy"

Cette erreur signifie que :
- Vous essayez d'insérer une ligne
- Mais le `tenant_id` ne correspond pas à `auth.uid()::TEXT`

**Solution** : Vérifiez que votre API injecte bien `tenant_id = auth.uid()` lors des INSERT.

### Les données ne s'affichent pas après activation de RLS

**Causes possibles** :
1. Le `tenant_id` dans vos données existantes ne correspond pas aux UUID des utilisateurs
2. Les anciennes données ont été créées avant l'implémentation du multi-tenant

**Solution** :
```sql
-- Vérifier les tenant_id
SELECT DISTINCT tenant_id FROM products;

-- Comparer avec les vrais UIDs utilisateurs
SELECT id, email FROM auth.users;

-- Si nécessaire, mettre à jour les anciennes données
-- ⚠️ ATTENTION : à faire avec précaution
UPDATE products
SET tenant_id = 'UUID_DU_VRAI_PROPRIETAIRE'
WHERE tenant_id = 'ANCIEN_TENANT_ID';
```

## 📊 Résumé : Votre sécurité en couches

Avec RLS activé, votre app a maintenant **3 couches de sécurité** :

```
┌─────────────────────────────────────────┐
│  1. Sécurité API (Nuxt)                 │
│  - getTenantIdFromEvent()               │
│  - Filtres WHERE tenant_id              │
│  - Validation Zod                       │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  2. Sécurité Base de Données (RLS)      │
│  - Politiques au niveau PostgreSQL      │
│  - Impossible à contourner              │
│  - Utilise auth.uid() automatiquement   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  3. Authentification Supabase           │
│  - JWT tokens signés                    │
│  - auth.uid() vérifié par Supabase      │
│  - Impossible à falsifier               │
└─────────────────────────────────────────┘
```

## ✅ Checklist finale

Avant de passer en production, vérifiez :

- [ ] RLS est activé sur toutes les tables
- [ ] 4 politiques (SELECT, INSERT, UPDATE, DELETE) par table
- [ ] Test avec 2+ utilisateurs : chacun voit uniquement ses données
- [ ] Les anciennes données ont un `tenant_id` valide
- [ ] Les logs d'audit sont protégés (SELECT/INSERT uniquement)
- [ ] Les ventes et clôtures sont protégées (conformité NF525)

## 🚀 Aller plus loin

### Politiques RLS avancées (si besoin futur)

Si vous voulez partager certaines données entre utilisateurs :

```sql
-- Exemple : Permettre à un "manager" de voir tous les produits de son équipe
CREATE POLICY "Managers can view team products"
ON products FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT user_id FROM team_members
    WHERE manager_id = auth.uid()
  )
);
```

### Surveillance et monitoring

```sql
-- Voir les tentatives d'accès bloquées
SELECT * FROM pg_stat_statements
WHERE query LIKE '%products%'
AND calls > 0;
```

---

**Créé le** : 5 décembre 2024
**Pour** : POS-App Multi-tenant avec Supabase
**Par** : Claude AI
