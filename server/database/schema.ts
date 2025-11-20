import { pgTable, serial, text, timestamp, integer, decimal, boolean, jsonb, index, varchar } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

/**
 * ==========================================
 * TABLES CONFORMES NF525
 * ==========================================
 *
 * Exigences NF525 :
 * - Inaltérabilité : Chaînage cryptographique des tickets
 * - Sécurisation : Hash SHA-256 + horodatage certifié
 * - Conservation : Archivage 6 ans minimum
 * - Traçabilité : Logs de toutes modifications
 */

// ==========================================
// 1. VENTES (TICKETS DE CAISSE) - NF525
// ==========================================
export const sales = pgTable('sales', {
  id: serial('id').primaryKey(),

  // Numéro de ticket unique et séquentiel (obligatoire NF525)
  ticketNumber: varchar('ticket_number', { length: 50 }).notNull().unique(),

  // Date et heure de la vente (horodatage certifié)
  saleDate: timestamp('sale_date', { withTimezone: true }).notNull().defaultNow(),

  // Montants
  totalHT: decimal('total_ht', { precision: 10, scale: 2 }).notNull(),
  totalTVA: decimal('total_tva', { precision: 10, scale: 2 }).notNull(),
  totalTTC: decimal('total_ttc', { precision: 10, scale: 2 }).notNull(),

  // Remise globale
  globalDiscount: decimal('global_discount', { precision: 10, scale: 2 }).default('0'),
  globalDiscountType: varchar('global_discount_type', { length: 1 }).default('%'), // '%' ou '€'

  // Relations
  sellerId: integer('seller_id').references(() => sellers.id),
  customerId: integer('customer_id').references(() => customers.id),

  // Modes de paiement (stocké en JSON)
  payments: jsonb('payments').notNull(), // [{ mode: 'Espèces', amount: 50.00 }, ...]

  // ==========================================
  // CHAÎNAGE CRYPTOGRAPHIQUE NF525
  // ==========================================

  // Hash du ticket précédent (chaînage)
  previousHash: varchar('previous_hash', { length: 64 }),

  // Hash du ticket actuel (SHA-256)
  currentHash: varchar('current_hash', { length: 64 }).notNull(),

  // Signature du ticket (pour certification INFOCERT)
  signature: text('signature'),

  // ==========================================
  // MÉTADONNÉES
  // ==========================================

  // Statut de la vente
  status: varchar('status', { length: 20 }).notNull().default('completed'), // completed, cancelled, archived

  // Raison d'annulation (si annulée)
  cancellationReason: text('cancellation_reason'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

  // ==========================================
  // CLÔTURE DE JOURNÉE (NF525)
  // ==========================================
  closureId: integer('closure_id').references(() => closures.id),
  closedAt: timestamp('closed_at', { withTimezone: true }),

  // Sync cloud
  syncStatus: varchar('sync_status', { length: 20 }).default('pending'), // pending, synced, failed
  syncedAt: timestamp('synced_at', { withTimezone: true }),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  ticketNumberIdx: index('sales_ticket_number_idx').on(table.ticketNumber),
  saleDateIdx: index('sales_sale_date_idx').on(table.saleDate),
  syncStatusIdx: index('sales_sync_status_idx').on(table.syncStatus),
  closureIdIdx: index('sales_closure_id_idx').on(table.closureId),
}))

