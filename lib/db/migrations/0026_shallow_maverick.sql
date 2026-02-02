DO $$ BEGIN
 CREATE TYPE "public"."token_balance_transaction_type" AS ENUM('credit', 'debit', 'reset', 'adjustment');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TokenBalanceTransaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "token_balance_transaction_type" NOT NULL,
	"amount" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"reference_type" varchar(32),
	"reference_id" varchar(128),
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "token_balance" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "last_balance_reset_at" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TokenBalanceTransaction" ADD CONSTRAINT "TokenBalanceTransaction_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "token_balance_transaction_user_id_idx" ON "TokenBalanceTransaction" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "token_balance_transaction_type_idx" ON "TokenBalanceTransaction" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "token_balance_transaction_created_at_idx" ON "TokenBalanceTransaction" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "token_balance_transaction_user_created_idx" ON "TokenBalanceTransaction" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "token_balance_transaction_reference_idx" ON "TokenBalanceTransaction" USING btree ("reference_type","reference_id");