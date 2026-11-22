-- Revocable sessions (roadmap Phase 4c, GIPITI-263).
--
-- "User"."token_version" is the one number that ends every session of an
-- account at once. The web session cookie and every API access token carry
-- the version they were issued under; a password reset or "log out
-- everywhere" adds one, and whatever carries an older number stops being
-- accepted. Existing cookies carry no number and count as 0, so nobody is
-- signed out by this migration.
--
-- "AuthSession" is one signed-in API client (a phone). "RefreshToken" holds
-- the hash of each refresh token of a session; a token is replaced on every
-- use, and "parent_id" says which token it replaced, which is how a token
-- that is presented twice is told apart from one that was never issued.
--
-- Additive: one column with a constant default (no table rewrite) and two new
-- tables. Nothing reads the tables until the token endpoints ship.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "token_version" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "AuthSession" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"client_kind" varchar(16) NOT NULL,
	"platform" varchar(32),
	"device_name" varchar(255),
	"app_version" varchar(32),
	"created_ip" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	"absolute_expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"revoked_reason" varchar(32)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "RefreshToken" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_session_id_AuthSession_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."AuthSession"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_session_user_id_active_idx" ON "AuthSession" USING btree ("user_id") WHERE "AuthSession"."revoked_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "refresh_token_token_hash_idx" ON "RefreshToken" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refresh_token_session_id_idx" ON "RefreshToken" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refresh_token_parent_id_idx" ON "RefreshToken" USING btree ("parent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refresh_token_expires_at_idx" ON "RefreshToken" USING btree ("expires_at");
