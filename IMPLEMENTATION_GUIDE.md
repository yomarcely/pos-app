# 🚀 Guide d'Implémentation - Plan d'Amélioration POS

Ce guide vous accompagne pas à pas dans l'exécution du plan d'amélioration.

---

## 📋 Documents de Référence

- **[PLAN_AMELIORATION.md](./PLAN_AMELIORATION.md)** - Plan détaillé avec toutes les modifications
- **[PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md)** - Suivi de progression en temps réel
- **[scripts/migration-plan.sh](./scripts/migration-plan.sh)** - Scripts d'automatisation

---

## 🎯 Démarrage Rapide

### 1. Vérifier l'État Actuel

```bash
# Exécuter le diagnostic
./scripts/migration-plan.sh check
```

**Sortie attendue**:
```
=== Vérification de l'état actuel ===
✓ Node.js installé: v20.x.x
✓ PostgreSQL installé
✓ package.json trouvé
⚠ Console.log trouvés: 93
⚠ Types 'any' trouvés: 252
✓ Fichiers de tests: 37
✗ Signature INFOCERT temporaire détectée
⚠ Bypass auth non sécurisé
```

### 2. Choisir Votre Approche

#### Option A: Approche Progressive (Recommandée)
Exécuter phase par phase avec validations intermédiaires.

```bash
# Phase 1: Sécurité (1-2 semaines)
./scripts/migration-plan.sh phase1

# Puis Phase 2: Qualité (1 semaine)
./scripts/migration-plan.sh phase2

# Enfin Phase 3: Performance (1 semaine)
./scripts/migration-plan.sh phase3
```

#### Option B: Approche Ciblée
Résoudre uniquement les problèmes critiques.

Voir la section "Quick Wins" ci-dessous.

#### Option C: Migration Complète (Déconseillé)
⚠️ Réservé aux environnements de développement uniquement.

```bash
./scripts/migration-plan.sh all
```

---

## ⚡ Quick Wins (1-2 jours)

### Correction Immédiate #1: Bypass Auth (15 min)

**Fichier**: `server/middleware/auth.global.ts`

**Avant**:
```typescript
if (process.env.NODE_ENV === 'development') {
  event.context.auth = { userId: 1, tenantId: 1 }
  return
}
```

**Après**:
```typescript
const isDev = process.env.NODE_ENV === 'development'
const allowBypass = process.env.ALLOW_AUTH_BYPASS === 'true'

if (isDev && allowBypass) {
  console.warn('⚠️  AUTH BYPASS ACTIF - DEV MODE ONLY')
  event.context.auth = { userId: 1, tenantId: 1 }
  return
}
```

**Fichier `.env`**:
```bash
# Développement uniquement - NE JAMAIS mettre true en production
ALLOW_AUTH_BYPASS=true
```

**Fichier `.env.production`**:
```bash
# Production - Toujours false
ALLOW_AUTH_BYPASS=false
```

✅ **Test**: Démarrer en mode dev → auth bypass devrait afficher warning

---

### Correction Immédiate #2: User ID Hardcodé (30 min)

**Créer**: `server/utils/auth.ts`
```typescript
import type { H3Event } from 'h3'

/**
 * Récupère l'ID utilisateur depuis le contexte JWT
 * @throws Error si utilisateur non authentifié
 */
export function getUserIdFromEvent(event: H3Event): number {
  const userId = event.context.auth?.userId

  if (!userId || typeof userId !== 'number') {
    throw createError({
      statusCode: 401,
      message: 'Utilisateur non authentifié'
    })
  }

  return userId
}
```

**Chercher et remplacer**:
```bash
# Trouver tous les fichiers avec userId hardcodé
grep -r "userId: 1" server/api/

# Pour chaque fichier, remplacer par:
import { getUserIdFromEvent } from '~/server/utils/auth'

const userId = getUserIdFromEvent(event)
```

**Fichiers à corriger** (liste non exhaustive):
- `server/api/customers/create.post.ts:69`
- `server/api/products/update-stock.post.ts:137`

✅ **Test**: Créer un client → vérifier logs audit avec bon userId

