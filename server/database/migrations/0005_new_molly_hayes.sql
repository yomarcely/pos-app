ALTER TABLE "sales" ADD COLUMN "establishment_id" integer;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "register_id" integer;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_register_id_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_establishment_id_idx" ON "sales" USING btree ("establishment_id");--> statement-breakpoint
CREATE INDEX "sales_register_id_idx" ON "sales" USING btree ("register_id");