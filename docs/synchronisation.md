# 🔄 Système de Synchronisation Multi-Établissements

## 📋 Vue d'ensemble

Le système de synchronisation permet de partager des produits et des clients entre plusieurs établissements tout en maintenant :
- **Stock indépendant** par établissement
- **Prix personnalisables** par établissement (optionnel)
- **Paramètres locaux** configurables
- **Synchronisation sélective** des champs

---

## 🏗️ Architecture

### Niveau 1 : Données Maîtres (Globales)
Les tables `products` et `customers` contiennent les informations partagées entre établissements :
- Nom, description, catégorie, fournisseur, etc.
- Ces données sont synchronisées selon les règles du groupe

### Niveau 2 : Paramètres par Établissement
- **`product_establishments`** : Prix locaux, disponibilité
- **`customer_establishments`** : Remises locales, fidélité, statistiques

### Niveau 3 : Stock par Établissement
- **`product_stocks`** : Stock totalement indépendant par établissement
- **`stock_movements`** : Traçabilité avec `establishment_id`

---

## 🚀 Mise en Route

### Étape 1 : Appliquer la Migration

```bash
# Appliquer la migration 0007
npm run db:migrate

# Ou avec Drizzle directement
npx drizzle-kit push
```

La migration va :
1. Créer toutes les nouvelles tables
2. Migrer automatiquement le stock existant vers `product_stocks` pour chaque établissement
3. Ajouter `establishment_id` à `stock_movements`

### Étape 2 : Créer un Groupe de Synchronisation

```typescript
// Exemple d'appel API
const response = await $fetch('/api/sync-groups/create', {
  method: 'POST',
  body: {
    name: 'Réseau France',
    description: 'Synchronisation des magasins Paris et Lyon',
    establishmentIds: [1, 2], // IDs des établissements

    // Règles pour les produits
    productRules: {
      syncName: true,           // ✅ Synchroniser le nom
      syncDescription: true,    // ✅ Synchroniser la description
      syncBarcode: true,        // ✅ Synchroniser le code-barres
      syncCategory: true,       // ✅ Synchroniser la catégorie
      syncPriceTtc: false,      // ❌ Prix TTC indépendant par établissement
      syncImage: true,          // ✅ Synchroniser l'image
    },

    // Règles pour les clients
    customerRules: {
      syncCustomerInfo: true,   // ✅ Nom, prénom
      syncCustomerContact: true,// ✅ Email, téléphone
      syncLoyaltyProgram: false,// ❌ Fidélité locale
      syncDiscount: false,      // ❌ Remise locale
    }
  }
})
```

---

## 💼 Cas d'Usage

### Scénario : Réseau de 2 Magasins

**Configuration :**
```javascript
{
  name: "Réseau France",
  establishments: ["Paris", "Lyon"],
  productRules: {
    syncName: true,
    syncPriceTtc: false  // Prix différents
  }
}
```

**Résultat :**

1. **Création d'un produit à Paris**
   ```javascript
   POST /api/products/create
   {
     name: "Coca-Cola 1L",
     price: 2.50,  // Prix Paris
     stock: 50     // Stock Paris uniquement
   }
   ```

2. **Synchronisation automatique**
   - Le produit apparaît à Lyon avec le même nom
   - Prix à Lyon : **non synchronisé** → définir manuellement
   - Stock à Lyon : **0** (indépendant)

3. **Modification du nom à Paris**
   ```javascript
   PATCH /api/products/123
   {
     name: "Coca-Cola 1L Regular"
   }
   ```
   → Le nom est **automatiquement mis à jour** à Lyon

4. **Modification du prix à Lyon**
   ```javascript
   POST /api/product-establishments/update
   {
     productId: 123,
     establishmentId: 2,  // Lyon
     priceOverride: 2.80
   }
   ```
   → Prix local à Lyon : 2.80€ (indépendant de Paris)

---

## 🔌 API Disponibles

### Gestion des Groupes

#### Créer un groupe
```http
POST /api/sync-groups/create
Content-Type: application/json

{
  "name": "Mon Groupe",
  "establishmentIds": [1, 2, 3],
  "productRules": { ... },
  "customerRules": { ... }
}
```

#### Lister les groupes
```http
GET /api/sync-groups
```

