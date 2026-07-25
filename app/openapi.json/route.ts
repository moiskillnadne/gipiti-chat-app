import { openApiDocument } from "@/lib/agent-discovery/openapi";

/** OpenAPI 3.1 description of the public surface, linked as `service-desc`. */
export function GET(): Response {
  return new Response(JSON.stringify(openApiDocument, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
