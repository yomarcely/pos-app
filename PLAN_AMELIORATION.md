# Plan d'Amélioration POS App - Analyse Complète

## 📊 Vue d'Ensemble

**Date d'analyse**: 2025-12-18
**Version actuelle**: Nuxt 4 + PostgreSQL
**Conformité**: NF525, RGPD

### Métriques Actuelles
- **Fichiers source**: 472
- **Endpoints API**: 71
- **Fichiers de tests**: 37 (~8% couverture)
- **Fichiers avec console.log**: 93
- **Usages de type `any`**: 252+

---

## 🔴 PHASE 1: Sécurité & Conformité (URGENT - Avant Production)

### 1.1 Signature INFOCERT Manquante ⚠️ CRITIQUE

**Fichier**: `server/utils/nf525.ts:156-160`

**Problème**:
```typescript
return `TEMP_SIGNATURE_${ticketHash.substring(0, 16)}` // PLACEHOLDER!
```

**Impact**:
- ❌ Non-conformité NF525
- ❌ Invalide légalement en France
- ❌ Amende possible jusqu'à 7 500€

**Solution**:
1. Obtenir certificat INFOCERT auprès d'un prestataire agréé
2. Implémenter signature RSA avec clé privée INFOCERT
3. Stocker certificat de manière sécurisée (HSM ou vault)
4. Tester la chaîne cryptographique complète

**Fichiers à modifier**:
- `server/utils/nf525.ts` (fonction `generateTicketSignature`)
- `.env` (ajout variables `INFOCERT_CERTIFICATE_PATH`, `INFOCERT_KEY_PASSWORD`)
- Documentation d'installation

**Estimation**: 2-3 jours + délai obtention certificat (1-2 semaines)

---

### 1.2 Authentification Contournable en Dev ⚠️ HAUTE

**Fichier**: `server/middleware/auth.global.ts:15-35`

**Problème**:
```typescript
if (process.env.NODE_ENV === 'development') {
  event.context.auth = { userId: 1, tenantId: 1 }
  return
}
```

**Impact**:
- 🔓 Bypass complet de l'authentification
- 🔓 Risque si déployé accidentellement en production
- 🔓 Données exposées

**Solution**:
```typescript
// ✅ Approche sécurisée
const isDev = process.env.NODE_ENV === 'development'
const allowBypass = process.env.ALLOW_AUTH_BYPASS === 'true' // Doit être explicite

if (isDev && allowBypass) {
  console.warn('⚠️  AUTH BYPASS ACTIF - DEV MODE ONLY')
  event.context.auth = { userId: 1, tenantId: 1 }
  return
}

// Continuer avec authentification normale
```

**Fichiers à modifier**:
- `server/middleware/auth.global.ts`
- `.env.example` (documenter `ALLOW_AUTH_BYPASS`)
- Documentation de développement

**Estimation**: 1 heure

---

### 1.3 User ID Hardcodé ⚠️ HAUTE

**Fichiers concernés**:
- `server/api/customers/create.post.ts:69` → `userId: 1`
- `server/api/products/update-stock.post.ts:137` → `userId: 1`
- `stores/products.ts:148` → `userId: 1`

**Problème**:
```typescript
userId: 1, // ❌ Hardcodé - logs d'audit incorrects
```

**Impact**:
- 📝 Traçabilité RGPD incorrecte
- 📝 Impossible d'identifier qui a fait une action
- 📝 Non-conformité audit NF525

**Solution**:
```typescript
// ✅ Extraire du contexte JWT
const userId = event.context.auth?.userId
if (!userId) {
  throw createError({
    statusCode: 401,
    message: 'Utilisateur non authentifié'
  })
}

// Utiliser dans les logs
userId: userId,
```

**Fichiers à modifier**:
- `server/api/customers/create.post.ts`
- `server/api/products/update-stock.post.ts`
- `server/api/sales/create.post.ts`
- Tous les fichiers avec `userId: 1`
- `stores/products.ts` (appel API)

