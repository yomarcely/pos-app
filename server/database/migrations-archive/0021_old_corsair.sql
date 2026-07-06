ALTER TABLE "sales" ADD COLUMN "type" varchar(20) DEFAULT 'sale' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "original_sale_id" integer;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "credit_note_id" integer;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_original_sale_id_sales_id_fk" FOREIGN KEY ("original_sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_credit_note_id_sales_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_original_sale_id_idx" ON "sales" USING btree ("original_sale_id");