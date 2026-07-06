ALTER TABLE "brands" ADD COLUMN "created_by_establishment_id" integer;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "created_by_establishment_id" integer;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "created_by_establishment_id" integer;--> statement-breakpoint
ALTER TABLE "variation_groups" ADD COLUMN "created_by_establishment_id" integer;--> statement-breakpoint
CREATE INDEX "brands_establishment_idx" ON "brands" USING btree ("created_by_establishment_id");--> statement-breakpoint
CREATE INDEX "categories_establishment_idx" ON "categories" USING btree ("created_by_establishment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_tenant_unique" ON "customers" USING btree ("email","tenant_id");--> statement-breakpoint
CREATE INDEX "suppliers_establishment_idx" ON "suppliers" USING btree ("created_by_establishment_id");--> statement-breakpoint
CREATE INDEX "variation_groups_establishment_idx" ON "variation_groups" USING btree ("created_by_establishment_id");