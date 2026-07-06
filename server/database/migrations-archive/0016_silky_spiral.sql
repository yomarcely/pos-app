CREATE TABLE "inventory_preparation_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"preparation_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"variation" varchar(100),
	"expected_stock" integer NOT NULL,
	"counted_stock" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_preparations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"preparation_number" varchar(50) NOT NULL,
	"name" varchar(255),
	"comment" text,
	"establishment_id" integer,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"validated_at" timestamp with time zone,
	"validated_movement_id" integer,
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_preparations_preparation_number_unique" UNIQUE("preparation_number")
);
--> statement-breakpoint
ALTER TABLE "inventory_preparation_items" ADD CONSTRAINT "inventory_preparation_items_preparation_id_inventory_preparations_id_fk" FOREIGN KEY ("preparation_id") REFERENCES "public"."inventory_preparations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_preparation_items" ADD CONSTRAINT "inventory_preparation_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_preparations" ADD CONSTRAINT "inventory_preparations_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_preparations" ADD CONSTRAINT "inventory_preparations_validated_movement_id_movements_id_fk" FOREIGN KEY ("validated_movement_id") REFERENCES "public"."movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_preparation_items_tenant_id_idx" ON "inventory_preparation_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inventory_preparation_items_preparation_id_idx" ON "inventory_preparation_items" USING btree ("preparation_id");--> statement-breakpoint
CREATE INDEX "inventory_preparation_items_product_id_idx" ON "inventory_preparation_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "inventory_preparations_tenant_id_idx" ON "inventory_preparations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inventory_preparations_status_idx" ON "inventory_preparations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inventory_preparations_establishment_id_idx" ON "inventory_preparations" USING btree ("establishment_id");--> statement-breakpoint
CREATE INDEX "inventory_preparations_created_at_idx" ON "inventory_preparations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "inventory_preparations_preparation_number_idx" ON "inventory_preparations" USING btree ("preparation_number");