import { isReasoningModelId, type ThinkingSetting } from "./models";

export type StepCalculationConfig = {
  modelId: string;
  thinkingSetting?: ThinkingSetting;
  hasWebSearch: boolean;
  hasImageGeneration: boolean;
};

/**
 * Calculates optimal step limit for AI model based on:
 * - Model reasoning capabilities
 * - Reasoning effort setting
 * - Available tools (web search, image generation)
 *
 * This prevents incomplete responses when models hit step limits mid-reasoning.
 */
export const calculateOptimalStepLimit = (
  config: StepCalculationConfig
): number => {
  const { modelId, thinkingSetting, hasWebSearch, hasImageGeneration } = config;

  // Base minimum steps for any model
  let steps = 3;

  // Add bonus steps for reasoning models based on effort level
  if (isReasoningModelId(modelId) && thinkingSetting?.type === "effort") {
    const effortBonus: Record<string, number> = {
      none: 0,
      low: 1,
      medium: 3,
      high: 6,
    };

    steps += effortBonus[thinkingSetting.value] ?? 0;
  }

  // Add bonus steps for expensive tools that often require multiple calls
  if (hasWebSearch) {
    steps += 4; // Web search often needs multiple queries to gather comprehensive info
  }

  if (hasImageGeneration) {
    steps += 2; // Image generation usually one-shot but may need refinement
  }

  // Cap at reasonable maximum to control costs and prevent runaway execution
  return Math.min(steps, 15);
};
