DO $$ BEGIN
 CREATE TYPE "public"."payment_intent_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PaymentIntent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_name" varchar(64) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'RUB' NOT NULL,
	"status" "payment_intent_status" DEFAULT 'pending' NOT NULL,
	"external_transaction_id" varchar(128),
	"external_subscription_id" varchar(128),
	"failure_reason" text,
	"metadata" jsonb,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_intent_session_id_idx" ON "PaymentIntent" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_intent_user_id_status_idx" ON "PaymentIntent" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_intent_expires_at_idx" ON "PaymentIntent" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_intent_created_at_idx" ON "PaymentIntent" USING btree ("created_at");