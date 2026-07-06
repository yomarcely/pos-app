ALTER TABLE "movements" ADD COLUMN "supplier_id" integer;--> statement-breakpoint
ALTER TABLE "movements" ADD COLUMN "delivery_note_number" varchar(100);--> statement-breakpoint
ALTER TABLE "movements" ADD COLUMN "establishment_id" integer;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movements" ADD CONSTRAINT "movements_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movements_supplier_id_idx" ON "movements" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "movements_establishment_id_idx" ON "movements" USING btree ("establishment_id");