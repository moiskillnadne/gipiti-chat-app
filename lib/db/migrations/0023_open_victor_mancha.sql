ALTER TABLE "User" ALTER COLUMN "preferred_language" SET DEFAULT 'ru';--> statement-breakpoint
ALTER TABLE "Message_v2" ADD COLUMN "modelId" varchar(128);