import { db } from '~/server/database/connection'
import { movements } from '~/server/database/schema'
import { sql } from 'drizzle-orm'

/**
 * Crée un mouvement de stock avec son numéro unique
 *
 * @param type - Type de mouvement (reception, adjustment, loss, transfer)
 * @param comment - Commentaire optionnel
 * @param userId - ID de l'utilisateur
 * @returns L'ID et le numéro du mouvement créé
 */
export async function createMovement(
  type: 'reception' | 'adjustment' | 'loss' | 'transfer',
  comment?: string,
  userId?: number,
  tenantId?: string
): Promise<{ id: number; movementNumber: string }> {
  if (!tenantId) {
    throw new Error('Tenant ID manquant pour la création du mouvement')
  }
  // Générer le numéro de mouvement via la fonction SQL
  const result = await db.execute(sql`SELECT generate_movement_number(${type}::varchar) as movement_number`)
  const movementNumber = result[0]?.movement_number as string

  if (!movementNumber) {
    throw new Error('Impossible de générer le numéro de mouvement')
  }

  // Créer le mouvement
  const [movement] = await db
    .insert(movements)
    .values({
      tenantId,
      movementNumber,
      type,
      comment: comment || null,
      userId: userId || null,
    })
    .returning()

  if (!movement) {
    throw new Error('Échec de la création du mouvement en base de données')
  }

  return {
    id: movement.id,
    movementNumber: movement.movementNumber,
  }
}
