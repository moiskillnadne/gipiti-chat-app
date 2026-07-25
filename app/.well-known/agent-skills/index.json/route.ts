import { buildAgentSkillsIndex } from "@/lib/agent-discovery/skills";

/** Agent Skills Discovery 0.2.0 — `/.well-known/agent-skills/index.json`. */
export function GET(): Response {
  return new Response(JSON.stringify(buildAgentSkillsIndex(), null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
