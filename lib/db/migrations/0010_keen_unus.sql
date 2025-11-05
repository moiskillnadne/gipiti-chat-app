ALTER TABLE "User" ADD COLUMN "reset_password_token" varchar(255);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "reset_password_token_expiry" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_reset_password_token_idx" ON "User" USING btree ("reset_password_token");