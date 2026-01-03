ALTER TABLE "PaymentIntent" ADD COLUMN "is_trial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "trial_used_at" timestamp;--> statement-breakpoint
ALTER TABLE "UserSubscription" ADD COLUMN "is_trial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "UserSubscription" ADD COLUMN "trial_ends_at" timestamp;