CREATE TABLE "statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"co_owner_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"html_url" text NOT NULL,
	"total_share_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "statements_month_range" CHECK ("statements"."month" >= 1 AND "statements"."month" <= 12)
);
--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_co_owner_id_users_id_fk" FOREIGN KEY ("co_owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "statements_user_month_idx" ON "statements" USING btree ("co_owner_id","year","month");