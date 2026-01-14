#!/bin/bash

# =============================================================================
# Script de Migration - POS App Amélioration
# =============================================================================
# Ce script guide l'exécution du plan d'amélioration par phases
# Usage: ./scripts/migration-plan.sh [phase]
# =============================================================================

set -e  # Arrêter en cas d'erreur

# Couleurs pour output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction d'aide
show_help() {
    echo "Usage: $0 [phase]"
    echo ""
    echo "Phases disponibles:"
    echo "  phase1    - Sécurité & Conformité (URGENT)"
    echo "  phase2    - Qualité Code & Tests"
    echo "  phase3    - Fonctionnalités & Performance"
    echo "  check     - Vérifier l'état actuel"
    echo "  all       - Exécuter toutes les phases (DANGER)"
    echo ""
    echo "Exemples:"
    echo "  $0 check"
    echo "  $0 phase1"
}

# Fonction de vérification de l'état
check_status() {
    echo -e "${BLUE}=== Vérification de l'état actuel ===${NC}"

    # Vérifier Node.js
    if command -v node &> /dev/null; then
        echo -e "${GREEN}✓${NC} Node.js installé: $(node -v)"
    else
        echo -e "${RED}✗${NC} Node.js non installé"
        exit 1
    fi

    # Vérifier PostgreSQL
    if command -v psql &> /dev/null; then
        echo -e "${GREEN}✓${NC} PostgreSQL installé: $(psql --version)"
    else
        echo -e "${YELLOW}⚠${NC} PostgreSQL non trouvé dans PATH"
    fi

    # Vérifier dépendances
    if [ -f "package.json" ]; then
        echo -e "${GREEN}✓${NC} package.json trouvé"
    else
        echo -e "${RED}✗${NC} package.json non trouvé"
        exit 1
    fi

    # Compter console.log
    CONSOLE_COUNT=$(grep -r "console.log" server/ components/ stores/ 2>/dev/null | wc -l)
    echo -e "${YELLOW}⚠${NC} Console.log trouvés: $CONSOLE_COUNT"

    # Compter types any
    ANY_COUNT=$(grep -r ": any" server/ 2>/dev/null | wc -l)
    echo -e "${YELLOW}⚠${NC} Types 'any' trouvés: $ANY_COUNT"

    # Vérifier tests
    if [ -d "tests" ]; then
        TEST_COUNT=$(find tests -name "*.test.ts" | wc -l)
        echo -e "${GREEN}✓${NC} Fichiers de tests: $TEST_COUNT"
    else
        echo -e "${RED}✗${NC} Dossier tests non trouvé"
    fi

    # Vérifier INFOCERT
    if grep -q "TEMP_SIGNATURE" server/utils/nf525.ts 2>/dev/null; then
        echo -e "${RED}✗${NC} Signature INFOCERT temporaire détectée"
    else
        echo -e "${GREEN}✓${NC} Signature INFOCERT semble implémentée"
    fi

    # Vérifier bypass auth
    if grep -q "ALLOW_AUTH_BYPASS" server/middleware/auth.global.ts 2>/dev/null; then
        echo -e "${GREEN}✓${NC} Protection bypass auth implémentée"
    else
        echo -e "${YELLOW}⚠${NC} Bypass auth non sécurisé"
    fi

    echo ""
}

