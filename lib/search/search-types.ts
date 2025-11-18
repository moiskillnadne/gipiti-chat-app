export type SearchDepth = "basic" | "advanced";

export type WebSearchResult = {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
  rawContent?: string;
};

export type WebSearchResponse = {
  query: string;
  results: WebSearchResult[];
  responseTime: number;
  cached: boolean;
};

export type TavilySearchParams = {
  query: string;
  searchDepth?: SearchDepth;
  maxResults?: number;
  includeRawContent?: boolean;
  includeImages?: boolean;
};

export type TavilyApiResponse = {
  query: string;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    published_date?: string;
    raw_content?: string;
  }>;
  response_time: number;
  images?: Array<{
    url: string;
    description?: string;
  }>;
};

export type SearchQuotaInfo = {
  limit: number;
  used: number;
  remaining: number;
  resetAt: Date;
  periodType: string;
};

export type SearchUsageRecord = {
  userId: string;
  chatId?: string;
  query: string;
  searchDepth: SearchDepth;
  resultsCount: number;
  responseTimeMs: number;
  cached: boolean;
};

export class SearchQuotaExceededError extends Error {
  quota: number;
  used: number;
  resetAt: Date;

  constructor(quota: number, used: number, resetAt: Date) {
    super(`Search quota exceeded: ${used}/${quota}`);
    this.name = "SearchQuotaExceededError";
    this.quota = quota;
    this.used = used;
    this.resetAt = resetAt;
  }
}

export class SearchProviderError extends Error {
  statusCode: number;
  provider: string;

  constructor(statusCode: number, provider: string) {
    super(`Search provider error: ${provider} returned ${statusCode}`);
    this.name = "SearchProviderError";
    this.statusCode = statusCode;
    this.provider = provider;
  }
}

export class SearchCacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SearchCacheError";
  }
}
