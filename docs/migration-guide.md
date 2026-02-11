# 🚀 Guide de Migration - Synchronisation Multi-Établissements

## 📋 Pré-requis

Avant de commencer, assurez-vous d'avoir :
- ✅ Une sauvegarde de votre base de données
- ✅ Node.js et npm installés
- ✅ Accès à votre base de données PostgreSQL/Supabase
- ✅ Tous les établissements créés dans votre application

---

## 🔄 Étapes de Migration

### **Étape 1 : Sauvegarder la Base de Données** ⚠️ CRUCIAL

```bash
# Si vous utilisez PostgreSQL local
pg_dump -U postgres -d pos_app > backup_$(date +%Y%m%d_%H%M%S).sql

# Si vous utilisez Supabase
# Aller sur le dashboard Supabase → Database → Backups
# Créer un backup manuel
```

---

### **Étape 2 : Vérifier l'État Actuel**

```sql
-- Connexion à votre base de données
psql $DATABASE_URL

-- Vérifier le nombre de produits
SELECT COUNT(*) as total_products FROM products;

-- Vérifier le nombre d'établissements
SELECT COUNT(*) as total_establishments FROM establishments;

-- Aperçu du stock actuel
SELECT id, name, stock FROM products LIMIT 5;
```

**Notez ces chiffres** pour vérifier après la migration que tout s'est bien passé.

---

### **Étape 3 : Appliquer la Migration**

#### **Option A : Via Drizzle (Recommandé)**

```bash
# 1. Installer les dépendances (si pas déjà fait)
npm install

# 2. Vérifier que drizzle.config.ts est correct
cat drizzle.config.ts

# 3. Générer et appliquer la migration
npx drizzle-kit push

# 4. Confirmer quand demandé
# → La migration va créer les nouvelles tables
# → Le stock sera automatiquement migré
```

#### **Option B : Via psql (Manuel)**

```bash
# Appliquer la migration SQL directement
psql $DATABASE_URL -f server/database/migrations/0007_sync_multi_establishment.sql

# Vérifier qu'il n'y a pas d'erreurs dans la sortie
```

---

### **Étape 4 : Vérifier la Migration**

```sql
-- 1. Vérifier que les nouvelles tables existent
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'sync_groups',
  'sync_group_establishments',
  'sync_rules',
  'product_stocks',
  'product_establishments',
  'customer_establishments',
  'sync_logs'
)
ORDER BY table_name;
-- Devrait retourner 7 lignes

-- 2. Vérifier que le stock a été migré
SELECT
  (SELECT COUNT(*) FROM products) as nb_products,
  (SELECT COUNT(*) FROM establishments) as nb_establishments,
  (SELECT COUNT(*) FROM product_stocks) as nb_stocks,
  (SELECT COUNT(*) FROM products) * (SELECT COUNT(*) FROM establishments) as expected_stocks;
-- nb_stocks devrait être égal à expected_stocks

-- 3. Vérifier un exemple de stock migré
SELECT
  p.id,
  p.name,
  p.stock as old_stock,
  e.name as establishment,
  ps.stock as new_stock
FROM products p
CROSS JOIN establishments e
LEFT JOIN product_stocks ps ON ps.product_id = p.id AND ps.establishment_id = e.id
LIMIT 10;
-- new_stock devrait être égal à old_stock pour chaque établissement

-- 4. Vérifier les politiques RLS
SELECT COUNT(*) as total_policies
FROM pg_policies
WHERE tablename LIKE 'sync%'
   OR tablename LIKE 'product_stocks'
   OR tablename LIKE 'product_establishments'
   OR tablename LIKE 'customer_establishments';
-- Devrait retourner environ 42-44 politiques

-- 5. Vérifier establishment_id dans stock_movements
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'stock_movements'
AND column_name = 'establishment_id';
-- Devrait retourner 1 ligne avec data_type = integer
```

---

### **Étape 5 : Test des API**

```bash
# 1. Démarrer le serveur de développement
npm run dev

# 2. Tester l'API des groupes de sync (dans un autre terminal)
curl http://localhost:3000/api/sync-groups

# 3. Tester l'API des stocks
curl "http://localhost:3000/api/product-stocks?establishmentId=1"

# 4. Créer un groupe de test
curl -X POST http://localhost:3000/api/sync-groups/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Sync",
    "establishmentIds": [1, 2],
    "productRules": {
      "syncName": true,
      "syncPriceTtc": false
    }
  }'
```

**Résultats attendus :**
- ✅ `/api/sync-groups` retourne `{ success: true, syncGroups: [] }`
- ✅ `/api/product-stocks?establishmentId=1` retourne des stocks
- ✅ La création du groupe retourne `{ success: true, syncGroup: {...} }`

---

