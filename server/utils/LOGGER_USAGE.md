# Guide d'utilisation du Logger (Pino)

## Introduction

Le logger Pino est configuré pour remplacer progressivement les `console.log/error/warn` dans l'application. Il offre :

- **Logs structurés** : Format JSON en production pour faciliter l'analyse
- **Contexte enrichi** : Ajout automatique de métadonnées (timestamp, niveau, etc.)
- **Performance** : Pino est l'un des loggers Node.js les plus rapides
- **Formatage lisible** : pino-pretty pour le développement

## Import

```typescript
import { logger } from '~/server/utils/logger'
```

## Niveaux de log

```typescript
// Debug - Informations de débogage détaillées (uniquement en dev)
logger.debug('Message de debug')
logger.debug({ userId: 123, action: 'login' }, 'Utilisateur connecté')

// Info - Informations générales
logger.info('Serveur démarré')
logger.info({ port: 3000 }, 'Serveur en écoute')

// Warn - Avertissements (situation anormale mais non bloquante)
logger.warn('Stock faible pour le produit X')
logger.warn({ productId: 42, stock: 2 }, 'Alerte stock faible')

// Error - Erreurs (situations bloquantes)
logger.error({ err: error }, 'Erreur lors de la création du client')
logger.error({ err, customerId: 123 }, 'Échec de synchronisation')

// Fatal - Erreurs critiques qui nécessitent un arrêt
logger.fatal({ err: error }, 'Erreur fatale, arrêt du serveur')
```

## Bonnes pratiques

### ✅ À FAIRE

```typescript
// 1. Logs structurés avec contexte
logger.info({
  customerId: newCustomer.id,
  establishmentId
}, 'Client créé avec succès')

// 2. Erreurs avec objet err
logger.error({ err: error }, 'Erreur lors de la requête')

// 3. Logger spécifique à un module
const moduleLogger = createModuleLogger('sales')
moduleLogger.info({ saleId: 42 }, 'Vente enregistrée')

// 4. Logger pour requêtes HTTP
const reqLogger = createRequestLogger(event.path, event.method)
reqLogger.info({ tenantId }, 'Requête traitée')
```

### ❌ À ÉVITER

```typescript
// ❌ Ne plus utiliser console.log
console.log('Client créé')

// ❌ Ne pas mettre le message dans l'objet
logger.info({ message: 'Client créé' })

// ❌ Ne pas logger des données sensibles
logger.info({ password: 'secret123' }, 'Login réussi')
```

## Migration progressive

Pour migrer du code existant :

```typescript
// Avant
console.log(`✅ Client ${id} synchronisé`)
console.error('Erreur:', error)

// Après
logger.info({ customerId: id }, 'Client synchronisé')
logger.error({ err: error }, 'Erreur lors de la synchronisation')
```

## Configuration

### Variables d'environnement

```bash
# Niveau de log (debug, info, warn, error, fatal)
LOG_LEVEL=info

# En développement, les logs sont formatés avec pino-pretty
NODE_ENV=development
```

### Format de sortie

**Développement** : Format lisible avec couleurs
```
[10:30:45] INFO (pos-app): Client créé avec succès
    customerId: 123
    establishmentId: 1
```

**Production** : Format JSON structuré
```json
{
  "level": "info",
  "time": 1704724245000,
  "app": "pos-app",
  "customerId": 123,
  "establishmentId": 1,
  "msg": "Client créé avec succès"
}
```

## Exemples complets

### API endpoint

```typescript
import { logger } from '~/server/utils/logger'

export default defineEventHandler(async (event) => {
  const reqLogger = createRequestLogger(event.path, event.method)

  try {
    const tenantId = getTenantIdFromEvent(event)
    reqLogger.debug({ tenantId }, 'Traitement de la requête')

    // ... logique métier ...

    reqLogger.info({ resultCount: results.length }, 'Requête réussie')
    return { success: true, data: results }
  } catch (error) {
    reqLogger.error({ err: error }, 'Erreur lors du traitement')
    throw createError({ statusCode: 500, message: 'Erreur serveur' })
  }
})
```

### Opération métier

```typescript
import { logger } from '~/server/utils/logger'

const salesLogger = createModuleLogger('sales')

async function createSale(data: SaleData) {
  try {
    const sale = await db.insert(sales).values(data).returning()

    salesLogger.info({
      saleId: sale.id,
      totalTTC: sale.totalTTC,
      ticketNumber: sale.ticketNumber
    }, 'Vente enregistrée')

    return sale
  } catch (error) {
    salesLogger.error({ err: error, data }, 'Échec création vente')
    throw error
  }
}
```

## TODO : Fichiers à migrer

Les fichiers suivants contiennent encore des `console.log` à remplacer :

1. **Priorité haute** (APIs critiques) :
   - `server/api/sales/create.post.ts`
   - `server/api/sales/[id]/cancel.post.ts`
   - `server/api/sales/close-day.post.ts`
   - `server/api/movements/create.post.ts`

2. **Priorité moyenne** (Utilitaires) :
   - `server/utils/createMovement.ts`
   - `server/utils/sync.ts`
   - `server/utils/audit.ts`

3. **Priorité basse** (Composants Vue) :
   - `components/**/*.vue`
   - `pages/**/*.vue`
   - `stores/**/*.ts`

Note : Les console.log côté client (Vue) peuvent être conservés pour le moment car ils sont utiles pour le debug navigateur.