**Estimation**: 2 heures

---

### 1.4 Console.log en Production ⚠️ MOYENNE

**Problème**: 93 fichiers avec `console.log`

**Fichiers critiques**:
- `server/api/sales/create.post.ts:409, 435, 521`
- `server/utils/sync.ts:38, 50, 55`
- `middleware/auth.global.ts:16, 30`

**Impact**:
- 🐛 Expose détails internes (hashes, IDs, structures)
- ⚡ Dégrade performances (I/O bloquant)
- 📊 Logs non structurés

**Solution**:
Créer un logger structuré avec niveaux :

```typescript
// server/utils/logger.ts
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
})

// Usage
logger.info({ productId: 123 }, 'Stock mis à jour')
logger.error({ error: err }, 'Erreur création vente')
logger.debug({ hash: '...' }, 'Hash NF525 généré')
```

**Fichiers à créer**:
- `server/utils/logger.ts`

**Fichiers à modifier**:
- Tous les fichiers avec `console.log` (93 fichiers)

**Estimation**: 1 jour

---

### 1.5 Fallback Tenant Dangereux ⚠️ HAUTE

**Fichier**: `server/utils/tenant.ts:33`

**Problème**:
```typescript
// Si pas de tenant trouvé, utiliser tenant par défaut
return defaultTenantId // ❌ Risque isolation
```

**Impact**:
- 🔒 Violation isolation multi-tenant
- 🔒 Client A pourrait voir données Client B
- 🔒 Faille de sécurité critique

**Solution**:
```typescript
// ✅ Lever une erreur si tenant non trouvé
export function getTenantIdFromEvent(event: H3Event): number {
  const tenantId = event.context.auth?.tenantId

  if (!tenantId || tenantId <= 0) {
    throw createError({
      statusCode: 403,
      message: 'Tenant ID invalide ou manquant'
    })
  }

  return tenantId
}
```

**Fichiers à modifier**:
- `server/utils/tenant.ts`
- Tests d'isolation multi-tenant

**Estimation**: 2 heures

---

## 🟠 PHASE 2: Qualité Code & Tests

### 2.1 Type Safety - Éliminer `any` ⚠️ MOYENNE

**Problème**: 252+ usages de `any`

**Exemples critiques**:
```typescript
catch (error: any) { ... }  // ❌ Dans 25+ fichiers
getGlobalProductFields(fields: Record<string, any>) // ❌ sync.ts
```

**Solution**:
```typescript
// ✅ Types stricts
interface ProductFields {
  name: string
  price: number
  stock: number
  tvaId: number
}

function getGlobalProductFields(fields: ProductFields): ProductFields {
  // ...
}

// ✅ Gestion d'erreurs typée
catch (error: unknown) {
  if (error instanceof Error) {
    logger.error({ error: error.message }, 'Erreur')
  }
}
```

**Fichiers prioritaires**:
- `server/utils/sync.ts`
- `server/api/**/*.ts` (tous les endpoints)
- `stores/**/*.ts`

**Estimation**: 3 jours

---

### 2.2 Tests Manquants ⚠️ HAUTE

**État actuel**:
- ✅ 37 fichiers de tests (~8% couverture)
- ❌ 0 tests pour les 71 endpoints API
- ❌ 0 tests pour chaînage NF525
- ❌ 0 tests isolation multi-tenant

**Tests critiques à créer**:

#### 2.2.1 Tests API
```typescript
// tests/api/sales.test.ts
describe('POST /api/sales/create', () => {
  it('crée une vente valide', async () => {
    const response = await $fetch('/api/sales/create', {
      method: 'POST',
      body: { /* ... */ }
    })
    expect(response.success).toBe(true)
  })

  it('rejette une vente sans paiement', async () => {
    await expect(
      $fetch('/api/sales/create', {
        method: 'POST',
        body: { payments: [] }
      })
    ).rejects.toThrow('Mode de paiement manquant')
  })
})
```

