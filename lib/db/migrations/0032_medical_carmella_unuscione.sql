CREATE TABLE IF NOT EXISTS "ProjectFile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"size" integer NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"blob_url" text NOT NULL,
	"pathname" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Project" ADD COLUMN "description" varchar(280);--> statement-breakpoint
ALTER TABLE "Project" ADD COLUMN "swatch" varchar(16);--> statement-breakpoint
ALTER TABLE "TextStyle" ADD COLUMN "description" varchar(280);--> statement-breakpoint
ALTER TABLE "TextStyle" ADD COLUMN "swatch" varchar(16);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_project_id_Project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."Project"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_file_project_id_idx" ON "ProjectFile" USING btree ("project_id");