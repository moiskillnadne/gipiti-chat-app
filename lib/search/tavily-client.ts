import {
  SearchProviderError,
  type TavilyApiResponse,
  type TavilyExtractApiResponse,
  type TavilySearchParams,
  type UrlExtractParams,
  type UrlExtractResponse,
  type UrlExtractResult,
  type WebSearchResponse,
  type WebSearchResult,
} from "./search-types";

const TAVILY_API_URL = "https://api.tavily.com/search";
const TAVILY_EXTRACT_API_URL = "https://api.tavily.com/extract";

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

export async function extractUrlWithTavily(
  params: UrlExtractParams
): Promise<UrlExtractResponse> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error("TAVILY_API_KEY environment variable is not set");
  }

  if (params.urls.length === 0) {
    throw new Error("At least one URL is required");
  }

  const startTime = Date.now();

  const requestBody = {
    api_key: apiKey,
    urls: params.urls,
  };

  const response = await fetch(TAVILY_EXTRACT_API_URL, {
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

  const data: TavilyExtractApiResponse = await response.json();

  const results: UrlExtractResult[] = [];
  let successCount = 0;
  let failedCount = 0;

  for (const result of data.results || []) {
    const content = result.raw_content || "";
    const truncatedContent = params.maxContentLength
      ? content.slice(0, params.maxContentLength)
      : content;

    const lines = truncatedContent.split("\n");
    const title = lines[0]?.trim() || extractDomainFromUrl(result.url);

    results.push({
      url: result.url,
      title,
      content: truncatedContent,
      success: true,
    });
    successCount++;
  }

  for (const failed of data.failed_results || []) {
    results.push({
      url: failed.url,
      title: extractDomainFromUrl(failed.url),
      content: "",
      success: false,
      error: failed.error,
    });
    failedCount++;
  }

  return {
    results,
    responseTime,
    successCount,
    failedCount,
  };
}

function extractDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function formatExtractedContentForLLM(
  response: UrlExtractResponse
): string {
  if (response.results.length === 0) {
    return "No content could be extracted from the provided URLs.";
  }

  const header = `Extracted content from ${response.successCount} URL(s):\n\n`;

  const results = response.results
    .filter((r) => r.success)
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}\n` +
        `URL: ${r.url}\n` +
        `Content:\n${r.content}\n` +
        (r.publishedDate ? `Published: ${r.publishedDate}\n` : "")
    )
    .join("\n---\n");

  const failures = response.results.filter((r) => !r.success);
  const failureSection =
    failures.length > 0
      ? `\n\nFailed to extract from ${failures.length} URL(s):\n${failures.map((f) => `- ${f.url}: ${f.error}`).join("\n")}`
      : "";

  return header + results + failureSection;
}