# Phase 1: Sécurité & Conformité
phase1() {
    echo -e "${RED}=== PHASE 1: Sécurité & Conformité ===${NC}"
    echo ""

    # 1.2 Corriger bypass auth
    echo -e "${BLUE}[1/5] Correction bypass auth...${NC}"
    if grep -q "process.env.NODE_ENV === 'development'" server/middleware/auth.global.ts; then
        echo -e "${YELLOW}⚠ Modification manuelle requise:${NC}"
        echo "   - Ouvrir: server/middleware/auth.global.ts"
        echo "   - Ajouter variable ALLOW_AUTH_BYPASS"
        echo "   - Rendre le bypass explicite"
        read -p "Appuyez sur Entrée quand c'est fait..."
    fi

    # 1.3 Extraire user ID
    echo -e "${BLUE}[2/5] Extraction user ID du JWT...${NC}"
    HARDCODED_USERS=$(grep -r "userId: 1" server/api/ | wc -l)
    if [ "$HARDCODED_USERS" -gt 0 ]; then
        echo -e "${YELLOW}⚠ $HARDCODED_USERS fichiers avec userId hardcodé${NC}"
        echo "   Fichiers à corriger:"
        grep -r "userId: 1" server/api/ | cut -d':' -f1 | sort -u
        read -p "Appuyez sur Entrée pour continuer..."
    fi

    # 1.4 Installer logger
    echo -e "${BLUE}[3/5] Installation du logger structuré...${NC}"
    if ! grep -q "pino" package.json; then
        echo "Installation de pino..."
        npm install pino pino-pretty
    else
        echo -e "${GREEN}✓${NC} Pino déjà installé"
    fi

    # 1.5 Sécuriser tenant ID
    echo -e "${BLUE}[4/5] Sécurisation tenant ID...${NC}"
    echo -e "${YELLOW}⚠ Modification manuelle requise:${NC}"
    echo "   - Ouvrir: server/utils/tenant.ts"
    echo "   - Supprimer fallback tenant par défaut"
    echo "   - Lever erreur 403 si tenant invalide"
    read -p "Appuyez sur Entrée quand c'est fait..."

    # 1.1 INFOCERT
    echo -e "${BLUE}[5/5] Signature INFOCERT...${NC}"
    echo -e "${RED}⚠ CRITIQUE: Certificat INFOCERT requis${NC}"
    echo "   1. Contacter prestataire agréé (LNE, SGS, Bureau Veritas)"
    echo "   2. Coût: 1 500€ - 3 000€ / an"
    echo "   3. Délai: 2-3 semaines"
    echo "   4. Documentation: server/utils/nf525.ts"
    read -p "Certificat en cours d'obtention? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}⚠ ATTENTION: Application non conforme NF525${NC}"
    fi

    echo -e "${GREEN}✓ Phase 1 terminée${NC}"
    echo ""
}

# Phase 2: Qualité Code & Tests
phase2() {
    echo -e "${YELLOW}=== PHASE 2: Qualité Code & Tests ===${NC}"
    echo ""

    # 2.1 Type safety
    echo -e "${BLUE}[1/5] Amélioration type safety...${NC}"
    echo "   Configuration TypeScript strict..."
    cat > tsconfig.strict.json <<EOF
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitThis": true
  }
}
EOF
    echo -e "${GREEN}✓${NC} tsconfig.strict.json créé"
    echo "   Exécuter: npx tsc --noEmit -p tsconfig.strict.json"

    # 2.2 Tests
    echo -e "${BLUE}[2/5] Configuration des tests...${NC}"
    if [ ! -d "tests/api" ]; then
        mkdir -p tests/api tests/utils tests/integration
        echo -e "${GREEN}✓${NC} Dossiers de tests créés"
    fi

    # 2.3 Format réponses API
    echo -e "${BLUE}[3/5] Standardisation réponses API...${NC}"
    cat > server/utils/api-response.ts <<EOF
