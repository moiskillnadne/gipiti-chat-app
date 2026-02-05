import { generateText } from "ai";
import type { Locale } from "@/i18n/config";
import { localeNames } from "@/i18n/config";
import { myProvider } from "./providers";

const SUMMARY_MODEL = "title-model";

const REASONING_SUMMARY_PROMPT = `You are a status indicator for an AI assistant's thinking process.
Given the AI's current reasoning text, generate a single short action phrase (3-8 words) describing what the AI is doing RIGHT NOW.

Examples of good action phrases:
- "Analyzing the code structure..."
- "Comparing different approaches..."
- "Researching the topic..."
- "Checking for potential issues..."
- "Breaking down the problem..."
- "Evaluating possible solutions..."
- "Reviewing the requirements..."

Rules:
- Always end with "..."
- Use present continuous tense (verb + ing)
- Be specific to the content when possible
- Keep it between 3-8 words
- Generate the phrase in {language}
- Focus on what the AI is CURRENTLY doing, not what it will do

Reasoning text (last portion):
{reasoning}

Action phrase:`;

export type ReasoningSummaryConfig = {
  throttleMs: number;
  minCharsForSummary: number;
  maxContextChars: number;
};

export const DEFAULT_CONFIG: ReasoningSummaryConfig = {
  throttleMs: 600,
  minCharsForSummary: 100,
  maxContextChars: 800,
};

export async function generateReasoningSummary(
  reasoningText: string,
  language: Locale = "en"
): Promise<string> {
  const languageName = localeNames[language] || "English";

  const { text } = await generateText({
    model: myProvider.languageModel(SUMMARY_MODEL),
    prompt: REASONING_SUMMARY_PROMPT.replace(
      "{language}",
      languageName
    ).replace("{reasoning}", reasoningText),
  });

  return text.trim();
}

export class ReasoningSummarizer {
  private buffer = "";
  private lastSummaryTime = 0;
  private isGenerating = false;
  private config: ReasoningSummaryConfig;
  private language: Locale;
  private fallbackMessage: string;

  constructor(language: Locale = "en", config = DEFAULT_CONFIG) {
    this.language = language;
    this.config = config;
    this.fallbackMessage =
      language === "ru"
        ? "Обрабатываю запрос..."
        : "Processing your request...";
  }

  addChunk(text: string): void {
    this.buffer += text;
  }

  getBufferLength(): number {
    return this.buffer.length;
  }

  shouldGenerateSummary(): boolean {
    const now = Date.now();
    const timeSinceLastSummary = now - this.lastSummaryTime;
    const hasEnoughContent =
      this.buffer.length >= this.config.minCharsForSummary;

    return (
      hasEnoughContent &&
      timeSinceLastSummary >= this.config.throttleMs &&
      !this.isGenerating
    );
  }

  async generateSummary(): Promise<string | null> {
    if (!this.shouldGenerateSummary()) {
      return null;
    }

    this.isGenerating = true;

    try {
      const contextText = this.buffer.slice(-this.config.maxContextChars);
      const summary = await generateReasoningSummary(
        contextText,
        this.language
      );
      this.lastSummaryTime = Date.now();

      if (!summary || summary.length === 0) {
        return this.fallbackMessage;
      }

      return summary;
    } catch (error) {
      console.warn("Failed to generate reasoning summary:", error);
      return this.fallbackMessage;
    } finally {
      this.isGenerating = false;
    }
  }

  getFullReasoning(): string {
    return this.buffer;
  }

  reset(): void {
    this.buffer = "";
    this.lastSummaryTime = 0;
    this.isGenerating = false;
  }
}
