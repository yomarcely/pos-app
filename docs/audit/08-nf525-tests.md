# Audit 08 — Couverture de tests NF525

> Date : 2026-03-15 (mise à jour : 2026-03-16)
> Statut : ✅ 42 tests unitaires écrits et verts
> Périmètre : `server/utils/nf525.ts`
> Objectif : cartographier les fonctions et identifier les cas de test manquants avant écriture

---

## Résumé exécutif

**Couverture finale : 42 tests unitaires réels.** Toutes les fonctions exportées sont couvertes directement (sans mock). Les tests API conservent leurs mocks pour isoler les endpoints — comportement correct.

### Couverture par fonction

| Fonction | Tests écrits | Fichier |
|---|---|---|
| `generateTicketHash` | 11 | `tests/unit/nf525/generateTicketHash.test.ts` |
| `generateTicketNumber` | 9 | `tests/unit/nf525/generateTicketNumber.test.ts` |
| `verifyTicketIntegrity` | 4 | `tests/unit/nf525/verifyTicketIntegrity.test.ts` |
| `verifyTicketChain` | 8 | `tests/unit/nf525/verifyTicketChain.test.ts` |
| `generateTicketSignature` | 6 | `tests/unit/nf525/generateTicketSignature.test.ts` |
| `generateArchiveHash` | 3 | `tests/unit/nf525/generateArchiveHash.test.ts` |
| **Total** | **42** | — |

---

## 1. Fonctions exportées — inventaire

| Fonction | Lignes | Rôle | Tests existants | Verdict |
|---|---|---|---|---|
| `generateTicketHash` | 58–101 | Hash SHA-256 d'un ticket (chaînage) | Mockée dans `sales.test.ts` | ❌ Aucun test unitaire |
| `generateTicketNumber` | 112–125 | Numéro de ticket formaté `YYYYMMDD-E01-R01-NNNNNN` | Mockée dans `sales.test.ts` | ❌ Aucun test unitaire |
| `verifyTicketIntegrity` | 135–142 | Vérifie le hash d'un ticket | Jamais appelée dans les tests | ❌ Aucun test unitaire |
| `generateTicketSignature` | 152–167 | Signature INFOCERT (temp ou réelle) | Mockée dans `sales.test.ts` | ❌ Aucun test unitaire |
| `generateArchiveHash` | 175–177 | Hash SHA-256 d'un fichier d'archive | Mockée dans `archives.test.ts` | ❌ Aucun test unitaire |
| `verifyTicketChain` | 194–258 | Vérifie la chaîne complète de tickets | Mockée dans `sales.test.ts` | ❌ Aucun test unitaire |

**Interfaces exportées** : `TicketData`, `ChainVerificationResult` — pas de tests nécessaires (types uniquement).

---

## 2. Tests existants — état actuel

```typescript
// tests/api/sales.test.ts — mock complet
vi.mock('~/server/utils/nf525', () => ({
  generateTicketNumber: vi.fn(() => '20240115-E01-R01-000001'),
  generateTicketHash: vi.fn(() => 'mock-hash-abc123'),
  generateTicketSignature: vi.fn(() => 'mock-signature-xyz'),
  verifyTicketChain: vi.fn(() => ({ isValid: true, brokenLinks: [] })),
}))

// tests/api/archives.test.ts — mock partiel
vi.mock('~/server/utils/nf525', () => ({
  generateArchiveHash: vi.fn(() => 'mock-archive-hash-abc123'),
}))
```

Les tests API mockent nf525 pour isoler les endpoints — approche correcte pour les tests API. Mais cela signifie que **le comportement réel des fonctions NF525 n'est jamais testé**.

---

## 3. Analyse des fonctions

### 3.1 `generateTicketHash`

**Complexité** : Haute — construit une chaîne déterministe incluant toutes les données fiscales.

