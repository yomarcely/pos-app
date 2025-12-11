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
  establishmentId: integer('establishment_id').references(() => establishments.id),
  registerId: integer('register_id').references(() => registers.id),

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
  establishmentIdIdx: index('sales_establishment_id_idx').on(table.establishmentId),
  registerIdIdx: index('sales_register_id_idx').on(table.registerId),
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

  // TVA (NF525 - traçabilité complète)
  tvaId: integer('tva_id').references(() => taxRates.id), // ID du taux de TVA
  tvaRate: decimal('tva_rate', { precision: 5, scale: 2 }).notNull(), // Taux copié pour archivage
  tvaCode: varchar('tva_code', { length: 10 }).notNull(), // Code TVA (ex: "T1") pour ticket NF525

  // Ancienne colonne TVA (deprecated - à supprimer après migration)
  tva: decimal('tva', { precision: 5, scale: 2 }),

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
// 7b. TAUX DE TVA (NF525)
// ==========================================
export const taxRates = pgTable('tax_rates', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  // Nom du taux (ex: "TVA 20%", "TVA 10%", "TVA 5.5%", "TVA 2.1%")
  name: varchar('name', { length: 100 }).notNull(),

  // Taux de TVA (pourcentage)
  rate: decimal('rate', { precision: 5, scale: 2 }).notNull(),

  // Code de TVA pour identification NF525 (ex: "T1", "T2", "T3")
  code: varchar('code', { length: 10 }).notNull(),

  // Description optionnelle
  description: text('description'),

  // Taux par défaut
  isDefault: boolean('is_default').default(false),

  // Archivage
  isArchived: boolean('is_archived').default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('tax_rates_tenant_id_idx').on(table.tenantId),
  rateIdx: index('tax_rates_rate_idx').on(table.rate),
  codeIdx: index('tax_rates_code_idx').on(table.code),
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

  // TVA (référence vers la table tax_rates)
  tvaId: integer('tva_id').references(() => taxRates.id),

  // Ancienne colonne TVA (deprecated - à supprimer après migration)
  tva: decimal('tva', { precision: 5, scale: 2 }),

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
// 10a. LIAISON VENDEURS-ÉTABLISSEMENTS
// ==========================================
export const sellerEstablishments = pgTable('seller_establishments', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  sellerId: integer('seller_id').notNull().references(() => sellers.id, { onDelete: 'cascade' }),
  establishmentId: integer('establishment_id').notNull().references(() => establishments.id, { onDelete: 'cascade' }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('seller_establishments_tenant_id_idx').on(table.tenantId),
  sellerIdIdx: index('seller_establishments_seller_id_idx').on(table.sellerId),
  establishmentIdIdx: index('seller_establishments_establishment_id_idx').on(table.establishmentId),
}))

// ==========================================
// 10b. ÉTABLISSEMENTS
// ==========================================

export const establishments = pgTable('establishments', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  // Informations de base
  name: varchar('name', { length: 255 }).notNull(),

  // Adresse
  address: text('address'),
  postalCode: varchar('postal_code', { length: 10 }),
  city: varchar('city', { length: 100 }),
  country: varchar('country', { length: 100 }).default('France'),

  // Contact
  phone: varchar('phone', { length: 20 }),
  email: varchar('email', { length: 255 }),

  // Informations légales
  siret: varchar('siret', { length: 14 }),
  naf: varchar('naf', { length: 5 }),
  tvaNumber: varchar('tva_number', { length: 20 }), // Numéro de TVA intracommunautaire

  // Statut
  isActive: boolean('is_active').default(true),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('establishments_tenant_id_idx').on(table.tenantId),
}))

// ==========================================
// 10c. CAISSES (REGISTRES)
// ==========================================

export const registers = pgTable('registers', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  // Relation avec l'établissement
  establishmentId: integer('establishment_id').notNull().references(() => establishments.id),

  // Informations de base
  name: varchar('name', { length: 100 }).notNull(), // Ex: "Caisse 1", "Caisse principale"

  // Statut
  isActive: boolean('is_active').default(true),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('registers_tenant_id_idx').on(table.tenantId),
  establishmentIdIdx: index('registers_establishment_id_idx').on(table.establishmentId),
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

  // Établissement concerné par le mouvement
  establishmentId: integer('establishment_id').references(() => establishments.id),

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
  establishmentIdIdx: index('stock_movements_establishment_id_idx').on(table.establishmentId),
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
  entityId: integer('entity_id'), // Nullable pour les événements système génériques
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

  // Caisse et établissement
  registerId: integer('register_id').notNull().references(() => registers.id),
  establishmentId: integer('establishment_id').references(() => establishments.id),

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
  registerIdIdx: index('closures_register_id_idx').on(table.registerId),
  establishmentIdIdx: index('closures_establishment_id_idx').on(table.establishmentId),
}))

