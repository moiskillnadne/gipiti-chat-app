import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { checkSearchQuota, recordSearchUsage } from "@/lib/search/search-quota";
import type { SearchDepth } from "@/lib/search/search-types";
import {
  formatSearchResultsForLLM,
  searchWithTavily,
} from "@/lib/search/tavily-client";

export const webSearch = ({
  session,
  chatId,
}: {
  session: Session;
  chatId: string;
}) =>
  tool({
    description: `Search the web for current information, recent events, or facts that may not be in your training data. Use this tool when:
- User asks about current events, news, or recent developments
- User asks for up-to-date information (prices, weather, stock prices, sports scores)
- User asks about specific products, services, or companies that may have changed
- User needs to verify or fact-check information
- User asks questions with time-sensitive answers (e.g., "what happened yesterday")
- User explicitly requests to search the internet
- You are uncertain about factual claims that could be easily verified

Do NOT use this tool for:
- General knowledge questions you can confidently answer
- Creative tasks (writing, brainstorming)
- Mathematical calculations
- Coding questions
- Historical events with well-established facts`,
    inputSchema: z.object({
      query: z
        .string()
        .min(3)
        .max(400)
        .describe("The search query to find relevant information on the web"),
      searchDepth: z
        .enum(["basic", "advanced"])
        .optional()
        .default("basic")
        .describe(
          "basic: faster, fewer results; advanced: slower, more comprehensive"
        ),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .default(5)
        .describe("Maximum number of results to return"),
    }),
    execute: async ({ query, searchDepth = "basic", maxResults = 5 }) => {
      try {
        // Check quota before searching
        const quotaCheck = await checkSearchQuota(session.user.id);

        if (!quotaCheck.allowed) {
          return {
            error: quotaCheck.reason || "Search quota exceeded",
            quotaInfo: quotaCheck.quotaInfo,
          };
        }

        // Enforce allowed search depth based on tier
        const effectiveDepth: SearchDepth =
          searchDepth === "advanced" && quotaCheck.allowedDepth === "basic"
            ? "basic"
            : searchDepth;

        // Perform the search
        const searchResult = await searchWithTavily({
          query,
          searchDepth: effectiveDepth,
          maxResults,
        });

        // Record usage
        await recordSearchUsage({
          userId: session.user.id,
          chatId,
          query,
          searchDepth: effectiveDepth,
          resultsCount: searchResult.results.length,
          responseTimeMs: searchResult.responseTime,
          cached: false,
        });

        return {
          query: searchResult.query,
          results: searchResult.results,
          responseTime: searchResult.responseTime,
          cached: false,
          formattedResults: formatSearchResultsForLLM(searchResult),
        };
      } catch (error) {
        console.error("Web search error:", error);
        return {
          error:
            error instanceof Error
              ? error.message
              : "An error occurred while searching",
        };
      }
    },
  });
