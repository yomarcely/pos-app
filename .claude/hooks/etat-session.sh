#!/bin/bash
# Résumé injecté dans le contexte de Claude au démarrage de chaque session (hook SessionStart).
#
# Contrat : lecture seule, rapide, ne doit jamais échouer ni afficher le contenu d'un .env.
# L'environnement actif est déduit en comparant .env aux .env.<nom> octet à octet (cmp),
# sans jamais en lire une ligne.

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

branche=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

if git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
  n=$(git rev-list --count '@{u}..HEAD' 2>/dev/null)
  if [ "${n:-0}" -gt 0 ]; then pousse="$n commit(s) non poussé(s)"; else pousse="à jour avec la distante (d'après les refs locales)"; fi
else
  pousse="JAMAIS POUSSÉE — ce travail n'existe que sur cette machine"
fi

modifies=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
dernier=$(git log -1 --format='%ad' --date=short 2>/dev/null)

if [ ! -f .env ]; then
  env_actif="aucun fichier .env"
else
  env_actif="inconnu (.env ne correspond à aucun .env.<nom>)"
  for e in development staging production; do
    if [ -f ".env.$e" ] && cmp -s .env ".env.$e"; then env_actif="$e"; fi
  done
fi

echo "[FymPOS — état au démarrage de la session]"
echo "Branche : $branche — $pousse"
echo "Fichiers modifiés non commités : $modifies"
echo "Dernier commit : $dernier"
echo "Environnement actif (.env) : $env_actif"
if [ "$env_actif" != "development" ]; then
  echo "ATTENTION : .env ne pointe pas sur la base de développement. Aucune commande db:migrate, db:push, db:seed ni resync sans accord explicite de Yohan. Revenir sur dev : pnpm env:dev"
fi

if git rev-parse --verify -q main >/dev/null && git rev-parse --verify -q developpement >/dev/null; then
  retard=$(git rev-list --count main..developpement 2>/dev/null)
  if [ "${retard:-0}" -gt 0 ]; then
    echo "main (staging) a $retard commit(s) de retard sur developpement"
  fi
fi

if [ -f docs/etat-projet.md ]; then
  verif=$(grep -m1 -o 'Dernière vérification : [0-9-]*' docs/etat-projet.md 2>/dev/null)
  echo "Page d'état : docs/etat-projet.md (${verif:-date de vérification absente}) — la lire avant d'agir. Briefing complet : /debut-session"
fi

exit 0
