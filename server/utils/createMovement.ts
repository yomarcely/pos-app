import { db } from '~/server/database/connection'
import { movements, stockMovements } from '~/server/database/schema'
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
  userId?: number
): Promise<{ id: number; movementNumber: string }> {
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
      movementNumber,
      type,
      comment: comment || null,
      userId: userId || null,
    })
    .returning()

  return {
    id: movement.id,
    movementNumber: movement.movementNumber,
  }
}

/**
 * Récupère un mouvement avec ses détails
 */
export async function getMovementWithDetails(movementId: number) {
  const [movement] = await db
    .select()
    .from(movements)
    .where(sql`${movements.id} = ${movementId}`)
    .limit(1)

  if (!movement) {
    return null
  }

  const details = await db
    .select()
    .from(stockMovements)
    .where(sql`${stockMovements.movementId} = ${movementId}`)

  return {
    ...movement,
    details,
  }
}
