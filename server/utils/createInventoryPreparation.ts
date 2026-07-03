import { db, type DbExecutor } from '~/server/database/connection'
import { inventoryPreparations } from '~/server/database/schema'
import { eq } from 'drizzle-orm'

export interface CreateInventoryPreparationOptions {
  name?: string | null
  comment?: string | null
  establishmentId?: number | null
  userId?: number | null
}

/**
 * Crée l'enregistrement parent d'une préparation d'inventaire (status='draft')
 * et lui attribue un numéro unique de la forme PREP-INV-000001.
 *
 * Les lignes (items) sont insérées séparément par l'endpoint POST.
 */
export async function createInventoryPreparation(
  tenantId: string,
  options: CreateInventoryPreparationOptions = {},
  // ⚠️ Appelé depuis une transaction ? Passer `tx`, sinon deadlock en mode
  // pooler max=1 (voir DbExecutor dans server/database/connection.ts).
  executor: DbExecutor = db,
): Promise<{ id: number; preparationNumber: string }> {
  if (!tenantId) {
    throw new Error("Tenant ID manquant pour la création de la préparation d'inventaire")
  }

  // Insertion avec numéro temporaire pour éviter le conflit d'unicité
  const tempNumber = `TEMP-PREP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const [temp] = await executor
    .insert(inventoryPreparations)
    .values({
      tenantId,
      preparationNumber: tempNumber,
      name: options.name ?? null,
      comment: options.comment ?? null,
      establishmentId: options.establishmentId ?? null,
      userId: options.userId ?? null,
    })
    .returning()

  if (!temp) {
    throw new Error("Échec de la création de la préparation d'inventaire")
  }

  const preparationNumber = `PREP-INV-${String(temp.id).padStart(6, '0')}`

  const [prep] = await executor
    .update(inventoryPreparations)
    .set({ preparationNumber })
    .where(eq(inventoryPreparations.id, temp.id))
    .returning()

  if (!prep) {
    throw new Error("Échec de la mise à jour du numéro de préparation")
  }

  return { id: prep.id, preparationNumber: prep.preparationNumber }
}
