ALTER TABLE "product_establishments" ADD COLUMN "name_override" varchar(255);--> statement-breakpoint
ALTER TABLE "product_establishments" ADD COLUMN "description_override" text;--> statement-breakpoint
ALTER TABLE "product_establishments" ADD COLUMN "barcode_override" varchar(128);--> statement-breakpoint
ALTER TABLE "product_establishments" ADD COLUMN "tva_override" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "product_establishments" ADD COLUMN "tva_id_override" integer;--> statement-breakpoint
ALTER TABLE "product_establishments" ADD COLUMN "image_override" text;--> statement-breakpoint
ALTER TABLE "product_establishments" ADD COLUMN "variation_group_ids_override" integer[];