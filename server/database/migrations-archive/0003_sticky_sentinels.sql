CREATE TABLE "registers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"establishment_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"number" varchar(20) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registers" ADD CONSTRAINT "registers_establishment_id_establishments_id_fk" FOREIGN KEY ("establishment_id") REFERENCES "public"."establishments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registers_tenant_id_idx" ON "registers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "registers_establishment_id_idx" ON "registers" USING btree ("establishment_id");--> statement-breakpoint
CREATE INDEX "registers_unique_number_establishment" ON "registers" USING btree ("establishment_id","number");