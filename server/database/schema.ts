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
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

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

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('sales_tenant_id_idx').on(table.tenantId),
  ticketNumberIdx: index('sales_ticket_number_idx').on(table.ticketNumber),
  saleDateIdx: index('sales_sale_date_idx').on(table.saleDate),
  closureIdIdx: index('sales_closure_id_idx').on(table.closureId),
  sellerIdIdx: index('sales_seller_id_idx').on(table.sellerId),
  customerIdIdx: index('sales_customer_id_idx').on(table.customerId),
  statusIdx: index('sales_status_idx').on(table.status),
}))

// ==========================================
// 2. LIGNES DE VENTE (ITEMS)
// ==========================================
export const saleItems = pgTable('sale_items', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  saleId: integer('sale_id').notNull().references(() => sales.id, { onDelete: 'cascade' }),

  // Produit
  productId: integer('product_id').notNull().references(() => products.id),
  productName: varchar('product_name', { length: 255 }).notNull(), // Copie pour archivage
  variation: varchar('variation', { length: 100 }),

  // Quantité et prix
  quantity: integer('quantity').notNull(),
  originalPrice: decimal('original_price', { precision: 10, scale: 2 }), // Prix d'origine avant remise
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(), // Prix final après remise

  // Remise ligne
  discount: decimal('discount', { precision: 10, scale: 2 }).default('0'),
  discountType: varchar('discount_type', { length: 1 }).default('%'),

  // TVA
  tva: decimal('tva', { precision: 5, scale: 2 }).notNull(),

  // Totaux ligne
  totalHT: decimal('total_ht', { precision: 10, scale: 2 }).notNull(),
  totalTTC: decimal('total_ttc', { precision: 10, scale: 2 }).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('sale_items_tenant_id_idx').on(table.tenantId),
  saleIdIdx: index('sale_items_sale_id_idx').on(table.saleId),
}))

// ==========================================
// 3. CATÉGORIES (ARBORESCENCE)
// ==========================================
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  name: varchar('name', { length: 255 }).notNull(),

  // Catégorie parente (null = catégorie racine)
  parentId: integer('parent_id'),

  // Ordre d'affichage
  sortOrder: integer('sort_order').default(0),

  // Métadonnées
  icon: varchar('icon', { length: 50 }), // Nom de l'icône
  color: varchar('color', { length: 20 }), // Code couleur hex

  // Archivage
  isArchived: boolean('is_archived').default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('categories_tenant_id_idx').on(table.tenantId),
  parentIdIdx: index('categories_parent_id_idx').on(table.parentId),
  nameIdx: index('categories_name_idx').on(table.name),
}))

// ==========================================
// 4. GROUPES DE VARIATIONS
// ==========================================
export const variationGroups = pgTable('variation_groups', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  name: varchar('name', { length: 100 }).notNull(), // Ex: "Couleur", "Taille"

  // Archivage
  isArchived: boolean('is_archived').default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('variation_groups_tenant_id_idx').on(table.tenantId),
  nameIdx: index('variation_groups_name_idx').on(table.name),
}))

// ==========================================
// 5. VARIATIONS
// ==========================================
export const variations = pgTable('variations', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  groupId: integer('group_id').notNull().references(() => variationGroups.id, { onDelete: 'cascade' }),

  name: varchar('name', { length: 100 }).notNull(), // Ex: "Rouge", "Bleu", "S", "M", "L"

  // Ordre d'affichage
  sortOrder: integer('sort_order').default(0),

  // Archivage
  isArchived: boolean('is_archived').default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('variations_tenant_id_idx').on(table.tenantId),
  groupIdIdx: index('variations_group_id_idx').on(table.groupId),
  nameIdx: index('variations_name_idx').on(table.name),
}))

// ==========================================
// 6. FOURNISSEURS
// ==========================================
export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  name: varchar('name', { length: 255 }).notNull(),
  contact: varchar('contact', { length: 100 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  address: text('address'),

  // Archivage
  isArchived: boolean('is_archived').default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('suppliers_tenant_id_idx').on(table.tenantId),
  nameIdx: index('suppliers_name_idx').on(table.name),
}))

// ==========================================
// 7. MARQUES
// ==========================================
export const brands = pgTable('brands', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  name: varchar('name', { length: 255 }).notNull(),

  // Archivage
  isArchived: boolean('is_archived').default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('brands_tenant_id_idx').on(table.tenantId),
  nameIdx: index('brands_name_idx').on(table.name),
}))

