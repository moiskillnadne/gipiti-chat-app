import {
  API_CATALOG_CONTENT_TYPE,
  apiCatalog,
} from "@/lib/agent-discovery/api-catalog";

/** RFC 9727 — `/.well-known/api-catalog`. */
export function GET(): Response {
  return new Response(JSON.stringify(apiCatalog, null, 2), {
    headers: {
      "Content-Type": API_CATALOG_CONTENT_TYPE,
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
