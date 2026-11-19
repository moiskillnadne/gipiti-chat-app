-- Daily activity marker for DAU / MAU / retention (admin dashboard).
-- One row per user per Moscow calendar day on which the user made at least one
-- authenticated request. Written by the app with INSERT ... ON CONFLICT DO NOTHING;
-- holds no PII beyond user_id. New empty table, so no lock concerns.
CREATE TABLE IF NOT EXISTS "UserActivityDay" (
	"user_id" uuid NOT NULL,
	"activity_day" date NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "UserActivityDay_user_id_activity_day_pk" PRIMARY KEY("user_id","activity_day")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserActivityDay" ADD CONSTRAINT "UserActivityDay_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_activity_day_day_idx" ON "UserActivityDay" USING btree ("activity_day");
