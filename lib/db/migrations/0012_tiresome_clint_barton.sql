ALTER TABLE "User" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "email_verification_code" varchar(255);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "email_verification_code_expiry" timestamp;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_email_verification_code_idx" ON "User" USING btree ("email_verification_code");