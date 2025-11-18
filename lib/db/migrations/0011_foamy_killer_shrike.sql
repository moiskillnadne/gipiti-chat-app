CREATE TABLE IF NOT EXISTS "SearchUsageLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chat_id" uuid,
	"query" varchar(400) NOT NULL,
	"search_depth" varchar(20) NOT NULL,
	"results_count" integer NOT NULL,
	"response_time_ms" integer NOT NULL,
	"cached" boolean DEFAULT false NOT NULL,
	"billing_period_type" "billing_period" NOT NULL,
	"billing_period_start" timestamp NOT NULL,
	"billing_period_end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SearchUsageLog" ADD CONSTRAINT "SearchUsageLog_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "SearchUsageLog" ADD CONSTRAINT "SearchUsageLog_chat_id_Chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."Chat"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_usage_log_user_id_idx" ON "SearchUsageLog" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_usage_log_chat_id_idx" ON "SearchUsageLog" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_usage_log_created_at_idx" ON "SearchUsageLog" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_usage_log_user_period_idx" ON "SearchUsageLog" USING btree ("user_id","billing_period_start","billing_period_end");