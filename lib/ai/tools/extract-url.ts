import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { checkSearchQuota, recordSearchUsage } from "@/lib/search/search-quota";
import {
  extractUrlWithTavily,
  formatExtractedContentForLLM,
} from "@/lib/search/tavily-client";

export const extractUrl = ({
  session,
  chatId,
}: {
  session: Session;
  chatId: string;
}) =>
  tool({
    description: `Extract and read content from URLs. Use this tool when:
- User provides a URL and asks questions about it
- User wants to analyze documentation from a link
- User needs content from a specific webpage
- User asks to read/summarize/explain content from a URL
- User provides links to articles, blog posts, or documentation

Do NOT use this tool for:
- General web searches (use webSearch instead)
- URLs that are just mentioned without needing content extraction
- Image URLs or media files`,
    inputSchema: z.object({
      urls: z
        .array(z.string().url())
        .min(1)
        .max(3)
        .describe("Array of URLs to extract content from (max 3)"),
      maxContentLength: z
        .number()
        .int()
        .min(1000)
        .max(10_000)
        .optional()
        .default(5000)
        .describe("Maximum content length per URL in characters"),
    }),
    execute: async ({ urls, maxContentLength = 5000 }) => {
      try {
        const quotaCheck = await checkSearchQuota(session.user.id);

        if (!quotaCheck.allowed) {
          return {
            error: quotaCheck.reason || "URL extraction quota exceeded",
            quotaInfo: quotaCheck.quotaInfo,
            results: [],
          };
        }

        const extractResult = await extractUrlWithTavily({
          urls,
          maxContentLength,
        });

        await recordSearchUsage({
          userId: session.user.id,
          chatId,
          query: `URL extraction: ${urls.join(", ")}`,
          searchDepth: "basic",
          resultsCount: extractResult.successCount,
          responseTimeMs: extractResult.responseTime,
          cached: false,
        });

        return {
          results: extractResult.results,
          successCount: extractResult.successCount,
          failedCount: extractResult.failedCount,
          responseTime: extractResult.responseTime,
          formattedContent: formatExtractedContentForLLM(extractResult),
        };
      } catch (error) {
        console.error("URL extraction error:", error);
        return {
          error:
            error instanceof Error
              ? error.message
              : "An error occurred while extracting URLs",
          results: [],
        };
      }
    },
  });