// ==========================================
// 2. LIGNES DE VENTE (ITEMS)
// ==========================================
export const saleItems = pgTable('sale_items', {
  id: serial('id').primaryKey(),

  saleId: integer('sale_id').notNull().references(() => sales.id, { onDelete: 'cascade' }),

  // Produit
  productId: integer('product_id').notNull().references(() => products.id),
  productName: varchar('product_name', { length: 255 }).notNull(), // Copie pour archivage
  variation: varchar('variation', { length: 100 }),

  // Quantité et prix
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),

  // Remise ligne
  discount: decimal('discount', { precision: 10, scale: 2 }).default('0'),
  discountType: varchar('discount_type', { length: 1 }).default('%'),

  // TVA
  tva: decimal('tva', { precision: 5, scale: 2 }).notNull(),

  // Totaux ligne
  totalHT: decimal('total_ht', { precision: 10, scale: 2 }).notNull(),
  totalTTC: decimal('total_ttc', { precision: 10, scale: 2 }).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ==========================================
// 3. PRODUITS
// ==========================================
export const products = pgTable('products', {
  id: serial('id').primaryKey(),

  name: varchar('name', { length: 255 }).notNull(),
  barcode: varchar('barcode', { length: 50 }),

  // Prix
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  purchasePrice: decimal('purchase_price', { precision: 10, scale: 2 }),

  // TVA
  tva: decimal('tva', { precision: 5, scale: 2 }).notNull().default('20'),

  // Stock
  stock: integer('stock').default(0),
  stockByVariation: jsonb('stock_by_variation'), // { "noir": 10, "bleu": 5 }

  // Variations
  variationGroupIds: jsonb('variation_group_ids'), // ["color", "size"]

  // Métadonnées
  image: text('image'),
  description: text('description'),

  // RGPD - Archivage
  isArchived: boolean('is_archived').default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  barcodeIdx: index('products_barcode_idx').on(table.barcode),
  nameIdx: index('products_name_idx').on(table.name),
}))

// ==========================================
// 4. CLIENTS (RGPD)
// ==========================================
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),

  // Informations client
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  address: text('address'),

  // RGPD
  gdprConsent: boolean('gdpr_consent').default(false).notNull(),
  gdprConsentDate: timestamp('gdpr_consent_date', { withTimezone: true }),
  marketingConsent: boolean('marketing_consent').default(false),

  // Programme de fidélité
  loyaltyProgram: boolean('loyalty_program').default(false),
  discount: decimal('discount', { precision: 5, scale: 2 }).default('0'),

  // Notes et alertes
  notes: text('notes'),
  alerts: text('alerts'),

  // Métadonnées additionnelles (ville, code postal, etc.)
  metadata: jsonb('metadata'),

  // Anonymisation (droit à l'oubli)
  isAnonymized: boolean('is_anonymized').default(false),
  anonymizedAt: timestamp('anonymized_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailIdx: index('customers_email_idx').on(table.email),
  phoneIdx: index('customers_phone_idx').on(table.phone),
}))

// ==========================================
// 5. VENDEURS
// ==========================================
export const sellers = pgTable('sellers', {
  id: serial('id').primaryKey(),

  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 20 }).unique(),

  isActive: boolean('is_active').default(true),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ==========================================
// 6. MOUVEMENTS DE STOCK (AUDIT)
// ==========================================
export const stockMovements = pgTable('stock_movements', {
  id: serial('id').primaryKey(),

  productId: integer('product_id').notNull().references(() => products.id),
  variation: varchar('variation', { length: 100 }),

  // Mouvement
  quantity: integer('quantity').notNull(), // Positif = entrée, Négatif = sortie
  oldStock: integer('old_stock').notNull(),
  newStock: integer('new_stock').notNull(),

  // Raison
  reason: varchar('reason', { length: 50 }).notNull(), // sale, reception, inventory_adjustment, loss, return, sale_cancellation

  // Références
  saleId: integer('sale_id').references(() => sales.id),
  userId: integer('user_id'), // Futur : références vers table users

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  productIdIdx: index('stock_movements_product_id_idx').on(table.productId),
  reasonIdx: index('stock_movements_reason_idx').on(table.reason),
  createdAtIdx: index('stock_movements_created_at_idx').on(table.createdAt),
}))

// ==========================================
// 7. LOGS D'AUDIT (NF525 + RGPD)
// ==========================================
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),

  // Qui
  userId: integer('user_id'),
  userName: varchar('user_name', { length: 100 }),

  // Quoi
  entityType: varchar('entity_type', { length: 50 }).notNull(), // sale, product, customer, etc.
  entityId: integer('entity_id').notNull(),
  action: varchar('action', { length: 50 }).notNull(), // create, update, delete, anonymize

  // Détails
  changes: jsonb('changes'), // { field: { old: x, new: y } }
  metadata: jsonb('metadata'), // Données supplémentaires

  // Quand
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

  // IP (RGPD - traçabilité)
  ipAddress: varchar('ip_address', { length: 45 }),
}, (table) => ({
  entityTypeIdx: index('audit_logs_entity_type_idx').on(table.entityType),
  entityIdIdx: index('audit_logs_entity_id_idx').on(table.entityId),
  createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
}))

