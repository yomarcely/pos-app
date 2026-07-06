import { pgTable, index, pgPolicy, serial, varchar, text, boolean, timestamp, foreignKey, integer, unique, numeric, jsonb, pgSequence } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"


export const movementNumberSeq = pgSequence("movement_number_seq", {  startWith: "1", increment: "1", minValue: "1", maxValue: "9223372036854775807", cache: "1", cycle: false })

export const establishments = pgTable("establishments", {
	id: serial().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 64 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	address: text(),
	postalCode: varchar("postal_code", { length: 10 }),
	city: varchar({ length: 100 }),
	country: varchar({ length: 100 }).default('France'),
	phone: varchar({ length: 20 }),
	email: varchar({ length: 255 }),
	siret: varchar({ length: 14 }),
	naf: varchar({ length: 5 }),
	tvaNumber: varchar("tva_number", { length: 20 }),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("establishments_tenant_id_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	pgPolicy("Users can view their own establishments", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((tenant_id)::text = (auth.uid())::text)` }),
	pgPolicy("Users can create their own establishments", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can update their own establishments", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can delete their own establishments", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const registers = pgTable("registers", {
	id: serial().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 64 }).notNull(),
	establishmentId: integer("establishment_id").notNull(),
	name: varchar({ length: 100 }).notNull(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("registers_establishment_id_idx").using("btree", table.establishmentId.asc().nullsLast().op("int4_ops")),
	index("registers_tenant_id_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.establishmentId],
			foreignColumns: [establishments.id],
			name: "registers_establishment_id_establishments_id_fk"
		}),
	pgPolicy("Users can view their own registers", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((tenant_id)::text = (auth.uid())::text)` }),
	pgPolicy("Users can create their own registers", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can update their own registers", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can delete their own registers", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const suppliers = pgTable("suppliers", {
	id: serial().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 64 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	contact: varchar({ length: 100 }),
	email: varchar({ length: 255 }),
	phone: varchar({ length: 20 }),
	address: text(),
	isArchived: boolean("is_archived").default(false),
	archivedAt: timestamp("archived_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("suppliers_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("suppliers_tenant_id_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	pgPolicy("Users can view their own suppliers", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((tenant_id)::text = (auth.uid())::text)` }),
	pgPolicy("Users can create their own suppliers", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can update their own suppliers", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can delete their own suppliers", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const variationGroups = pgTable("variation_groups", {
	id: serial().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 64 }).notNull(),
	name: varchar({ length: 100 }).notNull(),
	isArchived: boolean("is_archived").default(false),
	archivedAt: timestamp("archived_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("variation_groups_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("variation_groups_tenant_id_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	pgPolicy("Users can view their own variation groups", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((tenant_id)::text = (auth.uid())::text)` }),
	pgPolicy("Users can create their own variation groups", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can update their own variation groups", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can delete their own variation groups", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const variations = pgTable("variations", {
	id: serial().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 64 }).notNull(),
	groupId: integer("group_id").notNull(),
	name: varchar({ length: 100 }).notNull(),
	sortOrder: integer("sort_order").default(0),
	isArchived: boolean("is_archived").default(false),
	archivedAt: timestamp("archived_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("variations_group_id_idx").using("btree", table.groupId.asc().nullsLast().op("int4_ops")),
	index("variations_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("variations_tenant_id_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.groupId],
			foreignColumns: [variationGroups.id],
			name: "variations_group_id_variation_groups_id_fk"
		}).onDelete("cascade"),
	pgPolicy("Users can view their own variations", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((tenant_id)::text = (auth.uid())::text)` }),
	pgPolicy("Users can create their own variations", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can update their own variations", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can delete their own variations", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const movements = pgTable("movements", {
	id: serial().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 64 }).notNull(),
	movementNumber: varchar("movement_number", { length: 50 }).notNull(),
	type: varchar({ length: 50 }).notNull(),
	comment: text(),
	userId: integer("user_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("movements_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("movements_movement_number_idx").using("btree", table.movementNumber.asc().nullsLast().op("text_ops")),
	index("movements_tenant_id_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	index("movements_type_idx").using("btree", table.type.asc().nullsLast().op("text_ops")),
	unique("movements_movement_number_unique").on(table.movementNumber),
	pgPolicy("Users can view their own movements", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((tenant_id)::text = (auth.uid())::text)` }),
	pgPolicy("Users can create their own movements", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can update their own movements", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can delete their own movements", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const sellers = pgTable("sellers", {
	id: serial().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 64 }).notNull(),
	name: varchar({ length: 100 }).notNull(),
	code: varchar({ length: 20 }),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("sellers_tenant_id_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	unique("sellers_code_unique").on(table.code),
	pgPolicy("Users can create their own sellers", { as: "permissive", for: "insert", to: ["authenticated"], withCheck: sql`((tenant_id)::text = (auth.uid())::text)`  }),
	pgPolicy("Users can view their own sellers", { as: "permissive", for: "select", to: ["authenticated"] }),
	pgPolicy("Users can update their own sellers", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can delete their own sellers", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const archives = pgTable("archives", {
	id: serial().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 64 }).notNull(),
	periodStart: timestamp("period_start", { withTimezone: true, mode: 'string' }).notNull(),
	periodEnd: timestamp("period_end", { withTimezone: true, mode: 'string' }).notNull(),
	archiveType: varchar("archive_type", { length: 50 }).notNull(),
	filePath: text("file_path").notNull(),
	fileSize: integer("file_size"),
	fileHash: varchar("file_hash", { length: 64 }).notNull(),
	salesCount: integer("sales_count").notNull(),
	totalAmount: numeric("total_amount", { precision: 12, scale:  2 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("archives_archive_type_idx").using("btree", table.archiveType.asc().nullsLast().op("text_ops")),
	index("archives_period_start_idx").using("btree", table.periodStart.asc().nullsLast().op("timestamptz_ops")),
	index("archives_tenant_id_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	pgPolicy("Users can view their own archives", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((tenant_id)::text = (auth.uid())::text)` }),
	pgPolicy("Users can create their own archives", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can update their own archives", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can delete their own archives", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const products = pgTable("products", {
	id: serial().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 64 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	barcode: varchar({ length: 50 }),
	barcodeByVariation: jsonb("barcode_by_variation"),
	categoryId: integer("category_id"),
	supplierId: integer("supplier_id"),
	brandId: integer("brand_id"),
	supplierCode: varchar("supplier_code", { length: 100 }),
	price: numeric({ precision: 10, scale:  2 }).notNull(),
	purchasePrice: numeric("purchase_price", { precision: 10, scale:  2 }),
	tva: numeric({ precision: 5, scale:  2 }).default('20').notNull(),
	stock: integer().default(0),
	stockByVariation: jsonb("stock_by_variation"),
	minStock: integer("min_stock").default(5),
	minStockByVariation: jsonb("min_stock_by_variation"),
	variationGroupIds: jsonb("variation_group_ids"),
	image: text(),
	description: text(),
	isArchived: boolean("is_archived").default(false),
	archivedAt: timestamp("archived_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("products_barcode_idx").using("btree", table.barcode.asc().nullsLast().op("text_ops")),
	index("products_brand_id_idx").using("btree", table.brandId.asc().nullsLast().op("int4_ops")),
	index("products_category_id_idx").using("btree", table.categoryId.asc().nullsLast().op("int4_ops")),
	index("products_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("products_supplier_id_idx").using("btree", table.supplierId.asc().nullsLast().op("int4_ops")),
	index("products_tenant_id_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.brandId],
			foreignColumns: [brands.id],
			name: "products_brand_id_brands_id_fk"
		}),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "products_category_id_categories_id_fk"
		}),
	foreignKey({
			columns: [table.supplierId],
			foreignColumns: [suppliers.id],
			name: "products_supplier_id_suppliers_id_fk"
		}),
	pgPolicy("Users can view their own products", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((tenant_id)::text = (auth.uid())::text)` }),
	pgPolicy("Users can create their own products", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can update their own products", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can delete their own products", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const categories = pgTable("categories", {
	id: serial().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 64 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	parentId: integer("parent_id"),
	sortOrder: integer("sort_order").default(0),
	icon: varchar({ length: 50 }),
	color: varchar({ length: 20 }),
	isArchived: boolean("is_archived").default(false),
	archivedAt: timestamp("archived_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("categories_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("categories_parent_id_idx").using("btree", table.parentId.asc().nullsLast().op("int4_ops")),
	index("categories_tenant_id_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	pgPolicy("Users can view their own categories", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((tenant_id)::text = (auth.uid())::text)` }),
	pgPolicy("Users can create their own categories", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can update their own categories", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can delete their own categories", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const customers = pgTable("customers", {
	id: serial().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 64 }).notNull(),
	firstName: varchar("first_name", { length: 100 }),
	lastName: varchar("last_name", { length: 100 }),
	email: varchar({ length: 255 }),
	phone: varchar({ length: 20 }),
	address: text(),
	gdprConsent: boolean("gdpr_consent").default(false).notNull(),
	gdprConsentDate: timestamp("gdpr_consent_date", { withTimezone: true, mode: 'string' }),
	marketingConsent: boolean("marketing_consent").default(false),
	loyaltyProgram: boolean("loyalty_program").default(false),
	discount: numeric({ precision: 5, scale:  2 }).default('0'),
	notes: text(),
	alerts: text(),
	metadata: jsonb(),
	isAnonymized: boolean("is_anonymized").default(false),
	anonymizedAt: timestamp("anonymized_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("customers_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("customers_phone_idx").using("btree", table.phone.asc().nullsLast().op("text_ops")),
	index("customers_tenant_id_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	pgPolicy("Users can view their own customers", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((tenant_id)::text = (auth.uid())::text)` }),
	pgPolicy("Users can create their own customers", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can update their own customers", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can delete their own customers", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const brands = pgTable("brands", {
	id: serial().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 64 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	isArchived: boolean("is_archived").default(false),
	archivedAt: timestamp("archived_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("brands_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("brands_tenant_id_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	pgPolicy("Users can view their own brands", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((tenant_id)::text = (auth.uid())::text)` }),
	pgPolicy("Users can create their own brands", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can update their own brands", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can delete their own brands", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const sales = pgTable("sales", {
	id: serial().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 64 }).notNull(),
	ticketNumber: varchar("ticket_number", { length: 50 }).notNull(),
	saleDate: timestamp("sale_date", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	totalHt: numeric("total_ht", { precision: 10, scale:  2 }).notNull(),
	totalTva: numeric("total_tva", { precision: 10, scale:  2 }).notNull(),
	totalTtc: numeric("total_ttc", { precision: 10, scale:  2 }).notNull(),
	globalDiscount: numeric("global_discount", { precision: 10, scale:  2 }).default('0'),
	globalDiscountType: varchar("global_discount_type", { length: 1 }).default('%'),
	sellerId: integer("seller_id"),
	customerId: integer("customer_id"),
	payments: jsonb().notNull(),
	previousHash: varchar("previous_hash", { length: 64 }),
	currentHash: varchar("current_hash", { length: 64 }).notNull(),
	signature: text(),
	status: varchar({ length: 20 }).default('completed').notNull(),
	cancellationReason: text("cancellation_reason"),
	cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: 'string' }),
	closureId: integer("closure_id"),
	closedAt: timestamp("closed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("sales_closure_id_idx").using("btree", table.closureId.asc().nullsLast().op("int4_ops")),
	index("sales_customer_id_idx").using("btree", table.customerId.asc().nullsLast().op("int4_ops")),
	index("sales_sale_date_idx").using("btree", table.saleDate.asc().nullsLast().op("timestamptz_ops")),
	index("sales_seller_id_idx").using("btree", table.sellerId.asc().nullsLast().op("int4_ops")),
	index("sales_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("sales_tenant_id_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	index("sales_ticket_number_idx").using("btree", table.ticketNumber.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.closureId],
			foreignColumns: [closures.id],
			name: "sales_closure_id_closures_id_fk"
		}),
	foreignKey({
			columns: [table.customerId],
			foreignColumns: [customers.id],
			name: "sales_customer_id_customers_id_fk"
		}),
	foreignKey({
			columns: [table.sellerId],
			foreignColumns: [sellers.id],
			name: "sales_seller_id_sellers_id_fk"
		}),
	unique("sales_ticket_number_unique").on(table.ticketNumber),
	pgPolicy("Users can view their own sales", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((tenant_id)::text = (auth.uid())::text)` }),
	pgPolicy("Users can create their own sales", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can update their own sales", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can delete their own sales", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const saleItems = pgTable("sale_items", {
	id: serial().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 64 }).notNull(),
	saleId: integer("sale_id").notNull(),
	productId: integer("product_id").notNull(),
	productName: varchar("product_name", { length: 255 }).notNull(),
	variation: varchar({ length: 100 }),
	quantity: integer().notNull(),
	originalPrice: numeric("original_price", { precision: 10, scale:  2 }),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }).notNull(),
	discount: numeric({ precision: 10, scale:  2 }).default('0'),
	discountType: varchar("discount_type", { length: 1 }).default('%'),
	tva: numeric({ precision: 5, scale:  2 }).notNull(),
	totalHt: numeric("total_ht", { precision: 10, scale:  2 }).notNull(),
	totalTtc: numeric("total_ttc", { precision: 10, scale:  2 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("sale_items_sale_id_idx").using("btree", table.saleId.asc().nullsLast().op("int4_ops")),
	index("sale_items_tenant_id_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "sale_items_product_id_products_id_fk"
		}),
	foreignKey({
			columns: [table.saleId],
			foreignColumns: [sales.id],
			name: "sale_items_sale_id_sales_id_fk"
		}).onDelete("cascade"),
	pgPolicy("Users can view their own sale items", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((tenant_id)::text = (auth.uid())::text)` }),
	pgPolicy("Users can create their own sale items", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can update their own sale items", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can delete their own sale items", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const stockMovements = pgTable("stock_movements", {
	id: serial().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 64 }).notNull(),
	movementId: integer("movement_id"),
	productId: integer("product_id").notNull(),
	variation: varchar({ length: 100 }),
	quantity: integer().notNull(),
	oldStock: integer("old_stock").notNull(),
	newStock: integer("new_stock").notNull(),
	reason: varchar({ length: 50 }).notNull(),
	saleId: integer("sale_id"),
	userId: integer("user_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("stock_movements_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("stock_movements_movement_id_idx").using("btree", table.movementId.asc().nullsLast().op("int4_ops")),
	index("stock_movements_product_id_idx").using("btree", table.productId.asc().nullsLast().op("int4_ops")),
	index("stock_movements_reason_idx").using("btree", table.reason.asc().nullsLast().op("text_ops")),
	index("stock_movements_tenant_id_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.movementId],
			foreignColumns: [movements.id],
			name: "stock_movements_movement_id_movements_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "stock_movements_product_id_products_id_fk"
		}),
	foreignKey({
			columns: [table.saleId],
			foreignColumns: [sales.id],
			name: "stock_movements_sale_id_sales_id_fk"
		}),
	pgPolicy("Users can view their own stock movements", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((tenant_id)::text = (auth.uid())::text)` }),
	pgPolicy("Users can create their own stock movements", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can update their own stock movements", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can delete their own stock movements", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const closures = pgTable("closures", {
	id: serial().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 64 }).notNull(),
	closureDate: varchar("closure_date", { length: 10 }).notNull(),
	ticketCount: integer("ticket_count").default(0).notNull(),
	cancelledCount: integer("cancelled_count").default(0).notNull(),
	totalHt: numeric("total_ht", { precision: 12, scale:  2 }).notNull(),
	totalTva: numeric("total_tva", { precision: 12, scale:  2 }).notNull(),
	totalTtc: numeric("total_ttc", { precision: 12, scale:  2 }).notNull(),
	paymentMethods: jsonb("payment_methods").notNull(),
	closureHash: varchar("closure_hash", { length: 64 }).notNull(),
	firstTicketNumber: varchar("first_ticket_number", { length: 50 }),
	lastTicketNumber: varchar("last_ticket_number", { length: 50 }),
	lastTicketHash: varchar("last_ticket_hash", { length: 64 }),
	closedBy: varchar("closed_by", { length: 100 }),
	closedById: integer("closed_by_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("closures_closure_date_idx").using("btree", table.closureDate.asc().nullsLast().op("text_ops")),
	index("closures_closure_hash_idx").using("btree", table.closureHash.asc().nullsLast().op("text_ops")),
	index("closures_tenant_id_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	unique("closures_closure_hash_unique").on(table.closureHash),
	pgPolicy("Users can view their own closures", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((tenant_id)::text = (auth.uid())::text)` }),
	pgPolicy("Users can create their own closures", { as: "permissive", for: "insert", to: ["authenticated"] }),
	pgPolicy("Users can update their own closures", { as: "permissive", for: "update", to: ["authenticated"] }),
	pgPolicy("Users can delete their own closures", { as: "permissive", for: "delete", to: ["authenticated"] }),
]);

export const auditLogs = pgTable("audit_logs", {
	id: serial().primaryKey().notNull(),
	tenantId: varchar("tenant_id", { length: 64 }).notNull(),
	userId: integer("user_id"),
	userName: varchar("user_name", { length: 100 }),
	entityType: varchar("entity_type", { length: 50 }).notNull(),
	entityId: integer("entity_id").notNull(),
	action: varchar({ length: 50 }).notNull(),
	changes: jsonb(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	ipAddress: varchar("ip_address", { length: 45 }),
}, (table) => [
	index("audit_logs_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("audit_logs_entity_id_idx").using("btree", table.entityId.asc().nullsLast().op("int4_ops")),
	index("audit_logs_entity_type_idx").using("btree", table.entityType.asc().nullsLast().op("text_ops")),
	index("audit_logs_tenant_id_idx").using("btree", table.tenantId.asc().nullsLast().op("text_ops")),
	pgPolicy("Users can view their own audit logs", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((tenant_id)::text = (auth.uid())::text)` }),
	pgPolicy("Users can create their own audit logs", { as: "permissive", for: "insert", to: ["authenticated"] }),
]);