### **Étape 6 : Configuration Initiale**

#### **6.1 - Créer votre Premier Groupe de Synchronisation**

```typescript
// Via l'API ou créer un script
const response = await $fetch('/api/sync-groups/create', {
  method: 'POST',
  body: {
    name: 'Mon Réseau',
    description: 'Synchronisation de mes établissements',
    establishmentIds: [1, 2, 3], // IDs de vos établissements

    productRules: {
      syncName: true,           // ✅ Synchroniser le nom
      syncDescription: true,    // ✅ Synchroniser la description
      syncBarcode: true,        // ✅ Synchroniser le code-barres
      syncCategory: true,       // ✅ Synchroniser la catégorie
      syncSupplier: true,       // ✅ Synchroniser le fournisseur
      syncBrand: true,          // ✅ Synchroniser la marque
      syncPriceHt: true,        // ✅ Synchroniser le prix HT
      syncPriceTtc: false,      // ❌ Prix TTC différent par établissement
      syncTva: true,            // ✅ Synchroniser la TVA
      syncImage: true,          // ✅ Synchroniser l'image
      syncVariations: true,     // ✅ Synchroniser les variations
    },

    customerRules: {
      syncCustomerInfo: true,   // ✅ Nom, prénom
      syncCustomerContact: true,// ✅ Email, téléphone
      syncCustomerAddress: true,// ✅ Adresse
      syncCustomerGdpr: true,   // ✅ Consentements RGPD
      syncLoyaltyProgram: false,// ❌ Fidélité locale
      syncDiscount: false,      // ❌ Remise locale
    }
  }
})

console.log('Groupe créé :', response.syncGroup)
```

#### **6.2 - Ajuster les Stocks par Établissement (Optionnel)**

Si vous avez des stocks différents par établissement :

```typescript
// Exemple : Magasin 1 a 100 unités, Magasin 2 a 50 unités
await $fetch('/api/product-stocks/update', {
  method: 'POST',
  body: {
    productId: 1,
    establishmentId: 1,
    quantity: 100,
    adjustmentType: 'set',
    reason: 'inventory_adjustment'
  }
})

await $fetch('/api/product-stocks/update', {
  method: 'POST',
  body: {
    productId: 1,
    establishmentId: 2,
    quantity: 50,
    adjustmentType: 'set',
    reason: 'inventory_adjustment'
  }
})
```

#### **6.3 - Définir des Prix Locaux (Optionnel)**

Si vous avez des prix différents par établissement :

```typescript
// Prix différent pour le magasin 2
await $fetch('/api/product-establishments/update', {
  method: 'POST',
  body: {
    productId: 1,
    establishmentId: 2,
    priceOverride: 25.99,  // Prix local
    isAvailable: true,
    notes: 'Prix promotionnel Lyon'
  }
})
```

---

### **Étape 7 : Adapter le Code Existant**

#### **7.1 - Adapter les Appels aux Stocks**

**Avant :**
```typescript
// Anciennes API (à remplacer progressivement)
const { data: products } = await useFetch('/api/products')
// products[0].stock contient le stock global
```

**Après :**
```typescript
// Nouvelles API avec établissement
const currentEstablishment = ref(1)
const { data: stocks } = await useFetch('/api/product-stocks', {
  params: { establishmentId: currentEstablishment.value }
})

// Trouver le stock d'un produit spécifique
const productStock = stocks.value.find(s => s.productId === 123)
console.log('Stock:', productStock.stock)
```

#### **7.2 - Adapter le Store Pinia**

Voir l'exemple complet dans [`docs/RECAP_SYNCHRONISATION.md`](RECAP_SYNCHRONISATION.md#4-adapter-le-store-pinia)

---

## 🐛 Résolution des Problèmes

### **Problème 1 : La migration échoue**

**Erreur :** `table "sync_groups" already exists`

**Solution :**
```sql
-- Les tables existent déjà, vérifier qu'elles sont complètes
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE 'sync%';

-- Si elles sont incomplètes, les supprimer et réexécuter
DROP TABLE IF EXISTS sync_logs CASCADE;
DROP TABLE IF EXISTS customer_establishments CASCADE;
DROP TABLE IF EXISTS product_establishments CASCADE;
DROP TABLE IF EXISTS product_stocks CASCADE;
DROP TABLE IF EXISTS sync_rules CASCADE;
DROP TABLE IF EXISTS sync_group_establishments CASCADE;
DROP TABLE IF EXISTS sync_groups CASCADE;

-- Puis relancer la migration
npx drizzle-kit push
```

---

### **Problème 2 : Le stock n'a pas été migré**

**Vérification :**
```sql
SELECT COUNT(*) FROM product_stocks;
```

