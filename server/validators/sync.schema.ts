import { z } from 'zod'

/**
 * Schémas de validation pour le système de synchronisation
 */

// ==========================================
// GROUPES DE SYNCHRONISATION
// ==========================================

export const createSyncGroupSchema = z.object({
  name: z.string().min(1, 'Le nom est requis').max(255),
  description: z.string().optional(),
  establishmentIds: z.array(z.number()).min(2, 'Un groupe doit contenir au moins 2 établissements'),

  // Règles de synchronisation pour les produits (optionnelles)
  productRules: z.object({
    syncName: z.boolean().default(true),
    syncDescription: z.boolean().default(true),
    syncBarcode: z.boolean().default(true),
    syncCategory: z.boolean().default(true),
    syncSupplier: z.boolean().default(true),
    syncBrand: z.boolean().default(true),
    syncPriceHt: z.boolean().default(true),
    syncPriceTtc: z.boolean().default(false),
    syncTva: z.boolean().default(true),
    syncImage: z.boolean().default(true),
    syncVariations: z.boolean().default(true),
  }).optional(),

  // Règles de synchronisation pour les clients (optionnelles)
  customerRules: z.object({
    syncCustomerInfo: z.boolean().default(true),
    syncCustomerContact: z.boolean().default(true),
    syncCustomerAddress: z.boolean().default(true),
    syncCustomerGdpr: z.boolean().default(true),
    syncLoyaltyProgram: z.boolean().default(false),
    syncDiscount: z.boolean().default(false),
  }).optional(),
})

export const updateSyncGroupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
})

export const addEstablishmentToGroupSchema = z.object({
  establishmentId: z.number(),
})

// ==========================================
// RÈGLES DE SYNCHRONISATION
// ==========================================

export const updateSyncRulesSchema = z.object({
  entityType: z.enum(['product', 'customer']),

  // Champs produits
  syncName: z.boolean().optional(),
  syncDescription: z.boolean().optional(),
  syncBarcode: z.boolean().optional(),
  syncCategory: z.boolean().optional(),
  syncSupplier: z.boolean().optional(),
  syncBrand: z.boolean().optional(),
  syncPriceHt: z.boolean().optional(),
  syncPriceTtc: z.boolean().optional(),
  syncTva: z.boolean().optional(),
  syncImage: z.boolean().optional(),
  syncVariations: z.boolean().optional(),

  // Champs clients
  syncCustomerInfo: z.boolean().optional(),
  syncCustomerContact: z.boolean().optional(),
  syncCustomerAddress: z.boolean().optional(),
  syncCustomerGdpr: z.boolean().optional(),
  syncLoyaltyProgram: z.boolean().optional(),
  syncDiscount: z.boolean().optional(),
})

// ==========================================
// STOCK PAR ÉTABLISSEMENT
// ==========================================

export const updateProductStockSchema = z.object({
  productId: z.number(),
  establishmentId: z.number(),
  quantity: z.number(),
  variation: z.string().optional(),
  adjustmentType: z.enum(['add', 'set'], {
    message: 'Le type d\'ajustement doit être "add" ou "set"',
  }),
  reason: z.enum(['reception', 'inventory_adjustment', 'loss', 'return', 'sale', 'sale_cancellation'], {
    message: 'Raison invalide',
  }),
  userId: z.number().optional(),
})

export const createProductStockSchema = z.object({
  productId: z.number(),
  establishmentId: z.number(),
  stock: z.number().default(0),
  stockByVariation: z.array(z.object({
    variationId: z.string(),
    stock: z.number(),
  })).optional(),
  minStock: z.number().default(5),
  minStockByVariation: z.array(z.object({
    variationId: z.string(),
    minStock: z.number(),
  })).optional(),
})

// ==========================================
// PARAMÈTRES PRODUITS PAR ÉTABLISSEMENT
// ==========================================

