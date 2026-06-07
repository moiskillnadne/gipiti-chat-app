ALTER TYPE "transaction_type" ADD VALUE 'quiz_bonus';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "QuizResponse" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"quiz_key" varchar(64) NOT NULL,
	"answers" jsonb NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "QuizResponse" ADD CONSTRAINT "QuizResponse_user_id_User_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quiz_response_user_quiz_idx" ON "QuizResponse" USING btree ("user_id","quiz_key");