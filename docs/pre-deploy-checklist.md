# Checklist pré-déploiement production

> Points à valider avant tout déploiement en production.
> Tient à jour les vérifications opérationnelles que les tests automatisés ne couvrent pas.

---

## 🛡️ Sécurité

### Q10 — Rate limiting (commit `e0087df`)

Limites actuelles dans [server/middleware/rateLimit.global.ts](../server/middleware/rateLimit.global.ts) :

| Catégorie | Limite | Application |
|---|---|---|
| `sales-create` | 30/min/user | `POST /api/sales/create` |
| `mutation` | 60/min/user | autres POST/PUT/PATCH/DELETE |
| `read` | 300/min/user | GET / HEAD |
| `public` | 5/min/IP | endpoints non-auth (signup, etc.) |

**À valider avec un usage réel** :
- Si une boutique enregistre plus de 30 ventes/min en rush : augmenter `SALES_CREATE.limit`
- Si un utilisateur effectue plus de 60 mutations/min légitimes (import en masse, sync manuelle) : augmenter `MUTATION.limit` ou exclure les routes concernées
- Surveiller les logs `Rate limit exceeded` — si trop fréquents pour des usages légitimes, ajuster

**Limite architecturale assumée** : single-instance. Si déploiement en cluster/pods (N instances), la limite effective globale = N × `limit`. Pour rate limit distribué réel : migrer le store vers Redis (la signature `checkLimit` reste compatible).

### Q11 — CSP `unsafe-eval` retiré en prod (commit `99d7d08`)

En production, `script-src` n'autorise plus `'unsafe-eval'` (renforce la défense XSS).

**Validation requise avant prod** :
1. Build prod : `pnpm build` puis `pnpm preview` (ou déploiement staging)
2. Ouvrir la console navigateur (F12) sur les flux critiques :
   - `/caisse` (flow vente complet : ajout produit, paiement, ticket)
   - `/login` (Supabase Auth)
   - `/produits/[id]/edit` (formulaire complexe avec variations)
   - `/etablissements/synchronisation` (resync inter-établissements)
3. **Vérifier qu'aucune erreur du type `Refused to evaluate ... unsafe-eval` n'apparaît**
4. Si une lib tierce dépend de `eval`/`Function()` : identifier la lib et soit la remplacer, soit remettre `'unsafe-eval'` (revert temporaire dans [nuxt.config.ts](../nuxt.config.ts) ligne 79-83)

---

## 🧾 Conformité NF525 (risques ouverts CLAUDE.md)

### Signature INFOCERT temporaire

[server/utils/nf525.ts:157](../server/utils/nf525.ts#L157) — `TEMP_SIGNATURE_*` tant que `INFOCERT_PRIVATE_KEY` absente.

**Bloquant pour certification fiscale.** À ne pas déployer en prod sans :
1. Obtenir un certificat INFOCERT auprès d'un prestataire agréé (délai 1-2 semaines)
2. Implémenter la signature RSA avec la clé privée
3. Stocker la clé via vault/HSM (pas en variable d'env claire)

### Numérotation NF525 décalée par `isActive`

[server/api/sales/create.post.ts:175](../server/api/sales/create.post.ts#L175) — désactiver un établissement décale les numéros suivants.

**À ne JAMAIS faire en prod sans audit** :
- Désactiver un établissement actif (NF525 exige une numérotation continue par établissement)
- Si nécessaire : prévoir une migration data + audit log avant tout `isActive=false` en prod

---

## 🗄️ Données et migrations

- Vérifier qu'aucune migration Drizzle non appliquée n'est présente (`pnpm db:migrate --dry-run` ou équivalent)
- Vérifier que `.env.production` contient `INFOCERT_PRIVATE_KEY` (si signature implémentée), `DATABASE_URL`, `SUPABASE_*`, `JWT_SECRET`
- Vérifier que `ALLOW_AUTH_BYPASS` est **absent** ou `false` (le boot fail-closed depuis Q2 mais double-check)

---

## 🧪 Tests

- `pnpm vitest run --coverage=false` doit passer (cible : 100% verts)
- `pnpm typecheck` doit passer (sources hors `docs/legacy-migrations/` qui sont des fichiers archivés non TS-checkés)

---

*Dernière mise à jour : 2026-04-24 — créé suite à la clôture de la série Q (audit sécurité)*
