TRUNCATE TABLE "Balance", "UserSubscription", "PaymentIntent", "CancellationFeedback" CASCADE;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."balance_pool" AS ENUM('subscription', 'topup');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payment_intent_kind" AS ENUM('subscription', 'topup');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."subscription_status" AS ENUM('active', 'past_due', 'cancelled', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."transaction_type" AS ENUM('welcome', 'subscription_renewal', 'subscription_purchase', 'topup_purchase', 'usage_debit', 'refund', 'adjustment');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Currency" (
	"code" varchar(3) PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"symbol" varchar(8) NOT NULL,
	"minor_units" integer DEFAULT 2 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "FxRate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"quote_currency" varchar(3) NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"source" varchar(64) NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"display_name" varchar(128),
	"billing_period" "billing_period" DEFAULT 'monthly' NOT NULL,
	"billing_period_count" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SubscriptionPrice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"currency_code" varchar(3) NOT NULL,
	"price" bigint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"currency_code" varchar(3) NOT NULL,
	"pool" "balance_pool" NOT NULL,
	"amount" bigint NOT NULL,
	"subscription_balance_after" bigint NOT NULL,
	"topup_balance_after" bigint NOT NULL,
	"usd_cost" numeric(18, 10),
	"fx_rate" numeric(18, 8),
	"markup" numeric(6, 4),
	"model_id" varchar(128),
	"chat_id" uuid,
	"message_id" uuid,
	"reference_type" varchar(32),
	"reference_id" varchar(128),
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "ImageGenerationUsageLog";--> statement-breakpoint
DROP TABLE "SearchUsageLog";--> statement-breakpoint
DROP TABLE "SubscriptionPlan" CASCADE;--> statement-breakpoint
DROP TABLE "TokenBalanceTransaction";--> statement-breakpoint
DROP TABLE "TokenUsageLog";--> statement-breakpoint
DROP TABLE "UserTokenUsage";--> statement-breakpoint
DROP TABLE "VideoGenerationUsageLog";--> statement-breakpoint
ALTER TABLE "Document" RENAME COLUMN "text" TO "kind";--> statement-breakpoint
ALTER TABLE "CancellationFeedback" DROP CONSTRAINT "CancellationFeedback_subscription_id_UserSubscription_id_fk";
--> statement-breakpoint
ALTER TABLE "Chat" DROP CONSTRAINT "Chat_userId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Document" DROP CONSTRAINT "Document_userId_User_id_fk";
--> statement-breakpoint
ALTER TABLE "Message_v2" DROP CONSTRAINT "Message_v2_chatId_Chat_id_fk";
--> statement-breakpoint
ALTER TABLE "Stream" DROP CONSTRAINT "Stream_chatId_Chat_id_fk";
--> statement-breakpoint
ALTER TABLE "UserSubscription" DROP CONSTRAINT IF EXISTS "UserSubscription_plan_id_SubscriptionPlan_id_fk";
--> statement-breakpoint
ALTER TABLE "Vote_v2" DROP CONSTRAINT "Vote_v2_chatId_Chat_id_fk";
--> statement-breakpoint
ALTER TABLE "Vote_v2" DROP CONSTRAINT "Vote_v2_messageId_Message_v2_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "user_subscription_user_id_idx";--> statement-breakpoint
ALTER TABLE "CancellationFeedback" ALTER COLUMN "subscription_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "PaymentIntent" ALTER COLUMN "amount" SET DATA TYPE bigint USING "amount"::bigint;--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "email" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "password" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "UserSubscription" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "UserSubscription" ALTER COLUMN "status" SET DATA TYPE subscription_status USING "status"::subscription_status;--> statement-breakpoint
ALTER TABLE "UserSubscription" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "UserSubscription" ALTER COLUMN "last_payment_amount" SET DATA TYPE bigint USING "last_payment_amount"::bigint;--> statement-breakpoint
ALTER TABLE "Balance" ADD COLUMN "currency_code" varchar(3) NOT NULL;--> statement-breakpoint
ALTER TABLE "Balance" ADD COLUMN "subscription_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Balance" ADD COLUMN "topup_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "CancellationFeedback" ADD COLUMN "subscription_code" varchar(64);--> statement-breakpoint
ALTER TABLE "PaymentIntent" ADD COLUMN "kind" "payment_intent_kind" DEFAULT 'subscription' NOT NULL;--> statement-breakpoint
ALTER TABLE "PaymentIntent" ADD COLUMN "subscription_id" uuid;--> statement-breakpoint
ALTER TABLE "PaymentIntent" ADD COLUMN "currency_code" varchar(3) NOT NULL;--> statement-breakpoint
ALTER TABLE "UserSubscription" ADD COLUMN "subscription_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "UserSubscription" ADD COLUMN "currency_code" varchar(3) NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "FxRate" ADD CONSTRAINT "FxRate_quote_currency_Currency_code_fk" FOREIGN KEY ("quote_currency") REFERENCES "public"."Currency"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SubscriptionPrice" ADD CONSTRAINT "SubscriptionPrice_subscription_id_Subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."Subscription"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SubscriptionPrice" ADD CONSTRAINT "SubscriptionPrice_currency_code_Currency_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."Currency"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_currency_code_Currency_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."Currency"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_chat_id_Chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."Chat"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_message_id_Message_v2_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."Message_v2"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fx_rate_quote_fetched_idx" ON "FxRate" USING btree ("quote_currency","fetched_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_code_idx" ON "Subscription" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_price_sub_currency_idx" ON "SubscriptionPrice" USING btree ("subscription_id","currency_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_user_id_idx" ON "Transaction" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_user_created_idx" ON "Transaction" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_type_idx" ON "Transaction" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_reference_idx" ON "Transaction" USING btree ("reference_type","reference_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Balance" ADD CONSTRAINT "Balance_currency_code_Currency_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."Currency"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "CancellationFeedback" ADD CONSTRAINT "CancellationFeedback_subscription_id_UserSubscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."UserSubscription"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Message_v2" ADD CONSTRAINT "Message_v2_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_subscription_id_Subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."Subscription"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_currency_code_Currency_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."Currency"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Stream" ADD CONSTRAINT "Stream_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_subscription_id_Subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."Subscription"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_currency_code_Currency_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."Currency"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_messageId_Message_v2_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message_v2"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_subscription_active_user_idx" ON "UserSubscription" USING btree ("user_id") WHERE "UserSubscription"."status" = 'active';--> statement-breakpoint
ALTER TABLE "Balance" DROP COLUMN IF EXISTS "plan";--> statement-breakpoint
ALTER TABLE "Balance" DROP COLUMN IF EXISTS "tokens";--> statement-breakpoint
ALTER TABLE "Balance" DROP COLUMN IF EXISTS "image_generation";--> statement-breakpoint
ALTER TABLE "Balance" DROP COLUMN IF EXISTS "video_generation";--> statement-breakpoint
ALTER TABLE "Balance" DROP COLUMN IF EXISTS "web_searches";--> statement-breakpoint
ALTER TABLE "CancellationFeedback" DROP COLUMN IF EXISTS "plan_name";--> statement-breakpoint
ALTER TABLE "PaymentIntent" DROP COLUMN IF EXISTS "plan_name";--> statement-breakpoint
ALTER TABLE "PaymentIntent" DROP COLUMN IF EXISTS "currency";--> statement-breakpoint
ALTER TABLE "PaymentIntent" DROP COLUMN IF EXISTS "is_trial";--> statement-breakpoint
ALTER TABLE "UserSubscription" DROP COLUMN IF EXISTS "plan_id";--> statement-breakpoint
ALTER TABLE "UserSubscription" DROP COLUMN IF EXISTS "billing_period";--> statement-breakpoint
ALTER TABLE "UserSubscription" DROP COLUMN IF EXISTS "billing_period_count";