#### Détails d'un groupe
```http
GET /api/sync-groups/:id
```

#### Modifier les règles
```http
PATCH /api/sync-groups/:id/rules
Content-Type: application/json

{
  "entityType": "product",
  "syncPriceTtc": false,
  "syncImage": true
}
```

### Gestion du Stock

#### Mettre à jour le stock
```http
POST /api/product-stocks/update
Content-Type: application/json

{
  "productId": 123,
  "establishmentId": 1,
  "quantity": 10,
  "adjustmentType": "add",  // ou "set"
  "reason": "reception"
}
```

#### Consulter les stocks
```http
GET /api/product-stocks?establishmentId=1&lowStock=true
```

#### Alertes de stock
```http
GET /api/product-stocks?outOfStock=true
```

### Paramètres Locaux

#### Définir un prix local
```http
POST /api/product-establishments/update
Content-Type: application/json

{
  "productId": 123,
  "establishmentId": 2,
  "priceOverride": 2.99,
  "isAvailable": true,
  "notes": "Promotion locale"
}
```

---

## 📊 Exemple Complet

### 1. Configuration Initiale

```typescript
// Créer 2 établissements
const paris = await $fetch('/api/establishments/create', {
  method: 'POST',
  body: { name: 'Paris', city: 'Paris' }
})

const lyon = await $fetch('/api/establishments/create', {
  method: 'POST',
  body: { name: 'Lyon', city: 'Lyon' }
})

// Créer un groupe de sync
const group = await $fetch('/api/sync-groups/create', {
  method: 'POST',
  body: {
    name: 'France',
    establishmentIds: [paris.id, lyon.id],
    productRules: {
      syncName: true,
      syncPriceTtc: false  // Prix indépendant
    }
  }
})
```

### 2. Créer un Produit

```typescript
// Créer le produit (automatiquement disponible dans les 2 établissements)
const product = await $fetch('/api/products/create', {
  method: 'POST',
  body: {
    name: 'Café Premium',
    price: 15.00,  // Prix par défaut
    categoryId: 1
  }
})

// Initialiser le stock à Paris
await $fetch('/api/product-stocks/update', {
  method: 'POST',
  body: {
    productId: product.id,
    establishmentId: paris.id,
    quantity: 100,
    adjustmentType: 'set',
    reason: 'reception'
  }
})

// Initialiser le stock à Lyon
await $fetch('/api/product-stocks/update', {
  method: 'POST',
  body: {
    productId: product.id,
    establishmentId: lyon.id,
    quantity: 50,
    adjustmentType: 'set',
    reason: 'reception'
  }
})

// Définir un prix différent à Lyon
await $fetch('/api/product-establishments/update', {
  method: 'POST',
  body: {
    productId: product.id,
    establishmentId: lyon.id,
    priceOverride: 16.50  // Plus cher à Lyon
  }
})
```

### 3. Consulter l'État

```typescript
// Voir les stocks dans tous les établissements
const stocks = await $fetch(`/api/product-stocks?productId=${product.id}`)

console.log(stocks)
/*
{
  stocks: [
    {
      establishmentName: "Paris",
      stock: 100,
      priceOverride: null  // Prix par défaut (15€)
    },
    {
      establishmentName: "Lyon",
      stock: 50,
      priceOverride: 16.50  // Prix local
    }
  ]
}
*/
```

---

## 🎨 Frontend (À Implémenter)

### Composant : Sélecteur d'Établissement

```vue
<template>
  <div class="establishment-selector">
    <select v-model="currentEstablishment">
      <option
        v-for="estab in establishments"
        :key="estab.id"
        :value="estab.id"
      >
        {{ estab.name }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
const currentEstablishment = ref(1)
const { data: establishments } = await useFetch('/api/establishments')

// Watcher pour recharger les stocks quand on change d'établissement
watch(currentEstablishment, async (newEstab) => {
  await refreshNuxtData('products')
})
</script>
```

### Page : Configuration Synchronisation