#### 2.2.2 Tests NF525
```typescript
// tests/utils/nf525.test.ts
describe('Chaînage cryptographique', () => {
  it('chaîne correctement deux tickets', () => {
    const ticket1 = generateTicketHash(data1, null)
    const ticket2 = generateTicketHash(data2, ticket1)
    expect(ticket2).toContain(ticket1.substring(0, 10))
  })
})
```

#### 2.2.3 Tests Isolation Multi-tenant
```typescript
// tests/utils/tenant.test.ts
describe('Isolation tenant', () => {
  it('empêche accès données autre tenant', async () => {
    const tenantA = { tenantId: 1 }
    const tenantB = { tenantId: 2 }

    const productsA = await getProducts(tenantA)
    const productsB = await getProducts(tenantB)

    expect(productsA).not.toEqual(productsB)
  })
})
```

**Objectif**: 70% de couverture

**Estimation**: 5 jours

---

### 2.3 Standardiser Format Réponses API ⚠️ MOYENNE

**Problème**: Formats incohérents

**Exemples actuels**:
```typescript
// Variante 1
return { success: true, sale: { ... } }

// Variante 2
return { registers: [...] }

// Variante 3
return sale
```

**Solution**: Format standardisé
```typescript
// server/utils/api-response.ts
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  meta?: {
    pagination?: {
      page: number
      limit: number
      total: number
    }
  }
}

// Usage
return {
  success: true,
  data: { sale: newSale },
  meta: { timestamp: Date.now() }
}
```

**Fichiers à modifier**:
- Créer `server/utils/api-response.ts`
- Modifier tous les endpoints (71 fichiers)
- Mettre à jour frontend (appels API)

**Estimation**: 2 jours

---

### 2.4 Duplication API - Fusionner Routes ⚠️ BASSE

**Problème**: Routes en double
- `/api/customers/` ET `/api/clients/` → même fonctionnalité

**Solution**:
1. Choisir une route canonique: `/api/customers/`
2. Créer redirections pour `/api/clients/` (rétrocompatibilité)
3. Déprécier `/api/clients/` (ajouter header `Deprecated: true`)
4. Supprimer après 3 mois

**Fichiers à modifier**:
- `server/api/clients/**/*.ts` → redirection vers `customers`
- Documentation API
- Frontend (migrer vers `/api/customers/`)

**Estimation**: 1 jour

---

### 2.5 Documenter API avec OpenAPI/Swagger ⚠️ MOYENNE

**Créer spécification OpenAPI**:

```yaml
# openapi.yaml
openapi: 3.0.0
info:
  title: POS API
  version: 1.0.0
paths:
  /api/sales/create:
    post:
      summary: Créer une vente
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateSaleRequest'
      responses:
        '200':
          description: Vente créée
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Sale'
```

**Outils**:
- `@scalar/nuxt` pour documentation interactive
- Générer types TypeScript depuis OpenAPI

**Estimation**: 2 jours

---

## 🟡 PHASE 3: Fonctionnalités & Performance

### 3.1 Implémenter Système Points de Fidélité ⚠️ BASSE

**Fichier**: `server/api/clients/[id]/stats.get.ts:81`

**TODO actuel**:
```typescript
// TODO: Implémenter calcul points de fidélité
loyaltyPoints: 0
```

**Solution**:
```typescript
// Règle: 1 point par euro dépensé
const totalSpent = await db
  .select({ total: sql<number>`SUM(CAST(total_ttc AS DECIMAL))` })
  .from(sales)
  .where(eq(sales.customerId, clientId))

const loyaltyPoints = Math.floor(totalSpent[0].total || 0)
```

**Fichiers à modifier**:
- `server/api/clients/[id]/stats.get.ts`
- `server/database/schema.ts` (ajouter colonne `loyaltyPoints` sur `customers`)
- Interface `Customer`

**Estimation**: 1 jour

---