// ==========================================
// 14. ARCHIVES (NF525 - Conservation 6 ans)
// ==========================================
export const archives = pgTable('archives', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  // Période archivée
  period: varchar('period', { length: 20 }).notNull(), // Ex: 2024-01 ou 2024
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),

  // Type d'archive
  archiveType: varchar('archive_type', { length: 50 }).notNull(), // daily, monthly, yearly

  // Scope
  registerId: integer('register_id'),

  // Fichier d'archive
  filePath: text('file_path'),
  fileSize: integer('file_size'),
  archiveHash: varchar('archive_hash', { length: 64 }).notNull(),
  archiveSignature: varchar('archive_signature', { length: 64 }),

  // Statistiques
  salesCount: integer('sales_count').notNull(),
  closuresCount: integer('closures_count').notNull().default(0),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),

  // Métadonnées supplémentaires
  metadata: jsonb('metadata').$type<Record<string, any>>().default({}),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('archives_tenant_id_idx').on(table.tenantId),
  periodStartIdx: index('archives_period_start_idx').on(table.periodStart),
  archiveTypeIdx: index('archives_archive_type_idx').on(table.archiveType),
}))

// ==========================================
// 15. GROUPES DE SYNCHRONISATION
// ==========================================
export const syncGroups = pgTable('sync_groups', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('sync_groups_tenant_id_idx').on(table.tenantId),
}))

// ==========================================
// 16. ÉTABLISSEMENTS DANS LES GROUPES DE SYNC
// ==========================================
export const syncGroupEstablishments = pgTable('sync_group_establishments', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  syncGroupId: integer('sync_group_id').notNull().references(() => syncGroups.id, { onDelete: 'cascade' }),
  establishmentId: integer('establishment_id').notNull().references(() => establishments.id, { onDelete: 'cascade' }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('sync_group_establishments_tenant_id_idx').on(table.tenantId),
  syncGroupIdIdx: index('sync_group_establishments_sync_group_id_idx').on(table.syncGroupId),
  establishmentIdIdx: index('sync_group_establishments_establishment_id_idx').on(table.establishmentId),
}))

// ==========================================
// 17. RÈGLES DE SYNCHRONISATION
// ==========================================
export const syncRules = pgTable('sync_rules', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  syncGroupId: integer('sync_group_id').notNull().references(() => syncGroups.id, { onDelete: 'cascade' }),
  entityType: varchar('entity_type', { length: 50 }).notNull(), // 'product' ou 'customer'

  // Champs à synchroniser pour les PRODUITS
  syncName: boolean('sync_name').default(true),
  syncDescription: boolean('sync_description').default(true),
  syncBarcode: boolean('sync_barcode').default(true),
  syncCategory: boolean('sync_category').default(true),
  syncSupplier: boolean('sync_supplier').default(true),
  syncBrand: boolean('sync_brand').default(true),
  syncPriceHt: boolean('sync_price_ht').default(true),
  syncPriceTtc: boolean('sync_price_ttc').default(false), // Prix TTC peut être différent par établissement
  syncTva: boolean('sync_tva').default(true),
  syncImage: boolean('sync_image').default(true),
  syncVariations: boolean('sync_variations').default(true),

  // Champs à synchroniser pour les CLIENTS
  syncCustomerInfo: boolean('sync_customer_info').default(true), // nom, prénom
  syncCustomerContact: boolean('sync_customer_contact').default(true), // email, tel
  syncCustomerAddress: boolean('sync_customer_address').default(true),
  syncCustomerGdpr: boolean('sync_customer_gdpr').default(true),
  syncLoyaltyProgram: boolean('sync_loyalty_program').default(false), // fidélité locale ou partagée ?
  syncDiscount: boolean('sync_discount').default(false),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('sync_rules_tenant_id_idx').on(table.tenantId),
  syncGroupIdIdx: index('sync_rules_sync_group_id_idx').on(table.syncGroupId),
}))

// ==========================================
// 18. STOCK PAR ÉTABLISSEMENT
// ==========================================
export const productStocks = pgTable('product_stocks', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  establishmentId: integer('establishment_id').notNull().references(() => establishments.id, { onDelete: 'cascade' }),

  // Stock global ou par variation
  stock: integer('stock').default(0),
  stockByVariation: jsonb('stock_by_variation').default('[]'),

  minStock: integer('min_stock').default(5),
  minStockByVariation: jsonb('min_stock_by_variation'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('product_stocks_tenant_id_idx').on(table.tenantId),
  productIdIdx: index('product_stocks_product_id_idx').on(table.productId),
  establishmentIdIdx: index('product_stocks_establishment_id_idx').on(table.establishmentId),
}))