Cas à couvrir :
| # | Cas | Description |
|---|---|---|
| 1 | Premier ticket | `previousHash = null` → chaîne inclut `'FIRST_TICKET'` |
| 2 | Ticket chaîné | `previousHash` valide d'un ticket précédent |
| 3 | Déterminisme | Même input → même hash (idempotent) |
| 4 | Unicité | Input différent (même 1 champ) → hash différent |
| 5 | Remise globale | `globalDiscount` présent vs absent |
| 6 | Items sans tvaCode | Fallback `TVA${item.tva}` vs `tvaCode` fourni |
| 7 | Items avec discount | `discount:discountType` vs `'NO_DISCOUNT'` |
| 8 | Multi-paiements | Plusieurs modes de paiement |
| 9 | Mutation des données | Modifier 1 champ (totalTTC, sellerId…) casse le hash |

**Risque identifié** : le sérialiseur utilise `.join('::')` et `'|'` comme séparateurs. Si un champ contient `'::'` ou `'|'`, le hash serait identique à un autre ticket. À tester.

### 3.2 `generateTicketNumber`

**Complexité** : Faible — formatage de chaîne.

Cas à couvrir :
| # | Cas | Description |
|---|---|---|
| 1 | Format de base | `20250120-E01-R02-000001` pour seq=1, etab=1, register=2 |
| 2 | Padding établissement | `E01` vs `E12` pour etab=1 vs etab=12 |
| 3 | Padding caisse | `R01` vs `R10` |
| 4 | Padding séquence | `000001` vs `000999` vs `001000` |
| 5 | Date actuelle | Le format `YYYYMMDD` correspond à `new Date()` au moment de l'appel |

**Risque identifié** : `generateTicketNumber` utilise `new Date()` en interne (non injecté). Les tests devront mocker `Date` ou vérifier le format sans fixer la date.

### 3.3 `verifyTicketIntegrity`

**Complexité** : Très faible — wrapper de `generateTicketHash`.

Cas à couvrir :
| # | Cas | Description |
|---|---|---|
| 1 | Hash valide | Recalcul du hash = expectedHash → `true` |
| 2 | Hash corrompu | totalTTC modifié → `false` |
| 3 | Premier ticket | `previousHash = null`, hash correct → `true` |
| 4 | Premier ticket corrompu | `previousHash = null`, hash incorrect → `false` |

### 3.4 `generateTicketSignature`

**Complexité** : Faible.

Cas à couvrir :
| # | Cas | Description |
|---|---|---|
| 1 | Sans privateKey | Retourne `TEMP_SIGNATURE_${hash.substring(0, 16)}` |
| 2 | Avec privateKey | Retourne SHA-256 de `hash::privateKey` |
| 3 | Déterminisme | Même hash + même key → même signature |

### 3.5 `generateArchiveHash`

**Complexité** : Minimale — SHA-256 d'une string.

Cas à couvrir :
| # | Cas | Description |
|---|---|---|
| 1 | Hash non vide | Retourne une string hex de 64 caractères |
| 2 | Déterminisme | Même contenu → même hash |
| 3 | Unicité | Contenu différent → hash différent |

### 3.6 `verifyTicketChain`

**Complexité** : Haute — parcours de liste, deux types de vérification.

Cas à couvrir :
| # | Cas | Description |
|---|---|---|
| 1 | Chaîne vide | `[]` → `{ isValid: true, brokenLinks: [] }` |
| 2 | 1 ticket valide | Premier ticket (`previousHash = null`), hash correct |
| 3 | N tickets valides | Chaîne de 3+ tickets tous cohérents |
| 4 | Hash actuel corrompu | Un ticket a son `currentHash` modifié → `brokenLinks` contient ce ticket |
| 5 | Lien cassé | `ticket[i].previousHash !== ticket[i-1].currentHash` → `brokenLinks` |
| 6 | Double rupture | Deux tickets corrompus → deux entrées dans `brokenLinks` |
| 7 | Premier ticket avec previousHash non null | Devrait être détecté si `previousHash` ≠ `null` mais ticket[0] est le premier |
| 8 | Ticket annulé dans la chaîne | Le ticket annulé était chaîné → sa suppression casse les liens suivants |

