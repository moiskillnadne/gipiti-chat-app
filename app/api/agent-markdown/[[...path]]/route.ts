import { estimateTokenCount } from "@/lib/agent-discovery/constants";
import { getMarkdownForPath } from "@/lib/agent-discovery/markdown";
import { isMarkdownNegotiablePath } from "@/lib/agent-discovery/markdown/paths";

type MarkdownRouteProps = {
  params: Promise<{ path?: string[] }>;
};

/**
 * Markdown view of the public pages.
 *
 * Not meant to be requested directly — `proxy.ts` rewrites here when a request
 * for a public page carries `Accept: text/markdown`, so the agent keeps seeing
 * the page's own URL.
 *
 * The page path travels as URL segments (`/` → this route, `/models/foo` →
 * `/api/agent-markdown/models/foo`) rather than a query parameter: a route
 * handler's `nextUrl` still reports the *original* request URL after a rewrite,
 * so query parameters added by the proxy never arrive, while the path does.
 *
 * The reconstructed path is validated against the same allowlist the proxy
 * uses, so calling this route directly cannot reach anything else.
 */
const notFound = (): Response =>
  new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });

export async function GET(
  _request: Request,
  { params }: MarkdownRouteProps
): Promise<Response> {
  const { path } = await params;
  const pathname = `/${(path ?? []).join("/")}`;

  if (!isMarkdownNegotiablePath(pathname)) {
    return notFound();
  }

  const markdown = await getMarkdownForPath(pathname);

  if (markdown === null) {
    return notFound();
  }

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      // The same URL serves HTML or Markdown depending on `Accept`; without
      // this a shared cache could hand the Markdown to a browser.
      Vary: "Accept",
      "x-markdown-tokens": String(estimateTokenCount(markdown)),
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
