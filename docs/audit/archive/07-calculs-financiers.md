# Audit 07 — Calculs financiers (floating point)

> Date : 2026-03-15
> Statut : ✅ Corrections appliquées — P1, P2, P3, P4 corrigés le 2026-03-15
> Périmètre : `server/api/sales/create.post.ts`, `server/api/sales/close-day.post.ts`, `stores/cart.ts` / `utils/cartUtils.ts`, `server/utils/nf525.ts`

---

## Résumé exécutif

| Fichier | Méthode | Risque | Verdict |
|---|---|---|---|
| `utils/cartUtils.ts` | Centimes entiers + LRM | Faible | ✅ Correct |
| `stores/cart.ts` | Délègue à cartUtils | Faible | ✅ Correct |
| `server/api/sales/create.post.ts` | Validation totalTTC côté serveur | Faible | ✅ Corrigé (P1) |
| `server/api/sales/close-day.post.ts` | Centimes entiers + assertion HT+TVA=TTC | Faible | ✅ Corrigé (P2, P3) |
| `server/utils/nf525.ts` | Hash aligné avec valeur DB (.toFixed(2)) | Faible | ✅ Corrigé (P4) |
| `server/utils/financialValidation.ts` | Utilitaires financiers testés | Faible | ✅ Nouveau (16 tests) |

---

## 1. `utils/cartUtils.ts` — ✅ Bonne implémentation

### Méthode utilisée
**Centimes entiers** (integers) + **Largest Remainder Method (LRM)** pour la distribution de remise globale.

### Fonctions clés
```typescript
export function round2(n: number) { return Math.round(n * 100) / 100 }
export function toCents(n: number) { return Math.round(n * 100) }
export function fromCents(c: number) { return c / 100 }
```

### Points positifs
- Toutes les additions de montants se font en centimes (`toCents`) → évite l'accumulation d'erreurs float
- Distribution de remise globale par LRM (prorata + distribution du centime résiduel) → garantit que `sum(lignes) = total` à 1 centime près
- `unitTtcAfterLineDiscount` arrondit à 2 décimales via `round2`
- `totalTVA = totalTTC - totalHT` (différence, non somme) → évite la double accumulation d'erreurs

### Calcul HT par ligne (potentiellement imprécis)
```typescript
const lineHt = fromCents(netLineCents) / (1 + tvaRate / 100)
return s + toCents(round2(lineHt)) // arrondi par ligne
```
L'arrondi par ligne est volontaire et documenté. Risque maîtrisé.

---

## 2. `stores/cart.ts` — ✅ Correct

Le store délègue entièrement à `cartUtils.ts` pour les calculs :
```typescript
import { getFinalPrice, totalTTC, totalHT, totalTVA } from '@/utils/cartUtils'
```
Aucune arithmétique financière directe dans le store. Seul point notable :
```typescript
const itemDiscount = Math.round(globalDiscount.value * proportion * 100) / 100
```
(dans `applyGlobalDiscountToItems`) — arrondi à 2 décimales, acceptable pour une remise affichée à l'écran.

---

## 3. `server/api/sales/create.post.ts` — ⚠️ Risques identifiés

### Méthode utilisée
Float JS natif + `toFixed(2)` pour le stockage en DB (les totaux sont stockés comme strings).

### Risque 1 — Le serveur fait confiance aux totaux envoyés par le client ⚠️

```typescript
totalHT: Number(body.totals.totalHT).toString(),
totalTVA: Number(body.totals.totalTVA).toString(),
totalTTC: Number(body.totals.totalTTC).toString(),
```

Le serveur n'effectue **aucun recalcul** des totaux. Il utilise les valeurs envoyées par le frontend. Un client malveillant ou un bug frontend pourrait envoyer des totaux incohérents qui seraient acceptés et stockés tels quels.

**Impact fiscal** : les totaux de clôture NF525 sont calculés à partir de ces valeurs non vérifiées.

### Risque 2 — Calcul `totalTTC` par ligne en float ⚠️

```typescript
const totalTTC = item.unitPrice * item.quantity
const totalHT = totalTTC / (1 + item.tva / 100)
```

Multiplication et division en float JS sans `Math.round`. Pour des valeurs comme `1.10 * 3 = 3.3000000000000003`.

Ces valeurs sont ensuite stockées via `.toFixed(2)` ce qui corrige l'affichage, mais le hash NF525 utilise `item.quantity * item.unitPrice` directement :

```typescript
// Dans la construction du TicketData pour le hash
totalTTC: item.quantity * item.unitPrice,  // ← float non arrondi
```

Le hash est donc calculé sur un float brut, ce qui est **cohérent** (le même calcul sera répété à l'identique lors d'une vérification), mais diffère du montant stocké en DB (arrondi via toFixed).

### Risque 3 — `globalDiscount` ignoré dans le calcul de `totalHT`/`totalTVA` par ligne

La remise globale est stockée en DB mais **n'est pas utilisée** pour recalculer les `totalHT` et `totalTVA` des `saleItems`. Les lignes en DB reflètent le prix unitaire après remise de ligne uniquement.

