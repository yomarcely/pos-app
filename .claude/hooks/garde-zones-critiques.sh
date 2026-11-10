#!/bin/bash
# Garde-fou sur les éditions de fichiers (hooks PreToolUse et PostToolUse, outils Edit|Write|MultiEdit).
#
#   garde-zones-critiques.sh pre   → avant l'édition : refuse ou demande confirmation
#   garde-zones-critiques.sh post  → après une édition acceptée : mémorise la confirmation
#
# Deux comportements, qui rendent mécaniques des règles de CLAUDE.md :
#   1. Migrations Drizzle : édition REFUSÉE (règle absolue n°1). Une migration se crée avec
#      `pnpm db:generate`, jamais à la main, et une migration existante ne se modifie pas.
#   2. Zones critiques : confirmation de Yohan demandée, une fois par fichier et par session.
#      Le « post » ne s'exécute que si l'édition a réellement eu lieu, donc seulement après un
#      accord : c'est lui qui pose le marqueur. Un refus ne pose rien, la question sera reposée.
#
# Limite connue : ne voit que les outils d'édition. Une modification par commande shell
# (sed -i, perl -pi, redirection) ne passe pas par ici.
#
# Compatible bash 3.2 (celui de macOS). Sans jq, le garde-fou se désactive au lieu de bloquer.

mode="${1:-pre}"

if ! command -v jq >/dev/null 2>&1; then
  echo "garde-zones-critiques : jq introuvable, garde-fou inactif" >&2
  exit 0
fi

entree=$(cat)
fichier=$(printf '%s' "$entree" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
session=$(printf '%s' "$entree" | jq -r '.session_id // "sans-session"' 2>/dev/null | tr -cd 'A-Za-z0-9_-')
[ -n "$fichier" ] || exit 0

racine="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd)}"
rel="${fichier#"$racine"/}"
# Fichier hors du dépôt : pas concerné.
[ "$rel" != "$fichier" ] || exit 0

decider() { # $1 = deny | ask, $2 = raison affichée
  jq -n --arg d "$1" --arg r "$2" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: $d, permissionDecisionReason: $r}}'
  exit 0
}

# Les motifs entre guillemets sont comparés littéralement (pas de joker).
raison_zone() {
  case "$1" in
    "server/api/sales/create.post.ts")   echo "création de vente et chaîne NF525 — tests de régression d'abord (règles 3 et 4)" ;;
    "server/api/sales/close-day.post.ts") echo "clôture de journée et hash NF525 — tests de régression d'abord (règles 3 et 4)" ;;
    "server/utils/nf525.ts")             echo "hash, chaînage et numérotation NF525 — toute modification du hash invalide les chaînes existantes (invariant 7)" ;;
    "server/utils/financialValidation.ts") echo "calculs financiers côté serveur, en centimes — tests de régression d'abord (règle 4)" ;;
    "server/database/schema.ts")         echo "schéma de la base — inventorier les endpoints impactés avant de modifier (règle 2)" ;;
    "stores/cart.ts")                    echo "logique du panier, calculs en centimes — tests de régression d'abord (règle 4)" ;;
    "utils/cartUtils.ts")                echo "calculs du panier en centimes — tests de régression d'abord (règle 4)" ;;
    "stores/establishmentRegister.ts")   echo "sélection établissement/caisse, persistance scopée par tenant" ;;
    "server/utils/supabase.ts")          echo "authentification et clé service role — repasser toute la chaîne assertAuth → event.context.auth → getTenantIdFromEvent (règle 6)" ;;
    "server/middleware/auth.global.ts")  echo "middleware d'authentification, PUBLIC_ENDPOINTS et CRON_ENDPOINTS — audit sécurité requis pour toute nouvelle entrée (règle 8)" ;;
    "server/utils/tenant.ts")            echo "lecture du tenant, base de l'isolation multi-tenant" ;;
    "CLAUDE.md")                         echo "contrat de travail — son en-tête exige une validation explicite avant toute modification" ;;
    *) return 1 ;;
  esac
}

cle=$(printf '%s' "$rel" | tr -c 'A-Za-z0-9._-' '_')
dossier="${TMPDIR:-/tmp}/claude-fympos-zones/${session:-sans-session}"
marqueur="$dossier/$cle"

if [ "$mode" = "post" ]; then
  if raison_zone "$rel" >/dev/null; then
    mkdir -p "$dossier" 2>/dev/null && : > "$marqueur" 2>/dev/null
  fi
  exit 0
fi

case "$rel" in
  server/database/migrations/*|server/database/migrations-archive/*)
    decider deny "Règle absolue n°1 : on ne modifie pas une migration Drizzle à la main ($rel). Modifier server/database/schema.ts puis lancer pnpm db:generate pour créer une NOUVELLE migration. Si une retouche manuelle est vraiment nécessaire, c'est à Yohan de la faire dans son éditeur."
    ;;
esac

if raison=$(raison_zone "$rel"); then
  [ -f "$marqueur" ] && exit 0
  decider ask "Zone critique FymPOS : $rel — $raison. Confirmation demandée une fois par fichier et par session."
fi

exit 0
