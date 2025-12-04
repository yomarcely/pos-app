# 🚀 Étapes Rapides - Migration Base de Données Supabase

## Problème Actuel

❌ Connexion PostgreSQL directe bloquée : `ENOTFOUND db.sbsdlmwtlvejfnszxrcp.supabase.co`

## ✅ Solution en 3 Étapes

### Étape 1 : Réactiver votre projet Supabase

🔗 https://supabase.com/dashboard/projects

1. Trouvez le projet **sbsdlmwtlvejfnszxrcp**
2. Si "Paused" → Cliquez **"Resume Project"**
3. Attendez 2-3 minutes

### Étape 2 : Appliquer le schéma SQL

🔗 https://supabase.com/dashboard/project/sbsdlmwtlvejfnszxrcp/sql/new

#### Option A - Copier/Coller (Recommandé)

1. Ouvrez [scripts/full-schema.sql](scripts/full-schema.sql)
2. Copiez TOUT le contenu (Cmd+A, Cmd+C)
3. Collez dans le SQL Editor
4. Cliquez **"Run"**

#### Option B - Terminal

```bash
# Copier le fichier dans le presse-papiers
cat scripts/full-schema.sql | pbcopy

# Puis coller dans SQL Editor et Run
```

### Étape 3 : Vérifier et Seed

```bash
# Tester la connexion
npm run db:studio

# Si ça marche, seed des données
npm run db:seed

# Démarrer l'app
npm run dev
```

## 📋 Vérification Rapide

Dans le SQL Editor Supabase, exécutez :

```sql
SELECT COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';
```

**Résultat attendu** : `table_count = 15`

## 🔧 Si ça ne marche toujours pas

### Essai avec db:push

Après avoir réactivé le projet :

```bash
npm run db:push
```

Si erreur de connexion persiste :
- Vérifiez votre connexion internet
- Désactivez VPN si actif
- Essayez avec un autre réseau (partage de connexion)

## 📚 Documentation Complète

Pour plus de détails : [docs/MIGRATION_SUPABASE.md](docs/MIGRATION_SUPABASE.md)

## ✅ Checklist

- [ ] Projet Supabase actif (https://supabase.com/dashboard)
- [ ] SQL exécuté dans SQL Editor
- [ ] 15 tables créées (vérification SQL ci-dessus)
- [ ] `npm run db:studio` fonctionne
- [ ] `npm run db:seed` exécuté
- [ ] Application démarre avec `npm run dev`

---

**Temps estimé** : 5-10 minutes

**Questions ?** Consultez [docs/MIGRATION_SUPABASE.md](docs/MIGRATION_SUPABASE.md)