**Si le résultat est 0 :**
```sql
-- Réexécuter la migration du stock manuellement
INSERT INTO product_stocks (
  tenant_id,
  product_id,
  establishment_id,
  stock,
  stock_by_variation,
  min_stock,
  min_stock_by_variation
)
SELECT
  p.tenant_id,
  p.id as product_id,
  e.id as establishment_id,
  p.stock,
  p.stock_by_variation,
  p.min_stock,
  p.min_stock_by_variation
FROM products p
CROSS JOIN establishments e
WHERE p.tenant_id = e.tenant_id
ON CONFLICT (product_id, establishment_id) DO NOTHING;
```

---

### **Problème 3 : Les politiques RLS bloquent les requêtes**

**Erreur :** `new row violates row-level security policy`

**Solution :**
```sql
-- Vérifier que l'utilisateur est bien authentifié
SELECT auth.uid();

-- Si NULL, vous devez vous connecter via Supabase Auth

-- Désactiver temporairement RLS pour debug (DEV UNIQUEMENT)
ALTER TABLE product_stocks DISABLE ROW LEVEL SECURITY;
-- Ne JAMAIS faire ça en production !
```

---

### **Problème 4 : Les API retournent des erreurs 500**

**Vérification :**
```bash
# Vérifier les logs du serveur
npm run dev
# Observer les erreurs dans la console

# Vérifier la connexion à la DB
echo $DATABASE_URL
```

**Solutions courantes :**
- Vérifier que `DATABASE_URL` est correctement configuré
- Vérifier que toutes les dépendances sont installées : `npm install`
- Vérifier que le serveur Nuxt est redémarré après la migration

---

## ✅ Checklist Post-Migration

- [ ] ✅ Les 7 nouvelles tables existent
- [ ] ✅ Le stock a été migré (`product_stocks` contient des données)
- [ ] ✅ Les politiques RLS sont actives
- [ ] ✅ `stock_movements` a la colonne `establishment_id`
- [ ] ✅ Les API `/api/sync-groups` fonctionnent
- [ ] ✅ Les API `/api/product-stocks` fonctionnent
- [ ] ✅ Un groupe de test a été créé avec succès
- [ ] ✅ Les stocks peuvent être mis à jour par établissement
- [ ] ✅ Les prix locaux peuvent être définis
- [ ] ✅ L'application démarre sans erreur

---

## 📊 Métriques de Validation

```sql
-- Récapitulatif complet de la migration
SELECT
  'Tables créées' as metric,
  COUNT(*) as value
FROM information_schema.tables
WHERE table_name IN (
  'sync_groups',
  'sync_group_establishments',
  'sync_rules',
  'product_stocks',
  'product_establishments',
  'customer_establishments',
  'sync_logs'
)

UNION ALL

SELECT
  'Stocks migrés' as metric,
  COUNT(*) as value
FROM product_stocks

UNION ALL

SELECT
  'Produits' as metric,
  COUNT(*) as value
FROM products

UNION ALL

SELECT
  'Établissements' as metric,
  COUNT(*) as value
FROM establishments

UNION ALL

SELECT
  'Politiques RLS' as metric,
  COUNT(*) as value
FROM pg_policies
WHERE tablename LIKE 'sync%'
   OR tablename IN ('product_stocks', 'product_establishments', 'customer_establishments')

UNION ALL

SELECT
  'Index créés' as metric,
  COUNT(*) as value
FROM pg_indexes
WHERE tablename LIKE 'sync%'
   OR tablename IN ('product_stocks', 'product_establishments', 'customer_establishments');
```

**Résultats attendus :**
```
metric                | value
----------------------|-------
Tables créées         | 7
Stocks migrés         | NB_PRODUITS × NB_ÉTABLISSEMENTS
Produits              | Votre nombre de produits
Établissements        | Votre nombre d'établissements
Politiques RLS        | ~42-44
Index créés           | ~20-25
```

---

## 🎉 Migration Réussie !

Si tous les tests sont passés, votre migration est terminée avec succès !

**Prochaines étapes :**
1. Créer vos groupes de synchronisation réels
2. Configurer les règles selon vos besoins
3. Adapter le frontend (voir [`docs/RECAP_SYNCHRONISATION.md`](RECAP_SYNCHRONISATION.md))
4. Former les utilisateurs sur le nouveau système

---

## 📞 Support

En cas de problème :
1. Consulter les logs : `npm run dev` et observer la console
2. Vérifier la base de données avec les requêtes SQL ci-dessus
3. Consulter [`docs/SYNCHRONISATION.md`](SYNCHRONISATION.md) pour la documentation complète
4. Restaurer la sauvegarde si nécessaire (voir Étape 1)

---

**🚀 Bonne migration !**

*Dernière mise à jour : 2025-12-10*
