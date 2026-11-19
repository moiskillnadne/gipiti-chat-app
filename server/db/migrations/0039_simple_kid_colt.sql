CREATE TABLE IF NOT EXISTS "Prompt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(64) NOT NULL,
	"category" varchar(32) NOT NULL,
	"model_id" varchar(64) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"tags" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Prompt_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PromptFavorite" (
	"user_id" uuid NOT NULL,
	"prompt_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "PromptFavorite_user_id_prompt_id_pk" PRIMARY KEY("user_id","prompt_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PromptFavorite" ADD CONSTRAINT "PromptFavorite_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PromptFavorite" ADD CONSTRAINT "PromptFavorite_prompt_id_Prompt_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."Prompt"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prompt_category_idx" ON "Prompt" USING btree ("category");