---

### Correction Immédiate #3: Tenant ID Sécurisé (20 min)

**Fichier**: `server/utils/tenant.ts`

**Avant**:
```typescript
export function getTenantIdFromEvent(event: H3Event): number {
  return event.context.auth?.tenantId || defaultTenantId
}
```

**Après**:
```typescript
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

✅ **Test**: Appeler API sans tenant → devrait retourner 403

---

### Correction Immédiate #4: Logger Structuré (2 heures)

#### Étape 1: Installation
```bash
npm install pino pino-pretty
```

#### Étape 2: Configuration

**Créer**: `server/utils/logger.ts`
```typescript
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  } : undefined
})

// Types pour auto-complétion
export type Logger = typeof logger
```

#### Étape 3: Remplacer console.log

**Script de remplacement automatique**:
```bash
# Créer script de migration
cat > scripts/replace-console-log.sh <<'EOF'
#!/bin/bash

# Remplacer console.log par logger.info dans server/
find server -name "*.ts" -type f -exec sed -i '' 's/console\.log/logger.info/g' {} \;

# Remplacer console.error par logger.error
find server -name "*.ts" -type f -exec sed -i '' 's/console\.error/logger.error/g' {} \;

# Remplacer console.warn par logger.warn
find server -name "*.ts" -type f -exec sed -i '' 's/console\.warn/logger.warn/g' {} \;

echo "✓ Migration terminée. Vérifiez les imports manuellement."
EOF

chmod +x scripts/replace-console-log.sh
./scripts/replace-console-log.sh
```

#### Étape 4: Ajouter imports

**Attention**: Le script ci-dessus remplace le texte mais n'ajoute pas l'import.

Pour chaque fichier modifié, ajouter en haut:
```typescript
import { logger } from '~/server/utils/logger'
```

**Aide VSCode**: Installer extension "Auto Import" pour automatiser.

✅ **Test**: Exécuter application → logs colorés dans terminal

---

## 📦 PHASE 1 Complète - Sécurité & Conformité

### Semaine 1-2

#### Jour 1: Corrections Immédiates
- ✅ Quick Wins #1-3 (ci-dessus)
- ✅ Commit: `fix: Secure auth bypass and tenant validation`

#### Jour 2-3: Migration Logger
- ✅ Quick Win #4
- ✅ Tester tous les endpoints API
- ✅ Commit: `refactor: Replace console.log with structured logger`

#### Jour 4: Certificat INFOCERT (Démarrage)
1. **Contacter 3 prestataires**:
   - LNE (www.lne.fr)
   - SGS (www.sgs.fr)
   - Bureau Veritas (www.bureauveritas.fr)

2. **Demander devis** avec:
   - Certificat signature NF525
   - Durée: 1 an renouvelable
   - Support technique inclus
   - Délai de livraison

3. **Documents requis**:
   - SIRET de l'entreprise
   - Coordonnées responsable technique
   - Description système de caisse

4. **Comparer offres**:
   | Prestataire | Coût | Délai | Support | Note |
   |-------------|------|-------|---------|------|
   | LNE | ? | ? | ? | - |
   | SGS | ? | ? | ? | - |
   | Bureau Veritas | ? | ? | ? | - |

✅ **Livrable**: Certificat commandé, délai connu

#### Jour 5-10: Préparation INFOCERT

**Pendant l'attente du certificat, préparer l'intégration**:

**Fichier**: `server/utils/nf525.ts`

```typescript
import crypto from 'crypto'
import fs from 'fs'

/**
 * Signe le hash du ticket avec la clé privée INFOCERT
 */
export function generateTicketSignature(
  ticketHash: string,
  privateKeyPath?: string
): string {
  // Récupérer clé privée depuis env ou paramètre
  const keyPath = privateKeyPath || process.env.INFOCERT_PRIVATE_KEY_PATH

  if (!keyPath) {
    // Mode développement: signature temporaire
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  SIGNATURE INFOCERT TEMPORAIRE - DEV MODE')
      return `DEV_SIGNATURE_${ticketHash.substring(0, 16)}`
    }

    throw new Error('INFOCERT_PRIVATE_KEY_PATH non configuré')
  }

  // Charger clé privée
  const privateKey = fs.readFileSync(keyPath, 'utf8')
  const password = process.env.INFOCERT_KEY_PASSWORD

  // Signer avec RSA-SHA256
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(ticketHash)
  sign.end()

  const signature = sign.sign({
    key: privateKey,
    passphrase: password
  }, 'base64')

  return signature
}

