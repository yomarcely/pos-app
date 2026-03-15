/**
 * ==========================================
 * MIGRATION: Ajout de la table tax_rates et mise à jour des schémas
 * ==========================================
 *
 * Cette migration:
 * 1. Crée la table tax_rates
 * 2. Ajoute la colonne tvaId dans products
 * 3. Ajoute les colonnes tvaId, tvaRate, tvaCode dans sale_items
 * 4. Peuple la table tax_rates avec les taux standards français
 *
 * IMPORTANT: Cette migration ne supprime PAS les anciennes colonnes tva
 * pour maintenir la compatibilité. Une fois que tout est migré et validé,
 * vous pourrez supprimer les anciennes colonnes manuellement.
 */

import { sql } from 'drizzle-orm'
import { db } from './connection'

export async function runTaxRatesMigration() {
  console.log('🔄 Début de la migration tax_rates...')

  try {
    // 1. Créer la table tax_rates
    console.log('📋 Création de la table tax_rates...')
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tax_rates (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL,
        name VARCHAR(100) NOT NULL,
        rate DECIMAL(5, 2) NOT NULL,
        code VARCHAR(10) NOT NULL,
        description TEXT,
        is_default BOOLEAN DEFAULT false,
        is_archived BOOLEAN DEFAULT false,
        archived_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `)

    // Créer les index
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS tax_rates_tenant_id_idx ON tax_rates(tenant_id);
      CREATE INDEX IF NOT EXISTS tax_rates_rate_idx ON tax_rates(rate);
      CREATE INDEX IF NOT EXISTS tax_rates_code_idx ON tax_rates(code);
    `)

    // 2. Ajouter la colonne tvaId dans products (si elle n'existe pas)
    console.log('📋 Ajout de tva_id dans products...')
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'products' AND column_name = 'tva_id'
        ) THEN
          ALTER TABLE products ADD COLUMN tva_id INTEGER REFERENCES tax_rates(id);
        END IF;
      END $$;
    `)

    // 3. Ajouter les colonnes dans sale_items
    console.log('📋 Ajout de tva_id, tva_rate, tva_code dans sale_items...')
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'sale_items' AND column_name = 'tva_id'
        ) THEN
          ALTER TABLE sale_items ADD COLUMN tva_id INTEGER REFERENCES tax_rates(id);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'sale_items' AND column_name = 'tva_rate'
        ) THEN
          ALTER TABLE sale_items ADD COLUMN tva_rate DECIMAL(5, 2);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'sale_items' AND column_name = 'tva_code'
        ) THEN
          ALTER TABLE sale_items ADD COLUMN tva_code VARCHAR(10);
        END IF;
      END $$;
    `)

    // 4. Insérer les taux de TVA standards français
    console.log('📋 Insertion des taux de TVA standards...')

    // Récupérer un tenant_id existant (ou utiliser un défaut)
    const result = await db.execute(sql`
      SELECT DISTINCT tenant_id FROM products LIMIT 1;
    `)

    const tenantId = (result[0] as Record<string, unknown> | undefined)?.tenant_id as string || 'default'

    await db.execute(sql`
      INSERT INTO tax_rates (tenant_id, name, rate, code, description, is_default)
      VALUES
        (${tenantId}, 'TVA 20%', 20.00, 'T1', 'Taux normal', true),
        (${tenantId}, 'TVA 10%', 10.00, 'T2', 'Taux intermédiaire', false),
        (${tenantId}, 'TVA 5.5%', 5.50, 'T3', 'Taux réduit', false),
        (${tenantId}, 'TVA 2.1%', 2.10, 'T4', 'Taux super réduit', false),
        (${tenantId}, 'TVA 0%', 0.00, 'T0', 'Exonéré', false)
      ON CONFLICT DO NOTHING;
    `)

    // 5. Migrer les données existantes (products)
    console.log('📋 Migration des données existantes dans products...')
    await db.execute(sql`
      UPDATE products p
      SET tva_id = (
        SELECT tr.id
        FROM tax_rates tr
        WHERE tr.rate = p.tva
        AND tr.tenant_id = p.tenant_id
        LIMIT 1
      )
      WHERE p.tva_id IS NULL
      AND p.tva IS NOT NULL;
    `)

    // 6. Migrer les données existantes (sale_items)
    console.log('📋 Migration des données existantes dans sale_items...')
    await db.execute(sql`
      UPDATE sale_items si
      SET
        tva_rate = si.tva,
        tva_id = (
          SELECT tr.id
          FROM tax_rates tr
          WHERE tr.rate = si.tva
          AND tr.tenant_id = si.tenant_id
          LIMIT 1
        ),
        tva_code = (
          SELECT tr.code
          FROM tax_rates tr
          WHERE tr.rate = si.tva
          AND tr.tenant_id = si.tenant_id
          LIMIT 1
        )
      WHERE si.tva_id IS NULL
      AND si.tva IS NOT NULL;
    `)

    console.log('✅ Migration terminée avec succès!')
    console.log('')
    console.log('⚠️  NOTES IMPORTANTES:')
    console.log('   - Les anciennes colonnes "tva" ont été conservées pour compatibilité')
    console.log('   - Testez bien l\'application avant de les supprimer')
    console.log('   - Pour supprimer les anciennes colonnes plus tard:')
    console.log('     ALTER TABLE products DROP COLUMN tva;')
    console.log('     ALTER TABLE sale_items DROP COLUMN tva;')
    console.log('')

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error)
    throw error
  }
}

// Exécuter la migration si ce fichier est appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  runTaxRatesMigration()
    .then(() => {
      console.log('✅ Migration complète')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Échec de la migration:', error)
      process.exit(1)
    })
}