### 3.2 Nettoyer Colonnes Dépréciées DB ⚠️ BASSE

**Fichier**: `server/database/schema.ts`

**Colonnes obsolètes**:
1. `products.tva` (ligne 331) → utiliser `tvaId`
2. `sale_items.tva` (ligne 121) → redondant
3. `products.variationGroupIds` → mal nommé (contient IDs variations)

**Solution**:
```sql
-- Migration
ALTER TABLE products
  DROP COLUMN tva,
  RENAME COLUMN variationGroupIds TO variationIds;

ALTER TABLE sale_items
  DROP COLUMN tva;
```

**Étapes**:
1. Créer migration Drizzle
2. Vérifier aucun code n'utilise colonnes
3. Appliquer en production (avec backup)

**Estimation**: 4 heures

---

### 3.3 Ajouter Pagination aux Endpoints ⚠️ MOYENNE

**Problème**: `/api/clients` retourne tous les clients sans limite

**Solution**:
```typescript
// server/api/clients/index.get.ts
const query = getQuery(event)
const page = parseInt(query.page as string) || 1
const limit = parseInt(query.limit as string) || 50

const clients = await db
  .select()
  .from(customers)
  .limit(limit)
  .offset((page - 1) * limit)

const total = await db
  .select({ count: sql<number>`COUNT(*)` })
  .from(customers)

return {
  success: true,
  data: clients,
  meta: {
    pagination: {
      page,
      limit,
      total: total[0].count,
      pages: Math.ceil(total[0].count / limit)
    }
  }
}
```

**Endpoints à paginer**:
- `/api/clients`
- `/api/products`
- `/api/sales`
- `/api/stock-movements`

**Estimation**: 1 jour

---

### 3.4 Optimiser Requêtes N+1 ⚠️ MOYENNE

**Fichier**: `server/api/products/index.get.ts:76-100`

**Problème**:
```typescript
// ❌ Requête pour chaque produit (N+1)
for (const product of products) {
  const variations = await db.select()...
  const stocks = await db.select()...
}
```

**Solution**:
```typescript
// ✅ Requête unique avec JOIN
const productsWithDetails = await db
  .select({
    product: products,
    variations: sql`json_agg(variations)`,
    stocks: sql`json_agg(product_stocks)`
  })
  .from(products)
  .leftJoin(variations, eq(products.id, variations.productId))
  .leftJoin(productStocks, eq(products.id, productStocks.productId))
  .groupBy(products.id)
```

**Fichiers à optimiser**:
- `server/api/products/index.get.ts`
- `server/api/sales/index.get.ts`

**Estimation**: 1 jour

---

### 3.5 Refactorer Gros Composants Vue ⚠️ BASSE

**Fichiers volumineux**:
- `ColRight.vue` → 16.6 KB
- `ColMiddle.vue` → 10.7 KB

**Solution**: Découper en sous-composants

```vue
<!-- ColRight.vue - Avant -->
<template>
  <div>
    <!-- 460 lignes de code -->
  </div>
</template>

<!-- ColRight.vue - Après -->
<template>
  <div>
    <TotalDisplay :totalTTC="totalTTC" />
    <PaymentButtons @add-payment="addPayment" />
    <PaymentList :payments="payments" />
    <GlobalDiscount />
    <ValidateButton @validate="validerVente" />
  </div>
</template>
```

**Nouveaux composants**:
- `TotalDisplay.vue`
- `PaymentButtons.vue`
- `PaymentList.vue`
- `GlobalDiscount.vue`
- `ValidateButton.vue`

**Estimation**: 2 jours

---

## 📅 Calendrier Prévisionnel

### Sprint 1 (Semaine 1-2): Sécurité Critique
- [ ] Corriger bypass auth (1h)
- [ ] Extraire user ID (2h)
- [ ] Sécuriser tenant ID (2h)
- [ ] Remplacer console.log (1 jour)
- [ ] **Démarrer obtention certificat INFOCERT** (1-2 semaines)

