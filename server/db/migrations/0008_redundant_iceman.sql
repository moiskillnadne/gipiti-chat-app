DO $$ BEGIN
 CREATE TYPE "public"."billing_period" AS ENUM('daily', 'weekly', 'monthly', 'annual');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SubscriptionPlan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"display_name" varchar(128),
	"billing_period" "billing_period" DEFAULT 'monthly' NOT NULL,
	"token_quota" bigint NOT NULL,
	"model_limits" jsonb,
	"features" jsonb,
	"price" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_tester_plan" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TokenUsageLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_id" uuid,
	"chat_id" uuid,
	"message_id" uuid,
	"model_id" varchar(128) NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0,
	"cache_read_tokens" integer DEFAULT 0,
	"input_cost" numeric(12, 8),
	"output_cost" numeric(12, 8),
	"total_cost" numeric(12, 8),
	"billing_period_type" "billing_period" NOT NULL,
	"billing_period_start" timestamp NOT NULL,
	"billing_period_end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UserSubscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"billing_period" "billing_period" NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"next_billing_date" timestamp NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"external_subscription_id" varchar(128),
	"external_customer_id" varchar(128),
	"last_payment_date" timestamp,
	"last_payment_amount" numeric(10, 2),
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"cancelled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UserTokenUsage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"billing_period_type" "billing_period" NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_input_tokens" bigint DEFAULT 0 NOT NULL,
	"total_output_tokens" bigint DEFAULT 0 NOT NULL,
	"total_tokens" bigint DEFAULT 0 NOT NULL,
	"model_breakdown" jsonb,
	"total_cost" numeric(12, 4),
	"total_requests" integer DEFAULT 0 NOT NULL,
	"last_updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "current_plan" varchar(32) DEFAULT 'tester';--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TokenUsageLog" ADD CONSTRAINT "TokenUsageLog_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TokenUsageLog" ADD CONSTRAINT "TokenUsageLog_subscription_id_UserSubscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."UserSubscription"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TokenUsageLog" ADD CONSTRAINT "TokenUsageLog_chat_id_Chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."Chat"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TokenUsageLog" ADD CONSTRAINT "TokenUsageLog_message_id_Message_v2_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."Message_v2"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserSubscription" ADD CONSTRAINT "UserSubscription_plan_id_SubscriptionPlan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."SubscriptionPlan"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserTokenUsage" ADD CONSTRAINT "UserTokenUsage_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserTokenUsage" ADD CONSTRAINT "UserTokenUsage_subscription_id_UserSubscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."UserSubscription"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plan_name_idx" ON "SubscriptionPlan" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "token_usage_log_user_id_idx" ON "TokenUsageLog" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "token_usage_log_chat_id_idx" ON "TokenUsageLog" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "token_usage_log_created_at_idx" ON "TokenUsageLog" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "token_usage_log_billing_period_idx" ON "TokenUsageLog" USING btree ("billing_period_start","billing_period_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "token_usage_log_user_period_idx" ON "TokenUsageLog" USING btree ("user_id","billing_period_start","billing_period_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_subscription_user_id_idx" ON "UserSubscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_subscription_status_idx" ON "UserSubscription" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_subscription_next_billing_idx" ON "UserSubscription" USING btree ("next_billing_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_token_usage_user_period_idx" ON "UserTokenUsage" USING btree ("user_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_token_usage_subscription_idx" ON "UserTokenUsage" USING btree ("subscription_id");