export const updateProductEstablishmentSchema = z.object({
  productId: z.number(),
  establishmentId: z.number(),
  priceOverride: z.number().positive().optional().nullable(),
  purchasePriceOverride: z.number().positive().optional().nullable(),
  isAvailable: z.boolean().optional(),
  notes: z.string().optional().nullable(),
})

export const createProductEstablishmentSchema = z.object({
  productId: z.number(),
  establishmentId: z.number(),
  priceOverride: z.number().positive().optional(),
  purchasePriceOverride: z.number().positive().optional(),
  isAvailable: z.boolean().default(true),
  notes: z.string().optional(),
})

// ==========================================
// CLIENTS PAR ÉTABLISSEMENT
// ==========================================

export const updateCustomerEstablishmentSchema = z.object({
  customerId: z.number(),
  establishmentId: z.number(),
  localDiscount: z.number().min(0).max(100).optional().nullable(),
  localNotes: z.string().optional().nullable(),
  localLoyaltyPoints: z.number().min(0).optional(),
})

export const createCustomerEstablishmentSchema = z.object({
  customerId: z.number(),
  establishmentId: z.number(),
  localDiscount: z.number().min(0).max(100).optional(),
  localNotes: z.string().optional(),
  localLoyaltyPoints: z.number().min(0).default(0),
})

// ==========================================
// SYNCHRONISATION MANUELLE
// ==========================================

export const forceSyncSchema = z.object({
  syncGroupId: z.number(),
  entityType: z.enum(['product', 'customer']),
  entityId: z.number(),
  sourceEstablishmentId: z.number().optional(), // Si omis, sync depuis toutes les sources
  targetEstablishmentIds: z.array(z.number()).optional(), // Si omis, sync vers tous les établissements du groupe
})

// ==========================================
// TRANSFERT DE STOCK ENTRE ÉTABLISSEMENTS
// ==========================================

export const transferStockSchema = z.object({
  productId: z.number(),
  variation: z.string().optional(),
  fromEstablishmentId: z.number(),
  toEstablishmentId: z.number(),
  quantity: z.number().positive('La quantité doit être positive'),
  userId: z.number().optional(),
  notes: z.string().optional(),
})

// ==========================================
// REQUÊTES / FILTRES
// ==========================================

export const getProductStocksQuerySchema = z.object({
  establishmentId: z.number().optional(),
  productId: z.number().optional(),
  lowStock: z.boolean().optional(), // Filtrer uniquement les produits avec stock faible
  outOfStock: z.boolean().optional(), // Filtrer uniquement les produits en rupture
})

export const getSyncLogsQuerySchema = z.object({
  syncGroupId: z.number().optional(),
  entityType: z.enum(['product', 'customer']).optional(),
  entityId: z.number().optional(),
  sourceEstablishmentId: z.number().optional(),
  action: z.enum(['create', 'update', 'delete']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
})

// ==========================================
// TYPES INFÉRÉS
// ==========================================

export type CreateSyncGroupInput = z.infer<typeof createSyncGroupSchema>
export type UpdateSyncGroupInput = z.infer<typeof updateSyncGroupSchema>
export type UpdateSyncRulesInput = z.infer<typeof updateSyncRulesSchema>
export type UpdateProductStockInput = z.infer<typeof updateProductStockSchema>
export type CreateProductStockInput = z.infer<typeof createProductStockSchema>
export type UpdateProductEstablishmentInput = z.infer<typeof updateProductEstablishmentSchema>
export type CreateProductEstablishmentInput = z.infer<typeof createProductEstablishmentSchema>
export type UpdateCustomerEstablishmentInput = z.infer<typeof updateCustomerEstablishmentSchema>
export type CreateCustomerEstablishmentInput = z.infer<typeof createCustomerEstablishmentSchema>
export type ForceSyncInput = z.infer<typeof forceSyncSchema>
export type TransferStockInput = z.infer<typeof transferStockSchema>
export type GetProductStocksQuery = z.infer<typeof getProductStocksQuerySchema>
export type GetSyncLogsQuery = z.infer<typeof getSyncLogsQuerySchema>
