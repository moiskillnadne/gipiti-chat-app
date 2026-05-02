ALTER TABLE "Project" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Project" ADD COLUMN "usage_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "TextStyle" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "TextStyle" ADD COLUMN "usage_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "User" DROP COLUMN IF EXISTS "preferred_language";