// ==========================================
// 19. PARAMÈTRES PRODUITS PAR ÉTABLISSEMENT
// ==========================================
export const productEstablishments = pgTable('product_establishments', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  establishmentId: integer('establishment_id').notNull().references(() => establishments.id, { onDelete: 'cascade' }),

  // Prix spécifiques par établissement (si sync_price_ttc = FALSE)
  priceOverride: decimal('price_override', { precision: 10, scale: 2 }), // Prix TTC local si différent
  purchasePriceOverride: decimal('purchase_price_override', { precision: 10, scale: 2 }),

  // Overrides pour les champs non synchronisés (produits)
  supplierIdOverride: integer('supplier_id_override'), // Fournisseur local si syncSupplier = false
  categoryIdOverride: integer('category_id_override'), // Catégorie locale si syncCategory = false
  brandIdOverride: integer('brand_id_override'), // Marque locale si syncBrand = false
  nameOverride: varchar('name_override', { length: 255 }), // Nom local si syncName = false
  descriptionOverride: text('description_override'), // Description locale si syncDescription = false
  barcodeOverride: varchar('barcode_override', { length: 128 }), // Code-barres local si syncBarcode = false
  tvaOverride: decimal('tva_override', { precision: 5, scale: 2 }), // TVA locale si syncTva = false
  tvaIdOverride: integer('tva_id_override'), // ID TVA local si syncTva = false
  imageOverride: text('image_override'), // Image locale si syncImage = false
  variationGroupIdsOverride: integer('variation_group_ids_override').array(), // Variations locales si syncVariations = false

  // Autres paramètres locaux
  isAvailable: boolean('is_available').default(true), // Produit disponible dans cet établissement ?
  notes: text('notes'), // Notes spécifiques à l'établissement

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('product_establishments_tenant_id_idx').on(table.tenantId),
  productIdIdx: index('product_establishments_product_id_idx').on(table.productId),
  establishmentIdIdx: index('product_establishments_establishment_id_idx').on(table.establishmentId),
}))

// ==========================================
// 20. CLIENTS PAR ÉTABLISSEMENT
// ==========================================
export const customerEstablishments = pgTable('customer_establishments', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  customerId: integer('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
  establishmentId: integer('establishment_id').notNull().references(() => establishments.id, { onDelete: 'cascade' }),

  // Paramètres locaux
  localDiscount: decimal('local_discount', { precision: 5, scale: 2 }), // Remise spécifique à cet établissement
  localNotes: text('local_notes'),

  // Fidélité locale ou globale ?
  localLoyaltyPoints: integer('local_loyalty_points').default(0),

  // Overrides pour les champs non synchronisés (clients)
  firstNameOverride: varchar('first_name_override', { length: 100 }),
  lastNameOverride: varchar('last_name_override', { length: 100 }),
  emailOverride: varchar('email_override', { length: 255 }),
  phoneOverride: varchar('phone_override', { length: 20 }),
  addressOverride: text('address_override'),
  metadataOverride: jsonb('metadata_override'),
  gdprConsentOverride: boolean('gdpr_consent_override'),
  gdprConsentDateOverride: timestamp('gdpr_consent_date_override', { withTimezone: true }),
  marketingConsentOverride: boolean('marketing_consent_override'),
  loyaltyProgramOverride: boolean('loyalty_program_override'),
  discountOverride: decimal('discount_override', { precision: 5, scale: 2 }),

  firstPurchaseDate: timestamp('first_purchase_date', { withTimezone: true }),
  lastPurchaseDate: timestamp('last_purchase_date', { withTimezone: true }),
  totalPurchases: decimal('total_purchases', { precision: 10, scale: 2 }).default('0'),
  purchaseCount: integer('purchase_count').default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('customer_establishments_tenant_id_idx').on(table.tenantId),
  customerIdIdx: index('customer_establishments_customer_id_idx').on(table.customerId),
  establishmentIdIdx: index('customer_establishments_establishment_id_idx').on(table.establishmentId),
}))

