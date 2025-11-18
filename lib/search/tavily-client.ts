import {
  SearchProviderError,
  type TavilyApiResponse,
  type TavilySearchParams,
  type WebSearchResponse,
  type WebSearchResult,
} from "./search-types";

const TAVILY_API_URL = "https://api.tavily.com/search";

function sanitizeSearchQuery(query: string): string {
  return query
    .slice(0, 400)
    .replace(/[<>{}|\\^`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function transformTavilyResponse(
  response: TavilyApiResponse,
  responseTime: number,
  cached: boolean
): WebSearchResponse {
  const results: WebSearchResult[] = response.results.map((result) => ({
    title: result.title,
    url: result.url,
    content: result.content,
    score: result.score,
    publishedDate: result.published_date,
    rawContent: result.raw_content,
  }));

  return {
    query: response.query,
    results,
    responseTime,
    cached,
  };
}

export async function searchWithTavily(
  params: TavilySearchParams
): Promise<WebSearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error("TAVILY_API_KEY environment variable is not set");
  }

  const sanitizedQuery = sanitizeSearchQuery(params.query);

  if (sanitizedQuery.length < 3) {
    throw new Error("Search query must be at least 3 characters");
  }

  const startTime = Date.now();

  const requestBody = {
    api_key: apiKey,
    query: sanitizedQuery,
    search_depth: params.searchDepth || "basic",
    max_results: params.maxResults || 5,
    include_raw_content: params.includeRawContent || false,
    include_images: params.includeImages || false,
  };

  const response = await fetch(TAVILY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const responseTime = Date.now() - startTime;

  if (!response.ok) {
    throw new SearchProviderError(response.status, "Tavily");
  }

  const data: TavilyApiResponse = await response.json();

  return transformTavilyResponse(data, responseTime, false);
}

export function formatSearchResultsForLLM(response: WebSearchResponse): string {
  if (response.results.length === 0) {
    return `Web search for "${response.query}" returned no results.`;
  }

  const header = `Web search for "${response.query}" returned ${response.results.length} results:\n\n`;

  const results = response.results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}\n` +
        `URL: ${r.url}\n` +
        `${r.content}\n` +
        (r.publishedDate ? `Published: ${r.publishedDate}\n` : "")
    )
    .join("\n---\n");

  return header + results;
}
