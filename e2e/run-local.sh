#!/usr/bin/env bash
set -euo pipefail

# Lance le smoke test e2e en local, de bout en bout : Postgres jetable (Docker)
# + migrations + seed + build de production + Playwright.
#
# Usage : pnpm e2e:local
# Prérequis : Docker, et les variables d'environnement listées dans e2e/README.md
# (projet Supabase de test + utilisateur de test).
#
# Le serveur Nuxt buildé (node .output/server/index.mjs) est démarré et arrêté
# automatiquement par playwright.config.ts (option webServer) — ce script ne
# gère que la base de données jetable, qu'il détruit toujours en sortie (trap),
# même en cas d'échec des tests.

cd "$(dirname "${BASH_SOURCE[0]}")/.."

: "${SUPABASE_URL:?Variable SUPABASE_URL manquante — voir e2e/README.md}"
: "${SUPABASE_ANON_KEY:?Variable SUPABASE_ANON_KEY manquante — voir e2e/README.md}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Variable SUPABASE_SERVICE_ROLE_KEY manquante — voir e2e/README.md}"
: "${E2E_USER_EMAIL:?Variable E2E_USER_EMAIL manquante — voir e2e/README.md}"
: "${E2E_USER_PASSWORD:?Variable E2E_USER_PASSWORD manquante — voir e2e/README.md}"

CONTAINER_NAME="fympos-e2e-postgres"
DB_PORT="${E2E_DB_PORT:-5433}"
SERVER_PORT="${PORT:-3000}"

# Base de données jetable, dédiée, sur un port distinct du Postgres de dev local
# (5433 par défaut) pour ne jamais toucher une base de développement existante.
export DB_HOST=localhost
export DB_PORT="$DB_PORT"
export DB_USER=postgres
export DB_PASSWORD=postgres
export DB_NAME=fympos_e2e
export DB_SSL=false
unset DATABASE_URL || true

export SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
export NODE_ENV=production
export PORT="$SERVER_PORT"
export BASE_URL="http://localhost:${SERVER_PORT}"
export E2E_BASE_URL="$BASE_URL"
export RUN_SEED=1
# Règle absolue CLAUDE.md n°9 : jamais de bypass d'auth, même en local.
unset ALLOW_AUTH_BYPASS || true

cleanup() {
  local status=$?
  echo "→ Nettoyage (arrêt du Postgres jetable)..."
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  exit $status
}
trap cleanup EXIT INT TERM

echo "→ Postgres jetable (Docker, port ${DB_PORT})..."
docker run --rm -d --name "$CONTAINER_NAME" \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB="$DB_NAME" \
  -p "${DB_PORT}:5432" \
  postgres:16 >/dev/null

echo "→ Attente de disponibilité de Postgres..."
for _ in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "→ Migrations (pnpm db:migrate)..."
pnpm db:migrate

echo "→ Seed (pnpm db:seed)..."
pnpm db:seed

echo "→ Build de production (pnpm build)..."
pnpm build

echo "→ Playwright (le serveur buildé est démarré/arrêté automatiquement)..."
pnpm exec playwright test