**Cas critique manquant** : la fonction ne vérifie pas que `ticket[0].previousHash === null`. Un ticket inséré en début de chaîne avec un `previousHash` arbitraire passerait la vérification de lien (car `i === 0`, `previousTicket === null`).

---

## 4. Cas critiques prioritaires (périmètre recommandé)

Pour une première session de tests, couvrir en priorité :

1. **Déterminisme de `generateTicketHash`** — fondation de toute la conformité NF525
2. **Unicité de `generateTicketHash`** — mutation de chaque champ fiscal casse le hash
3. **`verifyTicketChain` chaîne valide N tickets** — scénario nominal
4. **`verifyTicketChain` hash corrompu** — détection de fraude
5. **`verifyTicketChain` lien cassé** — détection d'insertion/suppression
6. **`verifyTicketIntegrity` valide et invalide** — wrapper mais critique
7. **`generateTicketNumber` format** — format attendu par les caisses agréées

Les cas sur `generateTicketSignature` et `generateArchiveHash` sont secondaires (logique triviale).

---

## 5. Structure de test recommandée

```
tests/unit/nf525/
├── generateTicketHash.test.ts       # ~15 cas
├── generateTicketNumber.test.ts     # ~5 cas
├── verifyTicketIntegrity.test.ts    # ~4 cas
├── verifyTicketChain.test.ts        # ~8 cas
├── generateTicketSignature.test.ts  # ~3 cas
└── generateArchiveHash.test.ts      # ~3 cas
```

Total estimé : ~38 tests, ~300 lignes.

---

## 6. Points de vigilance pour l'écriture des tests

- **`generateTicketNumber` utilise `new Date()` en interne** → mocker `Date` ou vérifier le format sans fixer la date exacte (regex)
- **Séparateurs dans les données** → tester des valeurs contenant `'::'` et `'|'`
- **Precision float dans le hash** → les montants sont passés via `toFixed(2)` avant hashing — les tests doivent utiliser des valeurs entières ou à 2 décimales pour éviter les surprises
- **`verifyTicketChain` suppose que `tickets` est ordonné** — les tests doivent vérifier ce comportement avec un ordre inversé

---

## 7. Points de vigilance découverts lors de l'écriture des tests

### T7 — `verifyTicketChain` avec ordre inversé

**Comportement réel :** `verifyTicketChain([t3, t2, t1])` retourne `isValid: false`.

La fonction suppose que le tableau est ordonné chronologiquement (du plus ancien au plus récent). En ordre inversé, le chaînage échoue immédiatement :
- `tickets[1].previousHash` (= `t2.previousHash` = `t1.currentHash`) est comparé à `tickets[0].currentHash` (= `t3.currentHash`) → mismatch → `brokenLinks` non vide.

**Implication :** les appelants (endpoint `verifyTicketChain`) doivent garantir l'ordre chronologique avant d'appeler la fonction. Aucun tri interne n'est effectué.

### Timezone locale vs UTC dans `generateTicketNumber`

`generateTicketNumber` utilise `new Date().getFullYear/getMonth/getDate()` (heure locale), pas `toISOString()` (UTC). Les tests doivent reproduire le même calcul local pour être robustes en toutes timezones.

### Cas limite non défendu : `ticket[0].previousHash !== null`

La fonction ne vérifie pas que le premier ticket de la chaîne a `previousHash === null`. Un ticket inséré en tête avec un `previousHash` arbitraire passerait la vérification (car `i === 0`, pas de `previousTicket`). Ce comportement est documenté mais non corrigé (hors périmètre tests unitaires).

---

*Mise à jour : 2026-03-16 — 42 tests écrits, 371 tests total (suite complète), 0 échec.*
