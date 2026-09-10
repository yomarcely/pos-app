#!/usr/bin/env node

/**
 * Script de validation des variables d'environnement
 * Vérifie que toutes les variables requises sont présentes
 */

const required = {
  all: [
    'NODE_ENV',
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
  ],
  production: [
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_JWT_SECRET',
    'JWT_SECRET',
    'INFOCERT_PRIVATE_KEY',
    'INFOCERT_MERCHANT_ID',
    'DPO_EMAIL',
    'CRON_SECRET',
  ],
  staging: [
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET',
    // A5 — sans lui, le cron de vérification des chaînes NF525 reçoit 401
    // (fail-closed) et l'alerting est muet : autant le savoir au déploiement.
    'CRON_SECRET',
  ]
}

const env = process.env.NODE_ENV || 'development'

console.log(`🔍 Vérification de l'environnement : ${env}\n`)

// Vérifier les variables communes
const missingAll = required.all.filter(key => !process.env[key])

// Vérifier les variables spécifiques à l'environnement
let missingEnvSpecific = []
if (env === 'production') {
  missingEnvSpecific = required.production.filter(key => !process.env[key])
} else if (env === 'staging') {
  missingEnvSpecific = required.staging.filter(key => !process.env[key])
}

const allMissing = [...missingAll, ...missingEnvSpecific]

if (allMissing.length > 0) {
  console.error('❌ Variables manquantes :\n')
  allMissing.forEach(key => console.error(`   - ${key}`))
  console.error('\n💡 Consultez .env.example pour la liste complète\n')
  process.exit(1)
}

// Vérifications supplémentaires
const warnings = []

// Vérifier la longueur du JWT secret
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  warnings.push('JWT_SECRET devrait faire au moins 32 caractères')
}

// Vérifier le format de l'URL de base de données
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
  warnings.push('DATABASE_URL devrait commencer par postgresql://')
}

// Vérifier SSL en production
if (env === 'production' && process.env.DB_SSL !== 'true') {
  warnings.push('DB_SSL devrait être activé en production')
}

// Afficher les résultats
console.log('✅ Toutes les variables requises sont présentes\n')

if (warnings.length > 0) {
  console.warn('⚠️  Avertissements :\n')
  warnings.forEach(warning => console.warn(`   - ${warning}`))
  console.warn('')
}

// Afficher un résumé
console.log('📊 Résumé de la configuration :')
console.log(`   - Environnement : ${env}`)
console.log(`   - Base de données : ${process.env.DATABASE_URL ? 'Configurée (URL)' : 'Paramètres séparés'}`)
console.log(`   - Supabase : ${process.env.SUPABASE_URL ? '✅' : '❌'}`)
console.log(`   - NF525 : ${process.env.INFOCERT_PRIVATE_KEY ? '✅' : '⚠️  Non configuré'}`)
console.log(`   - Port : ${process.env.PORT || 3000}`)
console.log('')
