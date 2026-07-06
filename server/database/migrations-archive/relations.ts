import { relations } from "drizzle-orm/relations";
import { establishments, registers, variationGroups, variations, brands, products, categories, suppliers, closures, sales, customers, sellers, saleItems, movements, stockMovements } from "./schema";

export const registersRelations = relations(registers, ({one}) => ({
	establishment: one(establishments, {
		fields: [registers.establishmentId],
		references: [establishments.id]
	}),
}));

export const establishmentsRelations = relations(establishments, ({many}) => ({
	registers: many(registers),
}));

export const variationsRelations = relations(variations, ({one}) => ({
	variationGroup: one(variationGroups, {
		fields: [variations.groupId],
		references: [variationGroups.id]
	}),
}));

export const variationGroupsRelations = relations(variationGroups, ({many}) => ({
	variations: many(variations),
}));

export const productsRelations = relations(products, ({one, many}) => ({
	brand: one(brands, {
		fields: [products.brandId],
		references: [brands.id]
	}),
	category: one(categories, {
		fields: [products.categoryId],
		references: [categories.id]
	}),
	supplier: one(suppliers, {
		fields: [products.supplierId],
		references: [suppliers.id]
	}),
	saleItems: many(saleItems),
	stockMovements: many(stockMovements),
}));

export const brandsRelations = relations(brands, ({many}) => ({
	products: many(products),
}));

export const categoriesRelations = relations(categories, ({many}) => ({
	products: many(products),
}));

export const suppliersRelations = relations(suppliers, ({many}) => ({
	products: many(products),
}));

export const salesRelations = relations(sales, ({one, many}) => ({
	closure: one(closures, {
		fields: [sales.closureId],
		references: [closures.id]
	}),
	customer: one(customers, {
		fields: [sales.customerId],
		references: [customers.id]
	}),
	seller: one(sellers, {
		fields: [sales.sellerId],
		references: [sellers.id]
	}),
	saleItems: many(saleItems),
	stockMovements: many(stockMovements),
}));

export const closuresRelations = relations(closures, ({many}) => ({
	sales: many(sales),
}));

export const customersRelations = relations(customers, ({many}) => ({
	sales: many(sales),
}));

export const sellersRelations = relations(sellers, ({many}) => ({
	sales: many(sales),
}));

export const saleItemsRelations = relations(saleItems, ({one}) => ({
	product: one(products, {
		fields: [saleItems.productId],
		references: [products.id]
	}),
	sale: one(sales, {
		fields: [saleItems.saleId],
		references: [sales.id]
	}),
}));

export const stockMovementsRelations = relations(stockMovements, ({one}) => ({
	movement: one(movements, {
		fields: [stockMovements.movementId],
		references: [movements.id]
	}),
	product: one(products, {
		fields: [stockMovements.productId],
		references: [products.id]
	}),
	sale: one(sales, {
		fields: [stockMovements.saleId],
		references: [sales.id]
	}),
}));

export const movementsRelations = relations(movements, ({many}) => ({
	stockMovements: many(stockMovements),
}));