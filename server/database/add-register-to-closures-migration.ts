import { db } from './connection'
import { sql } from 'drizzle-orm'

/**
 * Migration: Ajout des champs registerId et establishmentId à la table closures
 */

async function migrate() {
  console.log('🔄 Début de la migration: ajout de registerId et establishmentId à closures...')

  try {
    // 1. Ajouter la colonne registerId (NOT NULL avec valeur par défaut temporaire)
    await db.execute(sql`
      ALTER TABLE closures
      ADD COLUMN IF NOT EXISTS register_id INTEGER;
    `)
    console.log('✅ Colonne register_id ajoutée')

    // 2. Ajouter la colonne establishmentId (nullable)
    await db.execute(sql`
      ALTER TABLE closures
      ADD COLUMN IF NOT EXISTS establishment_id INTEGER;
    `)
    console.log('✅ Colonne establishment_id ajoutée')

    // 3. Mettre à jour les enregistrements existants
    // Récupérer le premier registerId disponible pour chaque tenant
    await db.execute(sql`
      UPDATE closures c
      SET register_id = (
        SELECT r.id
        FROM registers r
        WHERE r.tenant_id = c.tenant_id
        LIMIT 1
      )
      WHERE register_id IS NULL;
    `)
    console.log('✅ Données migrées pour register_id')

    // Mettre à jour establishmentId basé sur le registerId
    await db.execute(sql`
      UPDATE closures c
      SET establishment_id = (
        SELECT r.establishment_id
        FROM registers r
        WHERE r.id = c.register_id
      )
      WHERE establishment_id IS NULL;
    `)
    console.log('✅ Données migrées pour establishment_id')

    // 4. Rendre register_id NOT NULL
    await db.execute(sql`
      ALTER TABLE closures
      ALTER COLUMN register_id SET NOT NULL;
    `)
    console.log('✅ Contrainte NOT NULL ajoutée à register_id')

    // 5. Ajouter les contraintes de clé étrangère
    await db.execute(sql`
      ALTER TABLE closures
      ADD CONSTRAINT closures_register_id_fkey
      FOREIGN KEY (register_id) REFERENCES registers(id)
      ON DELETE RESTRICT;
    `)
    console.log('✅ Clé étrangère ajoutée pour register_id')

    await db.execute(sql`
      ALTER TABLE closures
      ADD CONSTRAINT closures_establishment_id_fkey
      FOREIGN KEY (establishment_id) REFERENCES establishments(id)
      ON DELETE RESTRICT;
    `)
    console.log('✅ Clé étrangère ajoutée pour establishment_id')

    // 6. Créer les index
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS closures_register_id_idx
      ON closures (register_id);
    `)
    console.log('✅ Index créé pour register_id')

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS closures_establishment_id_idx
      ON closures (establishment_id);
    `)
    console.log('✅ Index créé pour establishment_id')

    console.log('✅ Migration terminée avec succès!')
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error)
    throw error
  }
}

// Exécuter la migration
migrate()
  .then(() => {
    console.log('✅ Script terminé')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Erreur:', error)
    process.exit(1)
  })
