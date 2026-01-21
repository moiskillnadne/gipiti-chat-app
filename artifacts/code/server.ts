import { streamObject } from "ai";
import { z } from "zod";
import { getCodePrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

/**
 * Language detection patterns defined at top-level scope for performance.
 * Each language has an array of regex patterns that identify it.
 */
const LANGUAGE_PATTERNS: Record<string, RegExp[]> = {
  javascript: [
    /^(const|let|var|function|import|export|class)\s/m,
    /=>\s*[{(]/,
    /console\.(log|error|warn)/,
  ],
  typescript: [
    /:\s*(string|number|boolean|any|void|never)\b/,
    /interface\s+\w+/,
    /<\w+>/,
    /as\s+(string|number|boolean)/,
  ],
  python: [/^(def|class|import|from)\s/m, /:\s*$/m, /print\s*\(/],
  java: [
    /^(public|private|protected|class|interface)\s/m,
    /System\.out\./,
    /void\s+main\s*\(/,
  ],
  go: [/^(package|func|import)\s/m, /fmt\./, /:=/, /func\s+\(/],
  rust: [/^(fn|let|mut|pub|struct|impl|use)\s/m, /println!\(/, /->/, /&mut\s/],
  cpp: [/#include\s*</, /std::/, /cout\s*<</, /int\s+main\s*\(/, /nullptr/],
  c: [/#include\s*</, /printf\s*\(/, /int\s+main\s*\(/, /NULL/],
  html: [/<(!DOCTYPE|html|head|body|div|span|p|a|img)/i, /<\/\w+>/],
  css: [/[.#]\w+\s*\{/, /@media/, /:\s*(flex|grid|block|none)/],
  sql: [/^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s/im, /FROM\s+\w+/i],
  json: [/^\s*[[{]/, /"[\w]+"\s*:/],
  yaml: [/^\w+:\s*$/m, /^\s*-\s+\w+/m],
  markdown: [/^#+\s/, /\[.+\]\(.+\)/, /^\s*[-*]\s/m],
};

const FENCE_PATTERN = /^```[\w]*\n?([\s\S]*?)\n?```$/;
const OPENING_FENCE_PATTERN = /^```[\w]*\n?([\s\S]*)$/;

/**
 * Strips markdown code fences from generated code.
 * Handles patterns like ```python\n...\n``` or ```\n...\n```
 */
const stripMarkdownFences = (code: string): string => {
  if (!code) {
    return code;
  }
  const match = code.match(FENCE_PATTERN);
  if (match) {
    return match[1].trim();
  }
  const openMatch = code.match(OPENING_FENCE_PATTERN);
  if (openMatch && !code.includes("```", 3)) {
    return openMatch[1];
  }
  return code;
};

/**
 * Detects programming language from code content using common patterns.
 * Returns null if language cannot be determined.
 */
const detectLanguageFromContent = (content: string | null): string | null => {
  if (!content) {
    return null;
  }

  for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    const matchCount = patterns.filter((pattern) =>
      pattern.test(content)
    ).length;
    if (matchCount >= 2) {
      return lang;
    }
  }

  // Single pattern fallback for strong indicators
  for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(content))) {
      return lang;
    }
  }

  return null;
};

export const codeDocumentHandler = createDocumentHandler<"code">({
  kind: "code",
  onCreateDocument: async ({ title, dataStream, language = "python" }) => {
    let draftContent = "";

    // Stream the language to the client for syntax highlighting
    dataStream.write({
      type: "data-codeLanguage",
      data: language,
      transient: true,
    });

    const { fullStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: getCodePrompt(language),
      prompt: title,
      schema: z.object({
        code: z.string(),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { code } = object;

        if (code) {
          const cleanCode = stripMarkdownFences(code);
          dataStream.write({
            type: "data-codeDelta",
            data: cleanCode,
            transient: true,
          });

          draftContent = cleanCode;
        }
      }
    }

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = "";

    // Detect language from existing content or default to python
    const detectedLanguage =
      detectLanguageFromContent(document.content) || "python";

    // Stream the detected language to the client
    dataStream.write({
      type: "data-codeLanguage",
      data: detectedLanguage,
      transient: true,
    });

    const { fullStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: updateDocumentPrompt(document.content, "code"),
      prompt: description,
      schema: z.object({
        code: z.string(),
      }),
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;
        const { code } = object;

        if (code) {
          const cleanCode = stripMarkdownFences(code);
          dataStream.write({
            type: "data-codeDelta",
            data: cleanCode,
            transient: true,
          });

          draftContent = cleanCode;
        }
      }
    }

    return draftContent;
  },
});
