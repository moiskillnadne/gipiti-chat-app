CREATE TABLE IF NOT EXISTS "Balance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" varchar(32),
	"tokens" bigint DEFAULT 0 NOT NULL,
	"last_balance_reset_at" timestamp,
	"image_generations" integer DEFAULT 0 NOT NULL,
	"video_generations" integer DEFAULT 0 NOT NULL,
	"web_searches" integer DEFAULT 0 NOT NULL,
	"search_depth" varchar(20),
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
CREATE UNIQUE INDEX IF NOT EXISTS "balance_user_id_unique" ON "Balance" USING btree ("user_id");--> statement-breakpoint
INSERT INTO "Balance" (
	"user_id", "plan", "tokens", "last_balance_reset_at",
	"image_generations", "video_generations", "web_searches", "search_depth"
)
SELECT
	u."id",
	u."current_plan",
	u."token_balance",
	u."last_balance_reset_at",
	u."image_generations_left",
	u."video_generations_left",
	GREATEST(
		0,
		COALESCE((sp."features"->>'searchQuota')::int, 0) - u."web_searches_used"
	),
	sp."features"->>'searchDepthAllowed'
FROM "User" u
LEFT JOIN LATERAL (
	SELECT p."features"
	FROM "UserSubscription" s
	JOIN "SubscriptionPlan" p ON p."id" = s."plan_id"
	WHERE s."user_id" = u."id" AND s."status" = 'active'
	ORDER BY s."current_period_end" DESC
	LIMIT 1
) sp ON true;
--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "current_plan";--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "token_balance";--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "last_balance_reset_at";--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "image_generations_left";--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "video_generations_left";--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "web_searches_used";