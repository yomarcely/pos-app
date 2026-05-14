ALTER TABLE "customer_establishments" ADD COLUMN "first_name_override" varchar(100);--> statement-breakpoint
ALTER TABLE "customer_establishments" ADD COLUMN "last_name_override" varchar(100);--> statement-breakpoint
ALTER TABLE "customer_establishments" ADD COLUMN "email_override" varchar(255);--> statement-breakpoint
ALTER TABLE "customer_establishments" ADD COLUMN "phone_override" varchar(20);--> statement-breakpoint
ALTER TABLE "customer_establishments" ADD COLUMN "address_override" text;--> statement-breakpoint
ALTER TABLE "customer_establishments" ADD COLUMN "metadata_override" jsonb;--> statement-breakpoint
ALTER TABLE "customer_establishments" ADD COLUMN "gdpr_consent_override" boolean;--> statement-breakpoint
ALTER TABLE "customer_establishments" ADD COLUMN "gdpr_consent_date_override" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_establishments" ADD COLUMN "marketing_consent_override" boolean;--> statement-breakpoint
ALTER TABLE "customer_establishments" ADD COLUMN "loyalty_program_override" boolean;--> statement-breakpoint
ALTER TABLE "customer_establishments" ADD COLUMN "discount_override" numeric(5, 2);