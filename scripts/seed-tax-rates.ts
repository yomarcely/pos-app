/**
 * Script pour insérer les taux de TVA standards français
 */
import { db } from '../server/database/connection'
import { taxRates } from '../server/database/schema'
import { eq, and } from 'drizzle-orm'

const TENANT_IDS = [
  'f831a590-f365-4302-8aaf-1a7ac06d357d', // Tenant 1 (Vape)
  '9da91f8f-7513-451c-8a07-9008fa697a88', // Tenant 2 (Vêtements)
]

const TAX_RATES_DATA = [
  { name: 'TVA 20%', rate: '20.00', code: 'T1', description: 'Taux normal', isDefault: true },
  { name: 'TVA 10%', rate: '10.00', code: 'T2', description: 'Taux intermédiaire', isDefault: false },
  { name: 'TVA 5.5%', rate: '5.50', code: 'T3', description: 'Taux réduit', isDefault: false },
  { name: 'TVA 2.1%', rate: '2.10', code: 'T4', description: 'Taux super réduit', isDefault: false },
  { name: 'TVA 0%', rate: '0.00', code: 'T0', description: 'Exonéré', isDefault: false },
]

async function seedTaxRates() {
  console.log('🌱 Insertion des taux de TVA...\n')

  for (const tenantId of TENANT_IDS) {
    console.log(`📦 Tenant: ${tenantId}`)

    for (const taxRate of TAX_RATES_DATA) {
      // Vérifier si le taux existe déjà
      const [existing] = await db
        .select()
        .from(taxRates)
        .where(
          and(
            eq(taxRates.tenantId, tenantId),
            eq(taxRates.code, taxRate.code)
          )
        )
        .limit(1)

      if (existing) {
        console.log(`  ⏭️  ${taxRate.name} (${taxRate.code}) existe déjà`)
      } else {
        await db.insert(taxRates).values({
          tenantId,
          name: taxRate.name,
          rate: taxRate.rate,
          code: taxRate.code,
          description: taxRate.description,
          isDefault: taxRate.isDefault,
        })
        console.log(`  ✅ ${taxRate.name} (${taxRate.code}) ajouté`)
      }
    }
    console.log('')
  }

  console.log('✨ Insertion terminée !')
}

// Exécuter le seed
seedTaxRates()
  .then(() => {
    console.log('\n✅ Seed réussi')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Erreur lors du seed:', error)
    process.exit(1)
  })
