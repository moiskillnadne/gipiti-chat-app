CREATE TABLE IF NOT EXISTS "CancellationFeedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"reasons" jsonb NOT NULL,
	"additional_feedback" text,
	"plan_name" varchar(64),
	"billing_period" "billing_period",
	"subscription_duration_days" integer,
	"was_trial" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "CancellationFeedback" ADD CONSTRAINT "CancellationFeedback_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "CancellationFeedback" ADD CONSTRAINT "CancellationFeedback_subscription_id_UserSubscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."UserSubscription"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cancellation_feedback_user_id_idx" ON "CancellationFeedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cancellation_feedback_created_at_idx" ON "CancellationFeedback" USING btree ("created_at");