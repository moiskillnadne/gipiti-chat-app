import { estimateTokenCount } from "@/lib/agent-discovery/constants";
import { agentSkills, getAgentSkillByName } from "@/lib/agent-discovery/skills";

type SkillRouteProps = {
  params: Promise<{ skill: string }>;
};

/** Prerendered so the digests in the index always match a served document. */
export const dynamicParams = false;

export const generateStaticParams = (): { skill: string }[] =>
  agentSkills.map((skill) => ({ skill: skill.name }));

/** The SKILL.md artifacts listed in `/.well-known/agent-skills/index.json`. */
export async function GET(
  _request: Request,
  { params }: SkillRouteProps
): Promise<Response> {
  const { skill: name } = await params;
  const skill = getAgentSkillByName(name);

  if (!skill) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(skill.body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "x-markdown-tokens": String(estimateTokenCount(skill.body)),
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
