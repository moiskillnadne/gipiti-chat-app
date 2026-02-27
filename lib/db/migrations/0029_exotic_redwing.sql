CREATE TABLE IF NOT EXISTS "VideoGenerationUsageLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chat_id" uuid,
	"model_id" varchar(128) NOT NULL,
	"prompt" text NOT NULL,
	"video_url" varchar(512),
	"generation_id" varchar(256),
	"success" boolean DEFAULT true NOT NULL,
	"duration_seconds" integer DEFAULT 0,
	"total_cost_usd" numeric(12, 8),
	"billing_period_type" "billing_period" NOT NULL,
	"billing_period_start" timestamp NOT NULL,
	"billing_period_end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "VideoGenerationUsageLog" ADD CONSTRAINT "VideoGenerationUsageLog_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "VideoGenerationUsageLog" ADD CONSTRAINT "VideoGenerationUsageLog_chat_id_Chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."Chat"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_generation_usage_log_user_id_idx" ON "VideoGenerationUsageLog" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_generation_usage_log_chat_id_idx" ON "VideoGenerationUsageLog" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_generation_usage_log_created_at_idx" ON "VideoGenerationUsageLog" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_generation_usage_log_user_period_idx" ON "VideoGenerationUsageLog" USING btree ("user_id","billing_period_start","billing_period_end");