### Sprint 2 (Semaine 3): Tests & Type Safety
- [ ] Remplacer types `any` (3 jours)
- [ ] Créer tests API critiques (5 jours)
  - Tests ventes
  - Tests NF525
  - Tests multi-tenant

### Sprint 3 (Semaine 4): API & Documentation
- [ ] Standardiser réponses API (2 jours)
- [ ] Fusionner routes dupliquées (1 jour)
- [ ] Créer documentation OpenAPI (2 jours)

### Sprint 4 (Semaine 5): Performance
- [ ] Ajouter pagination (1 jour)
- [ ] Optimiser requêtes N+1 (1 jour)
- [ ] Nettoyer colonnes DB (4h)

### Sprint 5 (Semaine 6): Finalisation
- [ ] **Implémenter signature INFOCERT** (2-3 jours)
- [ ] Refactorer composants Vue (2 jours)
- [ ] Tests de non-régression complets

---

## 🎯 Scores Cibles Post-Amélioration

| Catégorie | Score Actuel | Score Cible |
|-----------|--------------|-------------|
| Architecture | 7/10 | 8/10 |
| Qualité Code | 5/10 | 8/10 |
| Sécurité | 6/10 | 9/10 |
| Tests | 3/10 | 7/10 |
| Conformité NF525 | 5/10 | 10/10 |
| Performance | 6/10 | 8/10 |

---

## ⚠️ Risques & Mitigation

### Risque 1: Délai Certificat INFOCERT
**Impact**: Bloque mise en production
**Probabilité**: Moyenne
**Mitigation**: Démarrer demande immédiatement, prévoir 3 semaines

### Risque 2: Régression lors Refactoring
**Impact**: Bugs en production
**Probabilité**: Haute
**Mitigation**: Tests automatisés + staging + déploiement progressif

### Risque 3: Breaking Changes API
**Impact**: Applications clientes cassées
**Probabilité**: Moyenne
**Mitigation**: Versionning API (/api/v1), période de dépréciation

---

## 📞 Contacts & Ressources

### Certification INFOCERT
- **Prestataires agréés**: LNE, SGS, Bureau Veritas
- **Coût estimé**: 1 500€ - 3 000€ / an
- **Délai**: 2-3 semaines

### Outils Recommandés
- **Logger**: `pino` (performances élevées)
- **Tests**: `vitest` (déjà présent)
- **Documentation API**: `@scalar/nuxt`
- **Type checking**: `typescript-strict` (TSConfig)

---

## 📝 Notes de Développement

### Convention Commit
```
feat: Ajouter pagination aux produits
fix: Corriger bypass auth en dev
refactor: Extraire user ID du JWT
test: Ajouter tests isolation multi-tenant
docs: Documenter API avec OpenAPI
perf: Optimiser requête N+1 produits
```

### Branches Git
- `main` → production
- `develop` → intégration
- `feature/infocert-signature` → PHASE 1.1
- `refactor/remove-any-types` → PHASE 2.1

---

## ✅ Checklist Avant Production

- [ ] Signature INFOCERT implémentée et testée
- [ ] Certificat INFOCERT valide et installé
- [ ] Auth bypass désactivé en production
- [ ] User ID extrait du JWT partout
- [ ] Tenant ID validé strictement
- [ ] Console.log remplacés par logger
- [ ] Couverture tests ≥ 70%
- [ ] Tests NF525 passent (chaînage crypto)
- [ ] Tests isolation multi-tenant passent
- [ ] API documentée (OpenAPI)
- [ ] Variables d'environnement production configurées
- [ ] Backup base de données configuré
- [ ] Monitoring logs configuré (ex: Sentry)
- [ ] Plan de rollback testé

---

**Document créé le**: 2025-12-18
**Dernière mise à jour**: 2025-12-18
**Responsable**: Équipe Dev POS
**Prochaine revue**: À la fin de chaque sprint
