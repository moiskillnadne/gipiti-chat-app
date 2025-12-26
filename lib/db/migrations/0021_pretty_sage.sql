ALTER TABLE "Document" ADD COLUMN "generationId" varchar(256);--> statement-breakpoint
ALTER TABLE "ImageGenerationUsageLog" ADD COLUMN "generation_id" varchar(256);