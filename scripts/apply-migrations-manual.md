# Guide : Appliquer les Migrations Manuellement sur Supabase

## Problème identifié

La connexion directe PostgreSQL à Supabase est bloquée :
```
Error: getaddrinfo ENOTFOUND db.sbsdlmwtlvejfnszxrcp.supabase.co
```

## Solutions possibles

### Solution 1 : Réactiver le projet Supabase (si en pause)

1. Allez sur https://supabase.com/dashboard/projects
2. Trouvez votre projet : `sbsdlmwtlvejfnszxrcp`
3. Si le statut est "Paused", cliquez sur "Resume"
4. Attendez quelques minutes que le projet redémarre
5. Réessayez : `npm run db:push`

### Solution 2 : Appliquer les migrations via le SQL Editor

1. **Ouvrir le SQL Editor de Supabase** :
   - https://supabase.com/dashboard/project/sbsdlmwtlvejfnszxrcp/sql/new

2. **Copier le contenu de la première migration** :
   ```bash
   cat server/database/migrations/0000_handy_darwin.sql
   ```

3. **Coller dans le SQL Editor et exécuter** (RUN)

4. **Faire de même pour la seconde migration** :
   ```bash
   cat server/database/migrations/0001_wandering_screwball.sql
   ```

5. **Vérifier que les tables sont créées** :
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   ORDER BY table_name;
   ```

### Solution 3 : Utiliser le Connection Pooler

Supabase fournit aussi une URL via pooler. Modifiez votre `.env` :

```bash
# Au lieu de :
DATABASE_URL=postgresql://postgres:5SY70Zhuq41n5CqJ@db.sbsdlmwtlvejfnszxrcp.supabase.co:5432/postgres

# Utilisez (avec pooler) :
DATABASE_URL=postgresql://postgres.sbsdlmwtlvejfnszxrcp:5SY70Zhuq41n5CqJ@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

Puis réessayez :
```bash
npm run db:push
```

### Solution 4 : Vérifier les paramètres réseau

Si vous êtes derrière un VPN ou pare-feu d'entreprise :

1. Désactiver temporairement le VPN
2. Vérifier que le port 5432 n'est pas bloqué
3. Essayer avec une autre connexion (WiFi, partage de connexion)

## Vérification après application

Une fois les migrations appliquées (par une des méthodes ci-dessus) :

```bash
# Tester avec Drizzle Studio
npm run db:studio
```

Vous devriez voir toutes vos tables dans l'interface.

## Tables attendues

Après migration, vous devriez avoir ces tables :

- ✅ sales (ventes NF525)
- ✅ sale_items (lignes de vente)
- ✅ products (produits)
- ✅ variations (variantes)
- ✅ variation_groups (groupes de variantes)
- ✅ categories (catégories)
- ✅ brands (marques)
- ✅ suppliers (fournisseurs)
- ✅ customers (clients)
- ✅ sellers (vendeurs)
- ✅ stock_movements (mouvements de stock)
- ✅ closures (clôtures de caisse)
- ✅ archives (archives NF525)
- ✅ audit_logs (logs d'audit)
- ✅ movements (journal général)

## Prochaines étapes

Une fois les migrations appliquées :

```bash
# 1. Vérifier la structure
npm run db:studio

# 2. Seed des données de test
npm run db:seed

# 3. Démarrer l'application
npm run dev
```

---

**Besoin d'aide ?** Vérifiez que votre projet Supabase est actif sur le dashboard.