// ==========================================
// 21. LOGS DE SYNCHRONISATION
// ==========================================
export const syncLogs = pgTable('sync_logs', {
  id: serial('id').primaryKey(),
  tenantId: varchar('tenant_id', { length: 64 }).notNull(),

  syncGroupId: integer('sync_group_id').notNull().references(() => syncGroups.id, { onDelete: 'cascade' }),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: integer('entity_id').notNull(),
  sourceEstablishmentId: integer('source_establishment_id').references(() => establishments.id),
  action: varchar('action', { length: 50 }).notNull(), // 'create', 'update', 'delete'
  syncedFields: jsonb('synced_fields'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdIdx: index('sync_logs_tenant_id_idx').on(table.tenantId),
  syncGroupIdIdx: index('sync_logs_sync_group_id_idx').on(table.syncGroupId),
  entityTypeIdx: index('sync_logs_entity_type_idx').on(table.entityType),
  createdAtIdx: index('sync_logs_created_at_idx').on(table.createdAt),
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
  taxRate: one(taxRates, {
    fields: [saleItems.tvaId],
    references: [taxRates.id],
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

export const taxRatesRelations = relations(taxRates, ({ many }) => ({
  products: many(products),
  saleItems: many(saleItems),
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
  taxRate: one(taxRates, {
    fields: [products.tvaId],
    references: [taxRates.id],
  }),
  saleItems: many(saleItems),
  stockMovements: many(stockMovements),
  productStocks: many(productStocks),
  productEstablishments: many(productEstablishments),
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
  establishment: one(establishments, {
    fields: [stockMovements.establishmentId],
    references: [establishments.id],
  }),
}))

export const sellersRelations = relations(sellers, ({ many }) => ({
  sales: many(sales),
  establishments: many(sellerEstablishments),
}))

export const establishmentsRelations = relations(establishments, ({ many }) => ({
  registers: many(registers),
  sales: many(sales),
  closures: many(closures),
  sellers: many(sellerEstablishments),
  syncGroups: many(syncGroupEstablishments),
  productStocks: many(productStocks),
  productEstablishments: many(productEstablishments),
  customerEstablishments: many(customerEstablishments),
}))

export const registersRelations = relations(registers, ({ one, many }) => ({
  establishment: one(establishments, {
    fields: [registers.establishmentId],
    references: [establishments.id],
  }),
  sales: many(sales),
  closures: many(closures),
}))

export const sellerEstablishmentsRelations = relations(sellerEstablishments, ({ one }) => ({
  seller: one(sellers, {
    fields: [sellerEstablishments.sellerId],
    references: [sellers.id],
  }),
  establishment: one(establishments, {
    fields: [sellerEstablishments.establishmentId],
    references: [establishments.id],
  }),
}))

// ==========================================
// NOUVELLES RELATIONS - SYNCHRONISATION
// ==========================================

export const syncGroupsRelations = relations(syncGroups, ({ many }) => ({
  establishments: many(syncGroupEstablishments),
  rules: many(syncRules),
  logs: many(syncLogs),
}))

export const syncGroupEstablishmentsRelations = relations(syncGroupEstablishments, ({ one }) => ({
  syncGroup: one(syncGroups, {
    fields: [syncGroupEstablishments.syncGroupId],
    references: [syncGroups.id],
  }),
  establishment: one(establishments, {
    fields: [syncGroupEstablishments.establishmentId],
    references: [establishments.id],
  }),
}))

export const syncRulesRelations = relations(syncRules, ({ one }) => ({
  syncGroup: one(syncGroups, {
    fields: [syncRules.syncGroupId],
    references: [syncGroups.id],
  }),
}))

export const productStocksRelations = relations(productStocks, ({ one }) => ({
  product: one(products, {
    fields: [productStocks.productId],
    references: [products.id],
  }),
  establishment: one(establishments, {
    fields: [productStocks.establishmentId],
    references: [establishments.id],
  }),
}))

export const productEstablishmentsRelations = relations(productEstablishments, ({ one }) => ({
  product: one(products, {
    fields: [productEstablishments.productId],
    references: [products.id],
  }),
  establishment: one(establishments, {
    fields: [productEstablishments.establishmentId],
    references: [establishments.id],
  }),
}))

export const customerEstablishmentsRelations = relations(customerEstablishments, ({ one }) => ({
  customer: one(customers, {
    fields: [customerEstablishments.customerId],
    references: [customers.id],
  }),
  establishment: one(establishments, {
    fields: [customerEstablishments.establishmentId],
    references: [establishments.id],
  }),
}))

export const syncLogsRelations = relations(syncLogs, ({ one }) => ({
  syncGroup: one(syncGroups, {
    fields: [syncLogs.syncGroupId],
    references: [syncGroups.id],
  }),
  sourceEstablishment: one(establishments, {
    fields: [syncLogs.sourceEstablishmentId],
    references: [establishments.id],
  }),
}))
