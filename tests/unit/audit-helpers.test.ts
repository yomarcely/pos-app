import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture des valeurs insérées dans audit_logs
let captured: Record<string, unknown>[] = []

vi.mock('~/server/database/connection', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(async (vals: Record<string, unknown>) => {
        captured.push(vals)
      }),
    })),
  },
}))

vi.mock('~/server/database/schema', () => ({
  auditLogs: {},
}))

vi.mock('~/server/utils/logger', () => ({
  logger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  },
}))

import {
  logEntityDeletion,
  logEntityDeactivation,
  logCustomerAnonymization,
  AuditEventType,
} from '~/server/utils/audit'

describe('Q6 — logEntityDeletion', () => {
  beforeEach(() => {
    captured = []
  })

  it('insère un row avec action ENTITY_DELETE et le snapshot', async () => {
    await logEntityDeletion({
      tenantId: 'tenant-a',
      userId: null,
      userName: 'admin@fym.com',
      entityType: 'customer',
      entityId: 42,
      snapshot: { firstName: 'Alice', email: 'a@x.com' },
      ipAddress: '1.2.3.4',
    })

    expect(captured).toHaveLength(1)
    expect(captured[0]).toMatchObject({
      tenantId: 'tenant-a',
      userId: null,
      userName: 'admin@fym.com',
      entityType: 'customer',
      entityId: 42,
      action: AuditEventType.ENTITY_DELETE,
      changes: { firstName: 'Alice', email: 'a@x.com' },
      ipAddress: '1.2.3.4',
    })
  })

  it('accepte un snapshot vide', async () => {
    await logEntityDeletion({
      tenantId: 'tenant-a',
      userId: null,
      userName: null,
      entityType: 'sync_group',
      entityId: 7,
    })

    expect(captured).toHaveLength(1)
    expect(captured[0]?.action).toBe(AuditEventType.ENTITY_DELETE)
    expect(captured[0]?.userName).toBe('System') // default fallback de logAuditEvent
  })

  it('n\'échoue pas si l\'insert plante (audit ne doit jamais bloquer)', async () => {
    const realDb = await import('~/server/database/connection')
    vi.mocked(realDb.db.insert).mockImplementationOnce(() => {
      throw new Error('DB down')
    })

    await expect(logEntityDeletion({
      tenantId: 'tenant-a',
      userId: null,
      userName: 'x',
      entityType: 'customer',
      entityId: 1,
    })).resolves.toBeUndefined()
  })
})

describe('Q6 — logEntityDeactivation', () => {
  beforeEach(() => {
    captured = []
  })

  it('insère un row avec action ENTITY_DEACTIVATE', async () => {
    await logEntityDeactivation({
      tenantId: 'tenant-a',
      userId: null,
      userName: 'admin@fym.com',
      entityType: 'establishment',
      entityId: 1,
      snapshot: { name: 'Boutique Centre' },
    })

    expect(captured).toHaveLength(1)
    expect(captured[0]).toMatchObject({
      action: AuditEventType.ENTITY_DEACTIVATE,
      entityType: 'establishment',
      entityId: 1,
      changes: { name: 'Boutique Centre' },
    })
  })

  it('action distincte de ENTITY_DELETE (soft vs hard delete)', () => {
    expect(AuditEventType.ENTITY_DEACTIVATE).not.toBe(AuditEventType.ENTITY_DELETE)
  })
})

describe('Q9 — logCustomerAnonymization', () => {
  beforeEach(() => {
    captured = []
  })

  it('insère un row RGPD avec snapshot complet et metadata', async () => {
    await logCustomerAnonymization({
      tenantId: 'tenant-a',
      userId: null,
      userName: 'dpo@fym.com',
      customerId: 42,
      snapshot: {
        firstName: 'Alice',
        lastName: 'Martin',
        email: 'a@x.com',
        phone: '0612345678',
        address: '1 rue X',
      },
      ipAddress: '1.2.3.4',
    })

    expect(captured).toHaveLength(1)
    const row = captured[0]!
    expect(row.action).toBe(AuditEventType.CUSTOMER_ANONYMIZE)
    expect(row.entityType).toBe('customer')
    expect(row.entityId).toBe(42)
    expect(row.changes).toMatchObject({
      firstName: 'Alice',
      lastName: 'Martin',
      email: 'a@x.com',
      phone: '0612345678',
      address: '1 rue X',
    })
    expect(row.metadata).toMatchObject({
      reason: 'RGPD - droit à l\'oubli',
    })
    expect((row.metadata as Record<string, string>).anonymizedAt).toBeDefined()
  })

  it('accepte une raison custom', async () => {
    await logCustomerAnonymization({
      tenantId: 'tenant-a',
      userId: null,
      userName: 'x',
      customerId: 1,
      snapshot: { firstName: 'A' },
      reason: 'Demande client par email du 2026-04-23',
    })

    expect((captured[0]?.metadata as Record<string, string>).reason).toContain('Demande client')
  })

  it('omet les champs null du snapshot dans changes', async () => {
    await logCustomerAnonymization({
      tenantId: 'tenant-a',
      userId: null,
      userName: 'x',
      customerId: 1,
      snapshot: { firstName: 'A', email: null, phone: null },
    })

    const changes = captured[0]?.changes as Record<string, unknown>
    expect(changes.firstName).toBe('A')
    expect(changes.email).toBeUndefined()
    expect(changes.phone).toBeUndefined()
  })
})
