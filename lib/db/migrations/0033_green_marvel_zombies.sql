-- Refactor: extract balance state from User into a dedicated Balance table.
--
-- Backfill notes:
--   - plan / tokens / created_at are copied from User columns being dropped.
--   - updated_at folds in the old last_balance_reset_at (falls back to NOW()).
--   - image_generation / video_generation / web_searches start at 0 for
--     existing users. They'll be refilled to the tier maximums at the next
--     subscription renewal or payment event.

CREATE TABLE IF NOT EXISTS "Balance" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"plan" varchar(32),
	"tokens" bigint DEFAULT 0 NOT NULL,
	"image_generation" integer DEFAULT 0 NOT NULL,
	"video_generation" integer DEFAULT 0 NOT NULL,
	"web_searches" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Balance" ADD CONSTRAINT "Balance_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
INSERT INTO "Balance" (
	"user_id",
	"plan",
	"tokens",
	"image_generation",
	"video_generation",
	"web_searches",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"current_plan",
	COALESCE("token_balance", 0),
	0,
	0,
	0,
	"created_at",
	COALESCE("last_balance_reset_at", NOW())
FROM "User"
ON CONFLICT ("user_id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "current_plan";--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "token_balance";--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "last_balance_reset_at";