/**
 * Format standardisé pour toutes les réponses API
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  meta?: {
    timestamp?: number
    pagination?: {
      page: number
      limit: number
      total: number
      pages: number
    }
  }
}

export function successResponse<T>(data: T, meta?: ApiResponse['meta']): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: Date.now(),
      ...meta
    }
  }
}

export function errorResponse(code: string, message: string, details?: unknown): ApiResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details
    },
    meta: {
      timestamp: Date.now()
    }
  }
}
EOF
    echo -e "${GREEN}✓${NC} server/utils/api-response.ts créé"

    # 2.4 Fusionner routes
    echo -e "${BLUE}[4/5] Fusion routes dupliquées...${NC}"
    echo -e "${YELLOW}⚠ Action manuelle requise:${NC}"
    echo "   - Migrer /api/clients vers /api/customers"
    echo "   - Créer redirections temporaires"

    # 2.5 Documentation OpenAPI
    echo -e "${BLUE}[5/5] Documentation OpenAPI...${NC}"
    if ! grep -q "@scalar/nuxt" package.json; then
        echo "Installation de Scalar..."
        npm install -D @scalar/nuxt
    else
        echo -e "${GREEN}✓${NC} Scalar déjà installé"
    fi

    echo -e "${GREEN}✓ Phase 2 terminée${NC}"
    echo ""
}

# Phase 3: Fonctionnalités & Performance
phase3() {
    echo -e "${GREEN}=== PHASE 3: Fonctionnalités & Performance ===${NC}"
    echo ""

    # 3.1 Points fidélité
    echo -e "${BLUE}[1/5] Système points de fidélité...${NC}"
    echo "   TODO: Implémenter dans server/api/clients/[id]/stats.get.ts"

    # 3.2 Colonnes dépréciées
    echo -e "${BLUE}[2/5] Nettoyage colonnes dépréciées...${NC}"
    echo -e "${YELLOW}⚠ Migration base de données requise:${NC}"
    cat > migrations/$(date +%Y%m%d%H%M%S)_cleanup_deprecated_columns.sql <<EOF
-- Migration: Suppression colonnes dépréciées
-- Date: $(date)

BEGIN;

-- Backup avant suppression
CREATE TABLE _backup_products AS SELECT * FROM products;
CREATE TABLE _backup_sale_items AS SELECT * FROM sale_items;

-- Supprimer colonnes obsolètes
ALTER TABLE products DROP COLUMN IF EXISTS tva;
ALTER TABLE sale_items DROP COLUMN IF EXISTS tva;

-- Renommer colonne mal nommée
ALTER TABLE products RENAME COLUMN "variationGroupIds" TO "variationIds";

COMMIT;

-- Rollback si nécessaire:
-- BEGIN;
-- DROP TABLE products;
-- ALTER TABLE _backup_products RENAME TO products;
-- DROP TABLE sale_items;
-- ALTER TABLE _backup_sale_items RENAME TO sale_items;
-- COMMIT;
EOF
    echo -e "${GREEN}✓${NC} Migration SQL créée: migrations/"

    # 3.3 Pagination
    echo -e "${BLUE}[3/5] Ajout pagination...${NC}"
    echo "   TODO: Ajouter aux endpoints /api/clients, /api/products, /api/sales"

    # 3.4 Optimiser requêtes N+1
    echo -e "${BLUE}[4/5] Optimisation requêtes N+1...${NC}"
    echo "   TODO: Refactorer server/api/products/index.get.ts"

    # 3.5 Refactorer composants
    echo -e "${BLUE}[5/5] Refactoring composants Vue...${NC}"
    echo "   TODO: Découper ColRight.vue et ColMiddle.vue"

    echo -e "${GREEN}✓ Phase 3 terminée${NC}"
    echo ""
}

# Exécuter toutes les phases (DANGER)
run_all() {
    echo -e "${RED}⚠ ATTENTION: Exécution de toutes les phases${NC}"
    echo "Cela peut prendre plusieurs heures et nécessite des actions manuelles."
    read -p "Continuer? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        check_status
        phase1
        phase2
        phase3
        echo -e "${GREEN}✓✓✓ Toutes les phases terminées ✓✓✓${NC}"
    else
        echo "Annulé."
        exit 0
    fi
}

# Main
case "${1:-}" in
    check)
        check_status
        ;;
    phase1)
        phase1
        ;;
    phase2)
        phase2
        ;;
    phase3)
        phase3
        ;;
    all)
        run_all
        ;;
    -h|--help|help)
        show_help
        ;;
    *)
        echo -e "${RED}Erreur: Phase inconnue '${1}'${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac

exit 0