```vue
<template>
  <div class="sync-config">
    <h1>Groupes de Synchronisation</h1>

    <div v-for="group in syncGroups" :key="group.id" class="sync-group">
      <h2>{{ group.name }}</h2>
      <p>{{ group.establishmentCount }} établissements</p>

      <div class="rules">
        <h3>Règles Produits</h3>
        <label v-for="rule in productRuleKeys" :key="rule">
          <input
            type="checkbox"
            :checked="group.productRules?.[rule]"
            @change="updateRule(group.id, 'product', rule, $event.target.checked)"
          />
          {{ ruleLabels[rule] }}
        </label>
      </div>
    </div>

    <button @click="createGroup">Créer un Groupe</button>
  </div>
</template>

<script setup lang="ts">
const { data: syncGroups } = await useFetch('/api/sync-groups')

const productRuleKeys = [
  'syncName', 'syncDescription', 'syncPriceTtc', 'syncCategory'
]

const ruleLabels = {
  syncName: 'Nom du produit',
  syncDescription: 'Description',
  syncPriceTtc: 'Prix TTC',
  syncCategory: 'Catégorie'
}

async function updateRule(groupId: number, entityType: string, rule: string, value: boolean) {
  await $fetch(`/api/sync-groups/${groupId}/rules`, {
    method: 'PATCH',
    body: {
      entityType,
      [rule]: value
    }
  })
}
</script>
```

---

## 🔐 Conformité NF525

Le système de synchronisation est **100% compatible NF525** :

- ✅ **Traçabilité** : Tous les mouvements de stock enregistrés avec `establishment_id`
- ✅ **Inaltérabilité** : Table `sync_logs` pour audit des synchronisations
- ✅ **Horodatage** : Tous les changements datés (`created_at`, `updated_at`)
- ✅ **Liaison** : Les ventes liées à l'établissement (`sales.establishment_id`)

---

## ⚙️ Configuration Avancée

### Synchronisation Manuelle (Force Sync)

```typescript
// Forcer la synchronisation d'un produit spécifique
await $fetch('/api/sync/force', {
  method: 'POST',
  body: {
    syncGroupId: 1,
    entityType: 'product',
    entityId: 123,
    sourceEstablishmentId: 1,
    targetEstablishmentIds: [2, 3]  // Optionnel
  }
})
```

### Transfert de Stock entre Établissements

```typescript
await $fetch('/api/product-stocks/transfer', {
  method: 'POST',
  body: {
    productId: 123,
    fromEstablishmentId: 1,
    toEstablishmentId: 2,
    quantity: 10,
    notes: 'Transfert pour promotion'
  }
})
```

---

## 📈 Statistiques et Rapports

### Stock Total par Produit

```typescript
const { data } = await useFetch(`/api/product-stocks?productId=123`)

const totalStock = data.value.stocks.reduce((sum, s) => sum + s.stock, 0)
console.log(`Stock total: ${totalStock}`)
```

### Produits en Alerte

```typescript
const { data } = await useFetch('/api/product-stocks?lowStock=true')
console.log(`${data.value.lowStockCount} produits en stock faible`)
```

---

## 🐛 Dépannage

### Problème : Les prix ne se synchronisent pas

**Solution** : Vérifier que `syncPriceTtc` est à `true` dans les règles du groupe.

```typescript
await $fetch(`/api/sync-groups/1/rules`, {
  method: 'PATCH',
  body: {
    entityType: 'product',
    syncPriceTtc: true
  }
})
```

### Problème : Le stock est partagé entre établissements

**Solution** : Le système utilise maintenant `product_stocks`. Vérifier que la migration 0007 a bien été appliquée.

```bash
npm run db:migrate
```

---

## 📚 Ressources

- **Schema** : `server/database/schema.ts`
- **Types** : `types/sync.ts`
- **Validateurs** : `server/validators/sync.schema.ts`
- **Utilitaires** : `server/utils/sync.ts`
- **Migration** : `server/database/migrations/0007_sync_multi_establishment.sql`

---

## 🎯 Prochaines Étapes

1. ✅ Implémenter l'interface de gestion des groupes de sync
2. ✅ Ajouter un sélecteur d'établissement sur toutes les pages
3. ⚠️ Adapter le store Pinia pour filtrer par établissement
4. ⚠️ Créer une page de vue globale des stocks
5. ⚠️ Ajouter des notifications pour les alertes de stock

---

**Développé avec ❤️ pour une gestion multi-établissements efficace**
