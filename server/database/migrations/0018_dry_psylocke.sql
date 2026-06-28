ALTER TABLE "closures" DROP CONSTRAINT "closures_closure_hash_unique";--> statement-breakpoint
ALTER TABLE "sales" DROP CONSTRAINT "sales_ticket_number_unique";--> statement-breakpoint
ALTER TABLE "sellers" DROP CONSTRAINT "sellers_code_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "closures_tenant_closure_hash_unique" ON "closures" USING btree ("tenant_id","closure_hash");--> statement-breakpoint
CREATE INDEX "closures_tenant_register_closure_date_idx" ON "closures" USING btree ("tenant_id","register_id","closure_date");--> statement-breakpoint
CREATE INDEX "product_stocks_tenant_establishment_product_idx" ON "product_stocks" USING btree ("tenant_id","establishment_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_tenant_ticket_number_unique" ON "sales" USING btree ("tenant_id","ticket_number");--> statement-breakpoint
CREATE INDEX "sales_tenant_register_status_idx" ON "sales" USING btree ("tenant_id","register_id","status");--> statement-breakpoint
CREATE INDEX "sales_tenant_establishment_sale_date_idx" ON "sales" USING btree ("tenant_id","establishment_id","sale_date");--> statement-breakpoint
CREATE UNIQUE INDEX "sellers_tenant_code_unique" ON "sellers" USING btree ("tenant_id","code");