### Arrondis utilisés
| Opération | Méthode | Cohérence |
|---|---|---|
| Stockage totalHT/TTC/TVA global | `.toString()` sur Number du client | Dépend du client |
| Stockage saleItems.totalHT | `totalHT.toFixed(2)` | ✅ |
| Stockage saleItems.totalTTC | `totalTTC.toFixed(2)` | ✅ |
| Hash NF525 amounts | `toFixed(2)` via nf525.ts | ✅ |
| tvaCode | `tvaRate.toFixed(2)` | ✅ |

---

## 4. `server/api/sales/close-day.post.ts` — ⚠️ Risques identifiés

### Méthode utilisée
Accumulation de floats via `reduce`, puis `toFixed(2)` pour le stockage.

### Risque 1 — Accumulation de floats dans reduce ⚠️

```typescript
const totalTTC = activeSales.reduce((sum, s) => sum + Number(s.totalTTC), 0)
const totalHT = activeSales.reduce((sum, s) => sum + Number(s.totalHT), 0)
const totalTVA = activeSales.reduce((sum, s) => sum + Number(s.totalTVA), 0)
```

`Number(s.totalTTC)` parse une string DB (`"10.50"`) en float. L'accumulation de N floats peut dériver. Exemple classique : `0.1 + 0.2 = 0.30000000000000004`.

Pour un jour avec 100 ventes à ~50€, l'erreur cumulée reste inférieure à 0.01€ (< 1 centime) dans la grande majorité des cas, mais **n'est pas garantie**.

### Risque 2 — Pas de vérification `totalHT + totalTVA = totalTTC` ⚠️

Aucune assertion que la somme des colonnes est cohérente. En cas de bug upstream (Risque 1 de create.post.ts), les totaux de clôture peuvent diverger silencieusement.

### Risque 3 — Hash de clôture inclut des floats arrondis post-hoc

```typescript
const closureData = {
  totalHT: totalHT.toFixed(2),   // float réduit à string
  totalTVA: totalTVA.toFixed(2),
  totalTTC: totalTTC.toFixed(2),
  ...
}
const closureHash = crypto.createHash('sha256').update(JSON.stringify(closureData)).digest('hex')
```

Le hash est calculé après `toFixed(2)`, donc il est déterministe. Mais la valeur `toFixed(2)` d'un float accumulé peut différer d'un recalcul depuis les centimes. **Non critique actuellement** (le hash est généré une seule fois), mais difficile à reproduire indépendamment.

### Point positif
- Les totaux par mode de paiement (`paymentMethods`) sont des `number` accumulés, mais stockés directement — pas de `.toFixed(2)`, ce qui est acceptable pour des montants de paiement.

---

## 5. `server/utils/nf525.ts` — ✅ Neutre (hashing seulement)

Ce fichier ne fait pas de calculs financiers propres. Il reçoit des montants déjà calculés et les hashe.

Points à noter :
- `toFixed(2)` systématique sur tous les montants inclus dans le hash ✅
- `item.quantity * item.unitPrice` sans arrondi pour `totalTTC` dans le hash ⚠️ (voir Risque 2 de create.post.ts)
- Cohérence garantie car le même calcul est reproduit à chaque vérification

---

## Recommandations (par priorité)

### P1 — ✅ Corrigé (2026-03-15)
**Validation des totaux côté serveur** dans `create.post.ts` :
- `recomputeTotalTTC(parsedItems)` recalcule le totalTTC en centimes entiers
- `validateTotalTTC(declared, recomputed, 2)` rejette les ventes avec écart > 2 centimes
- Implémenté dans `server/utils/financialValidation.ts` avec 16 tests unitaires

### P2 — ✅ Corrigé (2026-03-15)
**Accumulation en centimes entiers** dans `close-day.post.ts` :
- 3 reduces float remplacés par accumulation en centimes (`Math.round(... * 100)`)
- Résultat divisé par 100 pour revenir en euros

### P3 — ✅ Corrigé (2026-03-15)
**Assertion `HT + TVA = TTC`** dans `close-day.post.ts` :
- `assertHTplusTVAequalsTTC(totalHT, totalTVA, totalTTC, 'close-day')` appelé après calcul des totaux
- Loggue un `warn` Pino si écart > 1 centime — ne bloque pas la clôture

### P4 — ✅ Corrigé (2026-03-15)
**Alignement hash NF525** dans `server/utils/nf525.ts` :
- `${item.totalTTC}` remplacé par `Number(item.totalTTC).toFixed(2)` dans la template literal du hash
- Le hash utilise désormais la même représentation 2dp que la DB
- Impact : nouveaux tickets uniquement — hashes existants non affectés

---

## Conclusion

L'implémentation côté **frontend** (`cartUtils.ts`) est de bonne qualité — centimes + LRM. Le risque principal est côté **serveur** : les totaux envoyés par le client sont acceptés sans vérification, et les accumulateurs de clôture utilisent des floats JS bruts. Ces deux points méritent correction avant mise en production haute volumétrie.
