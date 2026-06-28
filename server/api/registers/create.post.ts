import { eq, sql } from 'drizzle-orm'
import { db } from '~/server/database/connection'
import { registers } from '~/server/database/schema'
import { getTenantIdFromEvent } from '~/server/utils/tenant'
import { assertRole } from '~/server/utils/roles'
import { validateBody } from '~/server/utils/validation'
import { createRegisterSchema, type CreateRegisterInput } from '~/server/validators/register.schema'
import { logger } from '~/server/utils/logger'
import { logEntityCreation } from '~/server/utils/audit'

/**
 * ==========================================
 * API: Créer une caisse
 * ==========================================
 *
 * POST /api/registers/create
 */

export default defineEventHandler(async (event) => {
  try {
    const tenantId = getTenantIdFromEvent(event)
    assertRole(event, 'manager')
    const body = await validateBody<CreateRegisterInput>(event, createRegisterSchema)

    // Numéro de caisse immutable : MAX(register_number) + 1 par établissement,
    // sous advisory lock pour éviter les collisions concurrentes.
    const newRegister = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${body.establishmentId})`)
      const [maxRow] = await tx
        .select({ max: sql<number>`COALESCE(MAX(${registers.registerNumber}), 0)` })
        .from(registers)
        .where(eq(registers.establishmentId, body.establishmentId))
      const nextNumber = Number(maxRow?.max ?? 0) + 1

      const [created] = await tx
        .insert(registers)
        .values({
          tenantId,
          establishmentId: body.establishmentId,
          registerNumber: nextNumber,
          name: body.name.trim(),
          isActive: body.isActive ?? true,
        })
        .returning()
      return created
    })

    if (!newRegister) {
      throw createError({ statusCode: 500, message: 'Échec de la création de la caisse' })
    }

    logger.info({
      registerId: newRegister.id,
      registerName: newRegister.name,
      establishmentId: body.establishmentId,
      tenantId
    }, 'Register created')

    // Q12 — Audit log
    const auth = event.context.auth
    await logEntityCreation({
      tenantId,
      userId: null,
      userName: auth?.user?.email || 'Utilisateur',
      entityType: 'register',
      entityId: newRegister.id,
      snapshot: {
        name: newRegister.name,
        establishmentId: newRegister.establishmentId,
        isActive: newRegister.isActive,
      },
      ipAddress: getRequestIP(event) || null,
    })

    return {
      success: true,
      message: 'Caisse créée avec succès',
      register: newRegister,
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to create register')

    if (error instanceof Error && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: "Une erreur interne s'est produite",
    })
  }
})