/**
 * Vérifie la signature d'un ticket
 */
export function verifyTicketSignature(
  ticketHash: string,
  signature: string,
  publicKeyPath?: string
): boolean {
  const keyPath = publicKeyPath || process.env.INFOCERT_PUBLIC_KEY_PATH

  if (!keyPath) {
    throw new Error('INFOCERT_PUBLIC_KEY_PATH non configuré')
  }

  const publicKey = fs.readFileSync(keyPath, 'utf8')

  const verify = crypto.createVerify('RSA-SHA256')
  verify.update(ticketHash)
  verify.end()

  return verify.verify(publicKey, signature, 'base64')
}
```

**Fichier `.env.production`**:
```bash
# Certificat INFOCERT
INFOCERT_PRIVATE_KEY_PATH=/secure/path/to/infocert-private.pem
INFOCERT_PUBLIC_KEY_PATH=/secure/path/to/infocert-public.pem
INFOCERT_KEY_PASSWORD=your-secure-password
```

✅ **Test unitaire**:
```typescript
// tests/utils/nf525.test.ts
describe('INFOCERT Signature', () => {
  it('signe et vérifie un ticket', () => {
    const hash = generateTicketHash(mockData, null)
    const signature = generateTicketSignature(hash)

    expect(signature).toBeTruthy()
    expect(verifyTicketSignature(hash, signature)).toBe(true)
  })

  it('rejette signature invalide', () => {
    const hash = generateTicketHash(mockData, null)
    const fakeSignature = 'fake-signature'

    expect(verifyTicketSignature(hash, fakeSignature)).toBe(false)
  })
})
```

#### Jour 11-14: Réception & Installation Certificat

**Quand le certificat arrive**:

1. **Vérifier le certificat**:
```bash
# Vérifier format PEM
openssl x509 -in infocert-cert.pem -text -noout

# Extraire clé publique
openssl x509 -pubkey -noout -in infocert-cert.pem > infocert-public.pem
```

2. **Stocker de manière sécurisée**:
   - ❌ PAS dans Git
   - ✅ Dans coffre-fort (Vault, AWS Secrets Manager)
   - ✅ Permissions restrictives: `chmod 600`

3. **Tester en staging**:
```bash
# Configurer staging avec certificat test
export INFOCERT_PRIVATE_KEY_PATH=/staging/infocert-private.pem
export INFOCERT_KEY_PASSWORD=staging-password

# Créer vente test
npm run test:integration
```

4. **Valider conformité NF525**:
   - [ ] Chaînage cryptographique fonctionne
   - [ ] Signatures vérifiables
   - [ ] Logs d'audit complets
   - [ ] Pas de modification tickets après signature

✅ **Livrable Phase 1**: Application sécurisée et conforme NF525

---

## 📊 PHASE 2 - Qualité Code & Tests

### Semaine 3

#### Jour 15-17: Type Safety

**Objectif**: Éliminer types `any` critiques

1. **Activer TypeScript strict**:

**Fichier**: `tsconfig.json`
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitThis": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

2. **Compiler et lister erreurs**:
```bash
npx tsc --noEmit > typescript-errors.txt
```

3. **Prioriser corrections**:
   - **P0**: `server/api/**/*.ts` (endpoints API)
   - **P1**: `server/utils/**/*.ts` (utilitaires)
   - **P2**: `stores/**/*.ts` (stores Pinia)
   - **P3**: `components/**/*.vue` (composants)

4. **Exemple de correction**:

**Avant**:
```typescript
function syncData(data: any) {
  // ❌ Type any
}
```

**Après**:
```typescript
interface SyncData {
  products: Product[]
  stocks: Stock[]
  metadata: {
    timestamp: number
    source: string
  }
}

