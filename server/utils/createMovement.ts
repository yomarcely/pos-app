import { db } from '~/server/database/connection'
import { movements } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

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

  // Insérer le mouvement avec un numéro temporaire unique (timestamp)
  const tempNumber = `TEMP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const [tempMovement] = await db
    .insert(movements)
    .values({
      tenantId,
      movementNumber: tempNumber,
      type,
      comment: comment || null,
      userId: userId || null,
    })
    .returning()

  if (!tempMovement) {
    throw new Error('Échec de la création du mouvement en base de données')
  }

  // Générer le numéro définitif à partir de l'ID auto-incrémenté
  const prefix = type.toUpperCase()
  const movementNumber = `${prefix}-${String(tempMovement.id).padStart(6, '0')}`

  // Mettre à jour avec le numéro définitif
  const [movement] = await db
    .update(movements)
    .set({ movementNumber })
    .where(eq(movements.id, tempMovement.id))
    .returning()

  if (!movement) {
    throw new Error('Échec de la création du mouvement en base de données')
  }

  return {
    id: movement.id,
    movementNumber: movement.movementNumber,
  }
}
