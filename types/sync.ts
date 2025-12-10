/**
 * Types pour le système de synchronisation multi-établissements
 */

// ==========================================
// GROUPES DE SYNCHRONISATION
// ==========================================

export interface SyncGroup {
  id: number
  tenantId: string
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

export interface SyncGroupEstablishment {
  id: number
  tenantId: string
  syncGroupId: number
  establishmentId: number
  createdAt: Date
}

// ==========================================
// RÈGLES DE SYNCHRONISATION
// ==========================================

export type SyncEntityType = 'product' | 'customer'

export interface SyncRules {
  id: number
  tenantId: string
  syncGroupId: number
  entityType: SyncEntityType

  // Champs produits
  syncName: boolean
  syncDescription: boolean
  syncBarcode: boolean
  syncCategory: boolean
  syncSupplier: boolean
  syncBrand: boolean
  syncPriceHt: boolean
  syncPriceTtc: boolean
  syncTva: boolean
  syncImage: boolean
  syncVariations: boolean

  // Champs clients
  syncCustomerInfo: boolean
  syncCustomerContact: boolean
  syncCustomerAddress: boolean
  syncCustomerGdpr: boolean
  syncLoyaltyProgram: boolean
  syncDiscount: boolean

  createdAt: Date
  updatedAt: Date
}

// ==========================================
// STOCK PAR ÉTABLISSEMENT
// ==========================================

export interface StockByVariation {
  variationId: string
  stock: number
}

export interface ProductStock {
  id: number
  tenantId: string
  productId: number
  establishmentId: number
  stock: number
  stockByVariation: StockByVariation[]
  minStock: number
  minStockByVariation?: StockByVariation[]
  createdAt: Date
  updatedAt: Date
}

// ==========================================
// PARAMÈTRES PRODUITS PAR ÉTABLISSEMENT
// ==========================================

export interface ProductEstablishment {
  id: number
  tenantId: string
  productId: number
  establishmentId: number
  priceOverride?: number
  purchasePriceOverride?: number
  isAvailable: boolean
  notes?: string
  createdAt: Date
  updatedAt: Date
}

// ==========================================
// CLIENTS PAR ÉTABLISSEMENT
// ==========================================

export interface CustomerEstablishment {
  id: number
  tenantId: string
  customerId: number
  establishmentId: number
  localDiscount?: number
  localNotes?: string
  localLoyaltyPoints: number
  firstPurchaseDate?: Date
  lastPurchaseDate?: Date
  totalPurchases: number
  purchaseCount: number
  createdAt: Date
  updatedAt: Date
}

// ==========================================
// LOGS DE SYNCHRONISATION
// ==========================================

export type SyncAction = 'create' | 'update' | 'delete'

export interface SyncLog {
  id: number
  tenantId: string
  syncGroupId: number
  entityType: string
  entityId: number
  sourceEstablishmentId?: number
  action: SyncAction
  syncedFields?: Record<string, any>
  createdAt: Date
}

// ==========================================
// DTOs POUR LES API
// ==========================================

export interface CreateSyncGroupDto {
  name: string
  description?: string
  establishmentIds: number[]
  productRules?: Partial<Pick<SyncRules, 'syncName' | 'syncDescription' | 'syncBarcode' | 'syncCategory' | 'syncSupplier' | 'syncBrand' | 'syncPriceHt' | 'syncPriceTtc' | 'syncTva' | 'syncImage' | 'syncVariations'>>
  customerRules?: Partial<Pick<SyncRules, 'syncCustomerInfo' | 'syncCustomerContact' | 'syncCustomerAddress' | 'syncCustomerGdpr' | 'syncLoyaltyProgram' | 'syncDiscount'>>
}

export interface UpdateSyncRulesDto {
  syncGroupId: number
  entityType: SyncEntityType
  rules: Partial<Omit<SyncRules, 'id' | 'tenantId' | 'syncGroupId' | 'entityType' | 'createdAt' | 'updatedAt'>>
}

export interface UpdateProductStockDto {
  productId: number
  establishmentId: number
  quantity: number
  variation?: string
  adjustmentType: 'add' | 'set'
  reason: 'reception' | 'inventory_adjustment' | 'loss' | 'return' | 'sale' | 'sale_cancellation'
  userId?: number
}

export interface UpdateProductEstablishmentDto {
  productId: number
  establishmentId: number
  priceOverride?: number
  purchasePriceOverride?: number
  isAvailable?: boolean
  notes?: string
}

// ==========================================
// TYPES ÉTENDUS AVEC RELATIONS
// ==========================================

export interface SyncGroupWithDetails extends SyncGroup {
  establishments: Array<{
    id: number
    name: string
    city?: string
  }>
  productRules?: SyncRules
  customerRules?: SyncRules
  establishmentCount: number
}

export interface ProductWithStocks {
  id: number
  name: string
  barcode?: string
  price: number
  stocks: Array<{
    establishmentId: number
    establishmentName: string
    stock: number
    stockByVariation?: StockByVariation[]
    minStock: number
  }>
  totalStock: number
}

export interface ProductStockAlert {
  productId: number
  productName: string
  establishmentId: number
  establishmentName: string
  currentStock: number
  minStock: number
  variation?: string
  severity: 'low' | 'critical' // low = stock < min, critical = stock = 0
}

// ==========================================
// RÉSULTATS DE SYNCHRONISATION
// ==========================================

export interface SyncResult {
  success: boolean
  syncGroupId: number
  entityType: SyncEntityType
  entityId: number
  sourceEstablishmentId: number
  targetEstablishments: number[]
  syncedFields: string[]
  errors: Array<{
    establishmentId: number
    error: string
  }>
  timestamp: Date
}