function syncData(data: SyncData): Promise<void> {
  // ✅ Type strict
}
```

✅ **Objectif**: Réduire `any` de 252 → <50

#### Jour 18-19: Tests API

**Créer structure de tests**:

```
tests/
├── api/
│   ├── sales.test.ts
│   ├── customers.test.ts
│   ├── products.test.ts
│   └── auth.test.ts
├── utils/
│   ├── nf525.test.ts
│   ├── tenant.test.ts
│   └── logger.test.ts
└── integration/
    ├── checkout-flow.test.ts
    └── multi-tenant.test.ts
```

**Template de test API**:

```typescript
// tests/api/sales.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setup, $fetch } from '@nuxt/test-utils'

describe('POST /api/sales/create', async () => {
  await setup({
    // Configuration test
  })

  it('crée une vente valide', async () => {
    const response = await $fetch('/api/sales/create', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token'
      },
      body: {
        items: [
          {
            productId: 1,
            quantity: 2,
            unitPrice: 10.00,
            tva: 20
          }
        ],
        seller: { id: 1, name: 'Test' },
        payments: [{ mode: 'Espèces', amount: 24.00 }],
        totals: {
          totalHT: 20.00,
          totalTVA: 4.00,
          totalTTC: 24.00
        },
        establishmentId: 1,
        registerId: 1
      }
    })

    expect(response.success).toBe(true)
    expect(response.data.sale.ticketNumber).toBeDefined()
  })

  it('rejette vente sans paiement', async () => {
    await expect(
      $fetch('/api/sales/create', {
        method: 'POST',
        body: {
          items: [...],
          payments: [] // ❌ Pas de paiement
        }
      })
    ).rejects.toThrow('Mode de paiement manquant')
  })

  it('rejette vente avec total négatif', async () => {
    // Test cas limites
  })
})
```

**Exécuter tests**:
```bash
npm run test
npm run test:coverage
```

✅ **Objectif**: 70% couverture

---

## 🚀 Déploiement en Production

### Checklist Pré-Production

- [ ] **Sécurité**
  - [ ] Certificat INFOCERT installé
  - [ ] `ALLOW_AUTH_BYPASS=false`
  - [ ] Variables d'environnement production configurées
  - [ ] Clés privées stockées en sécurité (pas dans Git)

- [ ] **Tests**
  - [ ] Tous les tests passent (`npm run test`)
  - [ ] Tests NF525 validés
  - [ ] Tests isolation multi-tenant OK

- [ ] **Code Quality**
  - [ ] Aucun console.log en production
  - [ ] TypeScript strict activé
  - [ ] Linting sans erreurs

- [ ] **Base de Données**
  - [ ] Backup avant migration
  - [ ] Migrations testées en staging
  - [ ] Plan de rollback documenté

- [ ] **Monitoring**
  - [ ] Logs centralisés configurés
  - [ ] Alertes configurées
  - [ ] Dashboard monitoring prêt

### Déploiement Progressif

1. **Staging** (Jour -7)
   - Déployer toutes les modifications
   - Tests intensifs pendant 3 jours

2. **Canary** (Jour -3)
   - 10% du trafic sur nouvelle version
   - Monitorer métriques

3. **Production** (Jour 0)
   - 100% du trafic
   - Surveillance accrue 48h

---

## 🆘 Aide & Support

### En cas de problème

1. **Consulter les logs**:
```bash
# Logs application
pm2 logs pos-app

# Logs base de données
sudo journalctl -u postgresql
```

2. **Rollback rapide**:
```bash
git checkout previous-stable-tag
npm run build
pm2 restart pos-app
```

3. **Contacter support**:
- GitHub Issues: [votre-repo]/issues
- Email: support@votre-entreprise.com

### Ressources

- [Documentation Nuxt 4](https://nuxt.com)
- [Norme NF525](https://www.legifrance.gouv.fr)
- [Drizzle ORM](https://orm.drizzle.team)

---

**Bon courage pour la migration ! 🚀**
