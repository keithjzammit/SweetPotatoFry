CREATE TYPE "public"."expense_category" AS ENUM('white_goods', 'repair_over_200', 'utilities', 'other');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('apartment', 'maisonette', 'penthouse', 'townhouse', 'villa', 'garage', 'airspace');--> statement-breakpoint
CREATE TYPE "public"."rent_status" AS ENUM('pending', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."tax_election" AS ENUM('FWT_15', 'standard_rates');--> statement-breakpoint
CREATE TYPE "public"."user_locale" AS ENUM('en', 'es');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'co_owner', 'manager');--> statement-breakpoint
CREATE TYPE "public"."work_status" AS ENUM('scheduled', 'in_progress', 'done', 'cancelled');--> statement-breakpoint
CREATE TABLE "approval_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid,
	"owner_id" uuid NOT NULL,
	"threshold_cents" integer DEFAULT 50000 NOT NULL,
	"required_approvers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(80) NOT NULL,
	"entity_type" varchar(40) NOT NULL,
	"entity_id" uuid NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"category" "expense_category" NOT NULL,
	"description" text NOT NULL,
	"incurred_on" date NOT NULL,
	"logged_by" uuid NOT NULL,
	"receipt_url" text NOT NULL,
	"status" "expense_status" DEFAULT 'pending' NOT NULL,
	"approval_log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"invited_by" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "leases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"manager_id" uuid NOT NULL,
	"monthly_fee_cents" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"ll_number" varchar(40),
	"ha_registered" boolean DEFAULT false NOT NULL,
	"rebate_band_id" integer,
	"article_31e_flag" boolean DEFAULT false NOT NULL,
	"handover_notes" text,
	"lease_pdf_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maltese_localities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "maltese_localities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name_en" varchar(80) NOT NULL,
	"name_mt" varchar(80) NOT NULL,
	CONSTRAINT "maltese_localities_name_en_unique" UNIQUE("name_en")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body_original" text NOT NULL,
	"body_lang" varchar(5) NOT NULL,
	"body_translated_en" text,
	"body_translated_es" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_prefs" (
	"user_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"push" boolean DEFAULT true NOT NULL,
	"email" boolean DEFAULT true NOT NULL,
	"digest" boolean DEFAULT false NOT NULL,
	CONSTRAINT "notification_prefs_user_id_event_type_pk" PRIMARY KEY("user_id","event_type")
);
--> statement-breakpoint
CREATE TABLE "ownership_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid,
	"user_id" uuid NOT NULL,
	"percentage_bps" integer NOT NULL,
	"effective_from" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ownership_splits_bps_range" CHECK ("ownership_splits"."percentage_bps" > 0 AND "ownership_splits"."percentage_bps" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"address_line" varchar(240) NOT NULL,
	"locality_id" integer NOT NULL,
	"post_code" varchar(10) NOT NULL,
	"type" "property_type" NOT NULL,
	"bedrooms" integer NOT NULL,
	"bathrooms" integer NOT NULL,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_tax_election" "tax_election" DEFAULT 'FWT_15' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rebate_bands" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rebate_bands_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bedrooms" integer NOT NULL,
	"min_duration_years" integer NOT NULL,
	"annual_rebate_cents" integer NOT NULL,
	"effective_from" date NOT NULL,
	CONSTRAINT "rebate_bands_bedrooms_check" CHECK ("rebate_bands"."bedrooms" >= 0),
	CONSTRAINT "rebate_bands_duration_check" CHECK ("rebate_bands"."min_duration_years" >= 0),
	CONSTRAINT "rebate_bands_amount_check" CHECK ("rebate_bands"."annual_rebate_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rent_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"paid_on" date NOT NULL,
	"logged_by" uuid NOT NULL,
	"receipt_url" text,
	"status" "rent_status" DEFAULT 'pending' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_elections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"tax_year" integer NOT NULL,
	"election" "tax_election" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tax_elections_year_check" CHECK ("tax_elections"."tax_year" >= 2020 AND "tax_elections"."tax_year" <= 2100)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(120),
	"locale" "user_locale" DEFAULT 'en' NOT NULL,
	"role" "user_role" NOT NULL,
	"google_refresh_token" text,
	"push_subscriptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "works" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"scheduled_start" timestamp with time zone,
	"scheduled_end" timestamp with time zone,
	"assigned_to" uuid,
	"status" "work_status" DEFAULT 'scheduled' NOT NULL,
	"google_event_id" text,
	"before_photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"after_photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completion_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approval_rules" ADD CONSTRAINT "approval_rules_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_rules" ADD CONSTRAINT "approval_rules_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_logged_by_users_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leases" ADD CONSTRAINT "leases_rebate_band_id_rebate_bands_id_fk" FOREIGN KEY ("rebate_band_id") REFERENCES "public"."rebate_bands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_splits" ADD CONSTRAINT "ownership_splits_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_splits" ADD CONSTRAINT "ownership_splits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_locality_id_maltese_localities_id_fk" FOREIGN KEY ("locality_id") REFERENCES "public"."maltese_localities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_logged_by_users_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_elections" ADD CONSTRAINT "tax_elections_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rebate_bands_unique_idx" ON "rebate_bands" USING btree ("bedrooms","min_duration_years","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "tax_elections_owner_year_idx" ON "tax_elections" USING btree ("owner_id","tax_year");