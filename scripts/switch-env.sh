#!/bin/bash

##
# Script pour basculer entre les environnements
# Usage: ./scripts/switch-env.sh [development|staging|production]
##

set -e

ENV=${1:-development}

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 Changement d'environnement vers: ${ENV}${NC}\n"

# Vérifier que l'environnement est valide
if [[ ! "$ENV" =~ ^(development|staging|production)$ ]]; then
    echo -e "${RED}❌ Environnement invalide: ${ENV}${NC}"
    echo "Usage: ./scripts/switch-env.sh [development|staging|production]"
    exit 1
fi

# Vérifier que le fichier existe
ENV_FILE=".env.${ENV}"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Le fichier ${ENV_FILE} n'existe pas${NC}"
    echo "Créez-le à partir de .env.example :"
    echo "  cp .env.example ${ENV_FILE}"
    exit 1
fi

# Créer un backup du .env actuel
if [ -f ".env" ]; then
    cp .env .env.backup
    echo -e "${YELLOW}📦 Backup créé: .env.backup${NC}"
fi

# Copier le fichier d'environnement
cp "$ENV_FILE" .env
echo -e "${GREEN}✅ Fichier .env mis à jour depuis ${ENV_FILE}${NC}\n"

# Afficher les informations
echo "📊 Configuration actuelle :"
if [ -f ".env" ]; then
    echo "   - NODE_ENV=$(grep NODE_ENV .env | cut -d '=' -f2)"
    echo "   - PORT=$(grep PORT .env | cut -d '=' -f2 || echo '3000')"
    echo "   - BASE_URL=$(grep BASE_URL .env | cut -d '=' -f2)"
fi

echo ""
echo -e "${GREEN}✨ Prêt à démarrer !${NC}"
echo ""
echo "Commandes suggérées :"
echo "  npm run dev       # Démarrer le serveur de développement"
echo "  npm run build     # Build l'application"
echo "  npm run db:studio # Ouvrir Drizzle Studio"
echo ""
