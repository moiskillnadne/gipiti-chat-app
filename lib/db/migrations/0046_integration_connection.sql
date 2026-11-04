-- MCP integrations (GIPITI-28): one row per user-connected MCP server.
-- Holds only non-secret data; credentials live in a separate table (0047).
-- New empty table, so no lock concerns. Idempotent: safe to run twice.
CREATE TABLE IF NOT EXISTS "IntegrationConnection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"provider" varchar(64) NOT NULL,
	"displayName" text NOT NULL,
	"serverUrl" text NOT NULL,
	"authType" varchar NOT NULL,
	"authHeaderName" text,
	"authHeaderScheme" text,
	"staticHeaders" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"trustLevel" varchar NOT NULL,
	"allowWrites" boolean DEFAULT false NOT NULL,
	"accessTokenExpiresAt" timestamp with time zone,
	"scopes" text,
	"toolSnapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"toolSnapshotHash" text NOT NULL,
	"toolSnapshotAt" timestamp with time zone NOT NULL,
	"toolTokenEstimate" integer DEFAULT 0 NOT NULL,
	"enabledTools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"readOnlyToolNames" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_connection_builtin_idx" ON "IntegrationConnection" USING btree ("userId","provider") WHERE "IntegrationConnection"."trustLevel" = 'builtin';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_connection_custom_url_idx" ON "IntegrationConnection" USING btree ("userId",lower("serverUrl")) WHERE "IntegrationConnection"."trustLevel" = 'custom';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_connection_user_status_idx" ON "IntegrationConnection" USING btree ("userId","status");
