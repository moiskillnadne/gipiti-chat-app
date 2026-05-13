ALTER TABLE "User" ADD COLUMN "image_generations_left" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "video_generations_left" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "web_searches_used" integer DEFAULT 0 NOT NULL;