// ==========================================
// 8. CLÔTURES DE JOURNÉE (NF525)
// ==========================================
export const closures = pgTable('closures', {
  id: serial('id').primaryKey(),

  // Date de la journée clôturée
  closureDate: varchar('closure_date', { length: 10 }).notNull(), // Format YYYY-MM-DD

  // Statistiques de la journée
  ticketCount: integer('ticket_count').notNull().default(0),
  cancelledCount: integer('cancelled_count').notNull().default(0),

  // Totaux
  totalHT: decimal('total_ht', { precision: 12, scale: 2 }).notNull(),
  totalTVA: decimal('total_tva', { precision: 12, scale: 2 }).notNull(),
  totalTTC: decimal('total_ttc', { precision: 12, scale: 2 }).notNull(),

  // Modes de paiement
  paymentMethods: jsonb('payment_methods').notNull(), // { "Espèces": 150.00, "Carte": 250.00 }

  // Hash NF525 de clôture
  closureHash: varchar('closure_hash', { length: 64 }).notNull().unique(),

  // Premier et dernier ticket de la journée
  firstTicketNumber: varchar('first_ticket_number', { length: 50 }),
  lastTicketNumber: varchar('last_ticket_number', { length: 50 }),
  lastTicketHash: varchar('last_ticket_hash', { length: 64 }),

  // Métadonnées
  closedBy: varchar('closed_by', { length: 100 }),
  closedById: integer('closed_by_id'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  closureDateIdx: index('closures_closure_date_idx').on(table.closureDate),
  closureHashIdx: index('closures_closure_hash_idx').on(table.closureHash),
}))

// ==========================================
// 9. ARCHIVES (NF525 - Conservation 6 ans)
// ==========================================
export const archives = pgTable('archives', {
  id: serial('id').primaryKey(),

  // Période archivée
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),

  // Type d'archive
  archiveType: varchar('archive_type', { length: 50 }).notNull(), // daily, monthly, yearly

  // Fichier d'archive
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size'),
  fileHash: varchar('file_hash', { length: 64 }).notNull(),

  // Statistiques
  salesCount: integer('sales_count').notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  periodStartIdx: index('archives_period_start_idx').on(table.periodStart),
  archiveTypeIdx: index('archives_archive_type_idx').on(table.archiveType),
}))

// ==========================================
// 9. SYNC QUEUE (Offline -> Cloud)
// ==========================================
export const syncQueue = pgTable('sync_queue', {
  id: serial('id').primaryKey(),

  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: integer('entity_id').notNull(),
  action: varchar('action', { length: 20 }).notNull(), // create, update, delete

  data: jsonb('data').notNull(),

  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, synced, failed
  attempts: integer('attempts').default(0),
  lastError: text('last_error'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
}, (table) => ({
  statusIdx: index('sync_queue_status_idx').on(table.status),
  createdAtIdx: index('sync_queue_created_at_idx').on(table.createdAt),
}))

// ==========================================
// RELATIONS
// ==========================================

export const salesRelations = relations(sales, ({ one, many }) => ({
  seller: one(sellers, {
    fields: [sales.sellerId],
    references: [sellers.id],
  }),
  customer: one(customers, {
    fields: [sales.customerId],
    references: [customers.id],
  }),
  closure: one(closures, {
    fields: [sales.closureId],
    references: [closures.id],
  }),
  items: many(saleItems),
}))

export const closuresRelations = relations(closures, ({ many }) => ({
  sales: many(sales),
}))

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
}))

export const productsRelations = relations(products, ({ many }) => ({
  saleItems: many(saleItems),
  stockMovements: many(stockMovements),
}))

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  sale: one(sales, {
    fields: [stockMovements.saleId],
    references: [sales.id],
  }),
}))
