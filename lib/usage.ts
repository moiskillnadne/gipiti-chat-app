import type { LanguageModelUsage } from "ai";
import type { UsageData } from "tokenlens/helpers";

// Server-merged usage: base usage + TokenLens summary + optional modelId
// Extended with optional cost and cache fields that may come from TokenLens
export type AppUsage = LanguageModelUsage &
  UsageData & {
    modelId?: string;
    inputCost?: number;
    outputCost?: number;
    totalCost?: number;
    cacheWriteTokens?: number;
    cacheReadTokens?: number;
  };