// ==========================================
// 8. PRODUITS
// ==========================================
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  name: varchar('name', { length: 255 }).notNull(),
  barcode: varchar('barcode', { length: 50 }), // Code-barres pour produit simple
  barcodeByVariation: jsonb('barcode_by_variation'), // { "variation_id": "barcode" }

  // Catégorie
  categoryId: integer('category_id').references(() => categories.id),

  // Fournisseur et Marque
  supplierId: integer('supplier_id').references(() => suppliers.id),
  brandId: integer('brand_id').references(() => brands.id),
  supplierCode: varchar('supplier_code', { length: 100 }), // Code interne fournisseur

  // Prix
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  purchasePrice: decimal('purchase_price', { precision: 10, scale: 2 }),

  // TVA
  tva: decimal('tva', { precision: 5, scale: 2 }).notNull().default('20'),

  // Stock
  stock: integer('stock').default(0),
  stockByVariation: jsonb('stock_by_variation'), // { "variation_id": stock_count }
  minStock: integer('min_stock').default(5), // Stock minimum pour alerte
  minStockByVariation: jsonb('min_stock_by_variation'), // { "variation_id": min_stock }

  // Variations - IDs des variations sélectionnées (ex: [3, 5, 7] pour Rouge, S, 0.15Ω)
  variationGroupIds: jsonb('variation_group_ids'), // Renommé mais contient maintenant les IDs des variations, pas des groupes

  // Métadonnées
  image: text('image'),
  description: text('description'),

  // RGPD - Archivage
  isArchived: boolean('is_archived').default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('products_tenant_id_idx').on(table.tenantId),
  barcodeIdx: index('products_barcode_idx').on(table.barcode),
  nameIdx: index('products_name_idx').on(table.name),
  categoryIdIdx: index('products_category_id_idx').on(table.categoryId),
  supplierIdIdx: index('products_supplier_id_idx').on(table.supplierId),
  brandIdIdx: index('products_brand_id_idx').on(table.brandId),
}))

// ==========================================
// 9. CLIENTS (RGPD)
// ==========================================
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

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
  tenantIdIdx: index('customers_tenant_id_idx').on(table.tenantId),
  emailIdx: index('customers_email_idx').on(table.email),
  phoneIdx: index('customers_phone_idx').on(table.phone),
}))

// ==========================================
// 10. VENDEURS
// ==========================================
export const sellers = pgTable('sellers', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 20 }).unique(),

  isActive: boolean('is_active').default(true),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('sellers_tenant_id_idx').on(table.tenantId),
}))

// ==========================================
// 11. MOUVEMENTS DE STOCK (AUDIT)
// ==========================================

// Table principale des mouvements (opérations groupées)
export const movements = pgTable('movements', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  // Numéro du mouvement (ex: REC-001, ADJ-001, LOSS-001)
  movementNumber: varchar('movement_number', { length: 50 }).notNull().unique(),

  // Type de mouvement
  type: varchar('type', { length: 50 }).notNull(), // reception, adjustment, loss, transfer

  // Commentaire/motif optionnel
  comment: text('comment'),

  // Utilisateur
  userId: integer('user_id'), // Futur : références vers table users

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('movements_tenant_id_idx').on(table.tenantId),
  typeIdx: index('movements_type_idx').on(table.type),
  createdAtIdx: index('movements_created_at_idx').on(table.createdAt),
  movementNumberIdx: index('movements_movement_number_idx').on(table.movementNumber),
}))

// Lignes de détail des mouvements de stock (par produit/variation)
export const stockMovements = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  // Référence vers le mouvement parent
  movementId: integer('movement_id').references(() => movements.id, { onDelete: 'cascade' }),

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
  tenantIdIdx: index('stock_movements_tenant_id_idx').on(table.tenantId),
  productIdIdx: index('stock_movements_product_id_idx').on(table.productId),
  movementIdIdx: index('stock_movements_movement_id_idx').on(table.movementId),
  reasonIdx: index('stock_movements_reason_idx').on(table.reason),
  createdAtIdx: index('stock_movements_created_at_idx').on(table.createdAt),
}))

// ==========================================
// 12. LOGS D'AUDIT (NF525 + RGPD)
// ==========================================
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

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
  tenantIdIdx: index('audit_logs_tenant_id_idx').on(table.tenantId),
  entityTypeIdx: index('audit_logs_entity_type_idx').on(table.entityType),
  entityIdIdx: index('audit_logs_entity_id_idx').on(table.entityId),
  createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
}))

// ==========================================
// 13. CLÔTURES DE JOURNÉE (NF525)
// ==========================================
export const closures = pgTable('closures', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

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
  tenantIdIdx: index('closures_tenant_id_idx').on(table.tenantId),
  closureDateIdx: index('closures_closure_date_idx').on(table.closureDate),
  closureHashIdx: index('closures_closure_hash_idx').on(table.closureHash),
}))

// ==========================================
// 14. ARCHIVES (NF525 - Conservation 6 ans)
// ==========================================
export const archives = pgTable('archives', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

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
  tenantIdIdx: index('archives_tenant_id_idx').on(table.tenantId),
  periodStartIdx: index('archives_period_start_idx').on(table.periodStart),
  archiveTypeIdx: index('archives_archive_type_idx').on(table.archiveType),
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

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'subcategories',
  }),
  subcategories: many(categories, {
    relationName: 'subcategories',
  }),
  products: many(products),
}))

export const variationGroupsRelations = relations(variationGroups, ({ many }) => ({
  variations: many(variations),
}))

export const variationsRelations = relations(variations, ({ one }) => ({
  group: one(variationGroups, {
    fields: [variations.groupId],
    references: [variationGroups.id],
  }),
}))

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  products: many(products),
}))

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
}))

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  supplier: one(suppliers, {
    fields: [products.supplierId],
    references: [suppliers.id],
  }),
  brand: one(brands, {
    fields: [products.brandId],
    references: [brands.id],
  }),
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
