ALTER TABLE "CancellationFeedback" DROP COLUMN IF EXISTS "was_trial";--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "trial_used_at";--> statement-breakpoint
ALTER TABLE "UserSubscription" DROP COLUMN IF EXISTS "is_trial";--> statement-breakpoint
ALTER TABLE "UserSubscription" DROP COLUMN IF EXISTS "trial_ends_at";