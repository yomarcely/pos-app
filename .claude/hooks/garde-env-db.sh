#!/bin/bash
# Garde-fou sur les commandes shell qui touchent une base de données (hook PreToolUse, outil Bash).
#
# Le danger visé : `pnpm env:switch` remplace .env par celui de staging ou de prod. Après ça,
# `pnpm db:migrate` ou `pnpm db:seed` visent une vraie base sans que rien ne l'indique.
#
#   - Commande qui écrit dans la base (migrations, push, seed, drop, scripts de réparation) :
#       REFUSÉE si .env ne pointe pas sur la base de développement, si la commande bascule
#       elle-même d'environnement, ou si elle fournit une adresse de base non locale.
#       Sur staging et prod, ces opérations se font à la main en suivant le runbook.
#   - psql hors base de développement : confirmation demandée, pour laisser possibles les
#       vérifications en lecture seule du runbook.
#   - Appel de l'endpoint resync : confirmation demandée dans tous les cas (règle absolue n°5).
#
# L'environnement actif est déduit en comparant .env aux .env.<nom> octet à octet, sans en
# lire une ligne. Sur la base de développement, ce script ne dit rien : les confirmations
# ordinaires de .claude/settings.json s'appliquent.
#
# Compatible bash 3.2 (celui de macOS). Sans jq, le garde-fou se désactive au lieu de bloquer.

if ! command -v jq >/dev/null 2>&1; then
  echo "garde-env-db : jq introuvable, garde-fou inactif" >&2
  exit 0
fi

cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null)
[ -n "$cmd" ] || exit 0

contient() { printf '%s' "$cmd" | grep -Eq -- "$1"; }

RE_ECRITURE='(pnpm|npm|npx|yarn)( +(run|exec))? +db:(migrate|push|seed|drop)|drizzle-kit +(migrate|push|drop)|mark-migrations-applied|repair-migrations|reset-migrations|sync-sequences|database/seed\.ts|seed-tax-rates'
RE_PSQL='(^|[^A-Za-z0-9_./-])psql( |$)'
RE_RESYNC='(curl|wget|fetch|http)[^|;&]*sync-groups/[^ ]*/resync'
RE_BASCULE='env:(staging|prod|switch)|switch-env\.sh'
RE_ADRESSE='(DATABASE_URL|DB_HOST)='
RE_ADRESSE_LOCALE='(DATABASE_URL|DB_HOST)=[^ ]*(localhost|127\.0\.0\.1)'

ecriture=0; psql=0; resync=0
contient "$RE_ECRITURE" && ecriture=1
contient "$RE_PSQL" && psql=1
contient "$RE_RESYNC" && resync=1

# La très grande majorité des commandes s'arrête ici.
[ $((ecriture + psql + resync)) -gt 0 ] || exit 0

decider() { # $1 = deny | ask, $2 = raison affichée
  jq -n --arg d "$1" --arg r "$2" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: $d, permissionDecisionReason: $r}}'
  exit 0
}

racine="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd)}"
env_actif="inconnu"
if [ ! -f "$racine/.env" ]; then
  env_actif="absent"
else
  for e in development staging production; do
    if [ -f "$racine/.env.$e" ] && cmp -s "$racine/.env" "$racine/.env.$e"; then env_actif="$e"; fi
  done
fi

if [ "$resync" -eq 1 ]; then
  decider ask "Règle absolue n°5 : resync est une opération destructive, à ne lancer que dans un contexte de test isolé. Environnement actif : $env_actif."
fi

adresse_distante=0
if contient "$RE_ADRESSE" && ! contient "$RE_ADRESSE_LOCALE"; then adresse_distante=1; fi
adresse_locale=0
contient "$RE_ADRESSE_LOCALE" && adresse_locale=1

if [ "$ecriture" -eq 1 ]; then
  # Base locale jetable désignée explicitement dans la commande : .env n'entre pas en jeu.
  if [ "$adresse_locale" -eq 1 ] && [ "$adresse_distante" -eq 0 ] && ! contient "$RE_BASCULE"; then
    exit 0
  fi
  if [ "$adresse_distante" -eq 1 ]; then
    decider deny "Commande d'écriture en base avec une adresse de base non locale fournie dans la commande. Refusé : sur une base distante, cette opération se fait à la main en suivant le runbook."
  fi
  if contient "$RE_BASCULE"; then
    decider deny "Cette commande bascule d'environnement PUIS écrit dans la base : elle viserait staging ou prod. Refusé : les migrations hors base de développement se font à la main en suivant docs/runbooks/deploy-staging-vercel.md."
  fi
  if [ "$env_actif" != "development" ]; then
    decider deny "Le fichier .env ne pointe pas sur la base de développement (environnement actif : $env_actif). Commande d'écriture en base refusée. Revenir sur dev avec pnpm env:dev, ou lancer l'opération à la main en suivant le runbook si elle vise bien $env_actif."
  fi
  exit 0
fi

if [ "$psql" -eq 1 ]; then
  if [ "$env_actif" != "development" ] || [ "$adresse_distante" -eq 1 ] || contient "$RE_BASCULE"; then
    decider ask "psql hors base de développement (environnement actif : $env_actif ; bascule ou adresse distante dans la commande possible). Vérifier que la requête est en lecture seule, ou qu'une écriture est bien voulue sur cette base."
  fi
fi

exit 0
