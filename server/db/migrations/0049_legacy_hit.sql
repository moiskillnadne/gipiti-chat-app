-- How often each legacy route and server action is still called (roadmap
-- Phase 5, GIPITI-266): one row per name per UTC day.
--
-- The web is moving from its own routes to /api/v1. A browser tab opened before
-- a deploy still runs the old code, so the old routes stay alive for a while.
-- Each of them records a hit here once the web has switched away from it. A
-- route may be deleted when its name has no hits for 14 days (Phase 12 gate).
--
-- `name` is "<METHOD> <path>" for a route ("GET /api/prompts") and
-- "action <name>" for a server action. `count` is raised by one upsert per hit
-- (server/http/legacy-hit.ts); the day is the UTC calendar day.
--
-- Additive: a new table that nothing reads yet.
CREATE TABLE IF NOT EXISTS "LegacyHit" (
  "name" varchar(128) NOT NULL,
  "day" date NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "LegacyHit_name_day_pk" PRIMARY KEY ("name", "day")
);
