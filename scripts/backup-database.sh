#!/usr/bin/env bash
# ==========================================
# Backup PostgreSQL → GPG → Cloudflare R2 (C3)
# ==========================================
#
# Pré-requis (env vars) :
#   BACKUP_DATABASE_URL    Postgres direct ou session pooler. User read-only recommandé.
#   BACKUP_GPG_PUBLIC_KEY  Clé GPG publique ASCII-armored (recipient = nous-mêmes).
#   R2_ACCESS_KEY_ID       Cloudflare R2 access key.
#   R2_SECRET_ACCESS_KEY   Cloudflare R2 secret.
#   R2_BUCKET              Nom du bucket (ex: pos-app-backups).
#   R2_ENDPOINT            https://<account_id>.r2.cloudflarestorage.com
#
# Voir docs/runbooks/backup-restore.md pour le setup complet et la restauration.

set -euo pipefail

# ------ Validation des inputs ------
: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL manquant}"
: "${BACKUP_GPG_PUBLIC_KEY:?BACKUP_GPG_PUBLIC_KEY manquant}"
: "${R2_ACCESS_KEY_ID:?R2_ACCESS_KEY_ID manquant}"
: "${R2_SECRET_ACCESS_KEY:?R2_SECRET_ACCESS_KEY manquant}"
: "${R2_BUCKET:?R2_BUCKET manquant}"
: "${R2_ENDPOINT:?R2_ENDPOINT manquant}"

# ------ Workspace temporaire isolé ------
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

DATE_DIR=$(date -u +%Y-%m-%d)
TS=$(date -u +%Y%m%dT%H%M%SZ)
BASENAME="pos-app-${TS}.pgdump"
DUMP_FILE="$TMP_DIR/$BASENAME"
ENC_FILE="${DUMP_FILE}.gpg"
R2_KEY="${DATE_DIR}/${BASENAME}.gpg"

# ------ pg_dump ------
echo "→ pg_dump (format custom, compress 9, no-owner, no-privileges)..."
pg_dump \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file="$DUMP_FILE" \
  "$BACKUP_DATABASE_URL"

DUMP_SIZE=$(stat -c%s "$DUMP_FILE")
echo "  dump size: $DUMP_SIZE bytes"

# ------ GPG encrypt ------
echo "→ Import clé GPG publique dans keyring isolé..."
GNUPGHOME="$TMP_DIR/gpg"
mkdir -p "$GNUPGHOME"
chmod 700 "$GNUPGHOME"
export GNUPGHOME

echo "$BACKUP_GPG_PUBLIC_KEY" | gpg --batch --import 2>&1 | sed 's/^/  /'

FPR=$(gpg --list-keys --with-colons | awk -F: '/^fpr:/ {print $10}' | head -1)
if [ -z "$FPR" ]; then
  echo "ERREUR : impossible d'extraire le fingerprint GPG après import" >&2
  exit 1
fi
echo "  recipient fingerprint: $FPR"

echo "→ Chiffrement du dump..."
gpg \
  --batch \
  --yes \
  --trust-model always \
  --encrypt \
  --recipient "$FPR" \
  --output "$ENC_FILE" \
  "$DUMP_FILE"

ENC_SIZE=$(stat -c%s "$ENC_FILE")
echo "  encrypted size: $ENC_SIZE bytes"

# ------ Upload R2 (S3-compatible) ------
echo "→ Upload vers R2 : s3://$R2_BUCKET/$R2_KEY"
AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
AWS_REGION=auto \
aws s3 cp "$ENC_FILE" "s3://$R2_BUCKET/$R2_KEY" \
  --endpoint-url "$R2_ENDPOINT" \
  --no-progress

echo "✓ Backup OK : s3://$R2_BUCKET/$R2_KEY ($ENC_SIZE bytes chiffrés, $DUMP_SIZE bytes en clair)"
