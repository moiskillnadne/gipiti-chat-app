ALTER TABLE "User" ADD COLUMN "registration_country" varchar(2);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "registration_region" varchar(16);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "registration_city" varchar(255);--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "registration_language" varchar(35);