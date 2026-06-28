# Runbook — Export & intégrité des archives NF525 (Cloudflare R2)

> Objet : donner une **valeur probante** aux archives NF525 en les externalisant dans un stockage immuable.
> Endpoints : [server/api/archives/create.post.ts](../../server/api/archives/create.post.ts), [server/api/archives/[id]/export.post.ts](../../server/api/archives/[id]/export.post.ts). Util : [server/utils/r2Storage.ts](../../server/utils/r2Storage.ts).

---

## 1. Pourquoi

L'archive NF525 était « signée » par un SHA-256 d'elle-même (`archiveSignature = sha256(hash + période)`) **stocké en clair dans la même base que les données**. Quiconque a accès à la DB peut modifier l'archive **et** recalculer la signature → **valeur probante nulle**.

Correctif : chaque archive est poussée dans le bucket **Cloudflare R2** (le même que les backups, cf [backup-restore.md](backup-restore.md)), sous le préfixe `archives/{tenantId}/`, avec son **hash SHA-256 en métadonnée d'objet**. Couplé à l'**Object Lock** (immuabilité WORM), le hash devient invérifiable depuis la DB seule : l'objet R2 fait foi.

> ⚠️ La signature légale réelle (organisme accrédité INFOCERT) reste un TODO dans [nf525.ts](../../server/utils/nf525.ts) (`generateTicketSignature`). L'export R2 est une mesure d'intégrité intermédiaire, **pas** un substitut à la certification (l'auto-attestation éditeur n'est plus admise — loi de finances 2025).

---

## 2. Configuration (runtime serveur)

L'export réutilise **les credentials du workflow de backup**. Quatre variables d'environnement côté serveur (cf [nuxt.config.ts](../../nuxt.config.ts) → `runtimeConfig.r2`) :

| Variable | Valeur |
|---|---|
| `R2_ACCESS_KEY_ID` | Access Key R2 (droits `Object Read & Write` sur le bucket) |
| `R2_SECRET_ACCESS_KEY` | Secret R2 |
| `R2_BUCKET` | ex `pos-app-backups` (ou un bucket dédié archives) |
| `R2_ENDPOINT` | `https://<account_id>.r2.cloudflarestorage.com` |

> Le backup tourne dans GitHub Actions ; ces secrets y sont déjà configurés. Pour que **l'app** exporte les archives, ces variables doivent aussi être présentes dans l'environnement du **runtime serveur** (Vercel / VPS / conteneur). Si elles sont absentes, voir §4 (mode dégradé).

### Action manuelle Cloudflare recommandée (une fois)

1. **Object Lock** : activer le mode **Compliance** (ou Governance) avec une rétention de **6 ans** (2190 jours) sur le bucket d'archives. C'est ce qui rend l'objet réellement non modifiable/non supprimable — sans cela, l'export n'apporte qu'une copie hors-DB, pas de l'immuabilité.
2. À défaut d'Object Lock : activer au minimum le **versioning** du bucket (toute écrasure conserve l'ancienne version).
3. Lifecycle : ne **pas** poser de règle de suppression < 6 ans sur le préfixe `archives/` (conservation légale NF525).

---

## 3. Flux nominal

1. `POST /api/archives/create` génère le JSON, calcule `archiveHash = sha256(contenu)`.
2. Si R2 est configuré : upload `archives/{tenantId}/archive-{période}[-register-{id}].json` avec les métadonnées objet `x-amz-meta-archive-hash`, `x-amz-meta-tenant-id`, `x-amz-meta-period`.
3. Succès → `exportStatus = 'exported'`, `storageKey` renseignée, `filePath = r2:{key}`, `content` DB effacé (R2 fait foi).

---

## 4. Mode dégradé (`pending_export`)

Si R2 est indisponible (credentials absents) **ou** si l'upload échoue, **le flux ne casse pas** :

- l'archive est créée avec `exportStatus = 'pending_export'` ;
- son **contenu JSON est conservé en DB** (colonne `content`) pour permettre un ré-export à hash identique ;
- `filePath = inline:{fichier}`.

### Ré-exporter les archives en attente

```bash
# Lister les archives en attente (via l'API liste — champ exportStatus)
curl -s -H "Authorization: Bearer <token>" -H "x-tenant-id: <tenant>" \
  https://<app>/api/archives | jq '.archives[] | select(.exportStatus=="pending_export") | .id'

# Ré-exporter une archive (rôle manager minimum)
curl -X POST -H "Authorization: Bearer <token>" -H "x-tenant-id: <tenant>" \
  https://<app>/api/archives/<id>/export
```

Le ré-export **recalcule le hash du contenu DB et le compare au `archiveHash` stocké** : divergence → HTTP 409 (`Intégrité compromise`), l'upload est refusé. C'est un garde-fou anti-altération de la copie DB temporaire.

---

## 5. Vérification d'intégrité (DB ↔ R2)

À faire lors d'un contrôle ou d'un audit trimestriel. On compare le hash stocké en DB au hash de l'objet R2.

```bash
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export AWS_REGION=auto

KEY="archives/<tenantId>/archive-<période>.json"

# 1. Métadonnée hash enregistrée à l'upload (source : l'app au moment de la création)
aws s3api head-object --bucket "$R2_BUCKET" --key "$KEY" \
  --endpoint-url "$R2_ENDPOINT" --query 'Metadata' --output json

# 2. Hash réel de l'objet stocké (recalculé sur le contenu téléchargé)
aws s3 cp "s3://$R2_BUCKET/$KEY" - --endpoint-url "$R2_ENDPOINT" | sha256sum
```

Les trois valeurs doivent coïncider :

| Source | Valeur attendue |
|---|---|
| `archives.archive_hash` (DB) | hash A |
| `x-amz-meta-archive-hash` (métadonnée R2) | hash A |
| `sha256sum` du contenu objet R2 | hash A |

- **DB = méta R2 = sha256(objet)** → intègre.
- **DB ≠ méta R2** → la DB a été modifiée après export (ou l'objet remplacé) : se référer à la version verrouillée par Object Lock, qui fait foi.
- **méta R2 ≠ sha256(objet)** → l'objet a été remplacé sans Object Lock : escalade incident, consulter l'historique de versions.

---

## 6. Limites connues

- **Object Lock = action manuelle Cloudflare.** Tant qu'il n'est pas activé, l'export n'apporte qu'une copie hors-DB ; l'immuabilité n'est pas garantie.
- **Signature légale INFOCERT non implémentée** (TODO `nf525.ts`). Le hash R2 prouve l'intégrité, pas l'horodatage qualifié ni la non-répudiation par tiers de confiance.
- **Pas de re-vérification automatique** au runtime : la vérification §5 est manuelle/périodique.
- **`content` DB effacé après export réussi** : le ré-export n'est possible que pour les archives encore `pending_export`. Une archive `exported` se re-télécharge depuis R2.
