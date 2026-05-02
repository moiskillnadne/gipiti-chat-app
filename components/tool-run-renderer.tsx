"use client";

import { DownloadIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { downloadFromUrl } from "@/lib/download";
import { useTranslations } from "@/lib/i18n/translate";
import type { RunGroupPart } from "@/lib/messages/group-tool-runs";
import type { ChatMessage } from "@/lib/types";
import { extractDomain, faviconUrl } from "@/lib/url";
import { DocumentToolResult } from "./document";
import { DocumentPreview } from "./document-preview";
import { Response } from "./elements/response";
import {
  EarlierStepsToggle,
  RECENT_STEPS_COUNT,
  type SourceChipData,
  StepBody,
  type StepKind,
  StepQuery,
  StepSources,
  ToolRun,
  ToolRunHeader,
  ToolRunMetaSeparator,
  ToolRunStep,
} from "./elements/tool-run";
import { toast } from "./toast";
import { Weather } from "./weather";

type ChatMessagePart = ChatMessage["parts"][number];
type AnyPart = ChatMessagePart;

type ToolRunRendererProps = {
  group: RunGroupPart;
  isMessageLoading: boolean;
  isLastAssistantMessage: boolean;
  isReadonly: boolean;
};

type StepDescriptor = {
  key: string;
  kind: StepKind;
  isActive: boolean;
  hasSources: number;
  verbKey:
    | "thought"
    | "searched"
    | "searching"
    | "extracted"
    | "extracting"
    | "calculated"
    | "calculating"
    | "weather"
    | "createdDocument"
    | "updatedDocument"
    | "requestedSuggestions"
    | "generatedImage";
  body: React.ReactNode;
  /**
   * For `thought` steps, the full reasoning text (rendered as markdown when
   * the user expands the row). Other step kinds leave this undefined.
   */
  fullText?: string;
};

const TOOL_PART_PREFIX = "tool-";
const FIRST_SENTENCE = /^.*?[.!?](\s|$)/;
const SUMMARY_MAX_LEN = 160;

const isToolPart = (part: AnyPart): boolean =>
  part.type.startsWith(TOOL_PART_PREFIX);

const isStreamingState = (state: string): boolean =>
  state === "input-streaming" || state === "input-available";

const summarizeReasoning = (text: string): string => {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "";
  }
  const sentenceMatch = trimmed.match(FIRST_SENTENCE);
  const candidate = sentenceMatch ? sentenceMatch[0].trim() : trimmed;
  if (candidate.length <= SUMMARY_MAX_LEN) {
    return candidate;
  }
  return `${candidate.slice(0, SUMMARY_MAX_LEN - 1).trimEnd()}…`;
};

const sourcesFromWebSearch = (
  // biome-ignore lint/suspicious/noExplicitAny: tool output type is per-tool
  output: any
): SourceChipData[] => {
  if (!output || !Array.isArray(output.results)) {
    return [];
  }
  const seen = new Map<string, SourceChipData>();
  for (const result of output.results) {
    if (typeof result?.url !== "string") {
      continue;
    }
    const domain = extractDomain(result.url);
    if (!seen.has(domain)) {
      seen.set(domain, {
        url: result.url,
        domain,
        faviconUrl: faviconUrl(domain),
      });
    }
  }
  return [...seen.values()];
};

const sourcesFromExtractUrl = (
  // biome-ignore lint/suspicious/noExplicitAny: tool output type is per-tool
  output: any
): SourceChipData[] => {
  if (!output || !Array.isArray(output.results)) {
    return [];
  }
  const seen = new Map<string, SourceChipData>();
  for (const result of output.results) {
    if (typeof result?.url !== "string") {
      continue;
    }
    const domain = extractDomain(result.url);
    if (!seen.has(domain)) {
      seen.set(domain, {
        url: result.url,
        domain,
        faviconUrl: faviconUrl(domain),
      });
    }
  }
  return [...seen.values()];
};

const formatLocationFromInput = (
  // biome-ignore lint/suspicious/noExplicitAny: weather input type
  input: any
): string => {
  if (!input) {
    return "";
  }
  if (typeof input.city === "string" && input.city.trim()) {
    return input.city.trim();
  }
  if (
    typeof input.latitude === "number" &&
    typeof input.longitude === "number"
  ) {
    return `${input.latitude.toFixed(2)}, ${input.longitude.toFixed(2)}`;
  }
  return "";
};

const TICK_MS = 1000;
const useElapsedSeconds = (
  isStreaming: boolean,
  startedAt: number,
  endedAt: number | null
): number => {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!isStreaming) {
      return;
    }
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [isStreaming]);

  const reference = isStreaming ? now : (endedAt ?? now);
  return Math.max(0, Math.round((reference - startedAt) / 1000));
};

type ImageStepProps = {
  imageUrl: string;
  prompt: string;
};

const ImageStepBody = ({ imageUrl, prompt }: ImageStepProps) => {
  const t = useTranslations("chat.messages");

  const handleDownload = async () => {
    try {
      await downloadFromUrl(imageUrl, "generated-image.png");
    } catch {
      toast({ type: "error", description: t("downloadError") });
    }
  };

  return (
    <StepBody>
      <div className="group/image relative w-fit max-w-full overflow-hidden rounded-md">
        {/** biome-ignore lint/performance/noImgElement: model-generated image, no Next loader */}
        {/** biome-ignore lint/nursery/useImageSize: dimensions unknown */}
        <img
          alt={prompt}
          className="block max-w-full rounded-md"
          src={imageUrl}
        />
        <button
          className="absolute right-2 bottom-2 inline-flex size-8 items-center justify-center rounded-md bg-black/55 text-white transition-opacity duration-fast ease-canon hover:bg-black/75 md:opacity-0 md:group-hover/image:opacity-100"
          onClick={handleDownload}
          title={t("download")}
          type="button"
        >
          <DownloadIcon className="size-4" />
        </button>
      </div>
    </StepBody>
  );
};

type BuildStepArgs = {
  part: AnyPart;
  index: number;
  isLastInGroup: boolean;
  isMessageStreaming: boolean;
  isReadonly: boolean;
};

const buildStep = ({
  part,
  index,
  isLastInGroup,
  isMessageStreaming,
  isReadonly,
}: BuildStepArgs): StepDescriptor | null => {
  const key = `${part.type}-${index}`;

  if (part.type === "reasoning") {
    const text = part.text?.trim() ?? "";
    if (!text) {
      return null;
    }
    const isActive = isLastInGroup && isMessageStreaming;
    return {
      key,
      kind: "thought",
      isActive,
      hasSources: 0,
      verbKey: "thought",
      body: <span className="text-ink">{summarizeReasoning(text)}</span>,
      fullText: text,
    };
  }

  if (!isToolPart(part)) {
    return null;
  }

  // biome-ignore lint/suspicious/noExplicitAny: discriminated union narrowed at runtime
  const toolPart = part as any;
  const state: string = toolPart.state;
  const isActive = isLastInGroup && isStreamingState(state);

  switch (part.type) {
    case "tool-webSearch": {
      const query: string = toolPart.input?.query ?? "";
      const sources =
        state === "output-available" && !toolPart.output?.error
          ? sourcesFromWebSearch(toolPart.output)
          : [];
      const verbKey = isActive ? "searching" : "searched";
      return {
        key,
        kind: "searched",
        isActive,
        hasSources: sources.length,
        verbKey,
        body: (
          <>
            {query && <StepQuery>{query}</StepQuery>}
            {state === "output-available" && toolPart.output?.error && (
              <span className="text-destructive">
                {String(toolPart.output.error)}
              </span>
            )}
            <StepSources chips={sources} />
          </>
        ),
      };
    }
    case "tool-extractUrl": {
      const urls: string[] = Array.isArray(toolPart.input?.urls)
        ? toolPart.input.urls
        : [];
      const sources =
        state === "output-available" && !toolPart.output?.error
          ? sourcesFromExtractUrl(toolPart.output)
          : urls.map((url) => {
              const domain = extractDomain(url);
              return { url, domain, faviconUrl: faviconUrl(domain) };
            });
      return {
        key,
        kind: "extracted",
        isActive,
        hasSources: sources.length,
        verbKey: isActive ? "extracting" : "extracted",
        body: (
          <>
            {state === "output-available" && toolPart.output?.error && (
              <span className="text-destructive">
                {String(toolPart.output.error)}
              </span>
            )}
            <StepSources chips={sources} />
          </>
        ),
      };
    }
    case "tool-calculator": {
      const expression: string = toolPart.input?.expression ?? "";
      const formatted: string | undefined =
        state === "output-available" ? toolPart.output?.formatted : undefined;
      const error: string | undefined =
        state === "output-available" ? toolPart.output?.error : undefined;
      return {
        key,
        kind: "calculated",
        isActive,
        hasSources: 0,
        verbKey: isActive ? "calculating" : "calculated",
        body: (
          <>
            <code className="rounded bg-paper-2 px-1 py-px font-mono text-[12px] text-ink">
              {formatted ?? expression}
            </code>
            {error && (
              <span className="ml-2 text-destructive">{String(error)}</span>
            )}
          </>
        ),
      };
    }
    case "tool-getWeather": {
      const location = formatLocationFromInput(toolPart.input);
      return {
        key,
        kind: "weather",
        isActive,
        hasSources: 0,
        verbKey: "weather",
        body: (
          <>
            {location && <span className="text-ink">{location}</span>}
            {state === "output-available" && toolPart.output && (
              <StepBody>
                <Weather weatherAtLocation={toolPart.output} />
              </StepBody>
            )}
          </>
        ),
      };
    }
    case "tool-createDocument": {
      const title: string | undefined = toolPart.output?.title;
      const hasError = toolPart.output && "error" in toolPart.output;
      return {
        key,
        kind: "createDocument",
        isActive,
        hasSources: 0,
        verbKey: "createdDocument",
        body: (
          <>
            {title && <span className="text-ink">{`"${title}"`}</span>}
            {hasError && (
              <span className="text-destructive">
                {String(toolPart.output.error)}
              </span>
            )}
            {state === "output-available" && !hasError && (
              <StepBody>
                <DocumentPreview
                  isReadonly={isReadonly}
                  result={toolPart.output}
                />
              </StepBody>
            )}
          </>
        ),
      };
    }
    case "tool-updateDocument": {
      const title: string | undefined = toolPart.output?.title;
      const hasError = toolPart.output && "error" in toolPart.output;
      return {
        key,
        kind: "updateDocument",
        isActive,
        hasSources: 0,
        verbKey: "updatedDocument",
        body: (
          <>
            {title && <span className="text-ink">{`"${title}"`}</span>}
            {hasError && (
              <span className="text-destructive">
                {String(toolPart.output.error)}
              </span>
            )}
            {state === "output-available" && !hasError && toolPart.output && (
              <StepBody>
                <DocumentToolResult
                  isReadonly={isReadonly}
                  result={{
                    id: toolPart.output.id,
                    title: toolPart.output.title,
                    kind: toolPart.output.kind,
                  }}
                  type="update"
                />
              </StepBody>
            )}
          </>
        ),
      };
    }
    case "tool-requestSuggestions": {
      const hasError = toolPart.output && "error" in toolPart.output;
      const docTitle: string | undefined = toolPart.output?.title;
      return {
        key,
        kind: "requestSuggestions",
        isActive,
        hasSources: 0,
        verbKey: "requestedSuggestions",
        body: (
          <>
            {docTitle && <span className="text-ink">{`"${docTitle}"`}</span>}
            {hasError && (
              <span className="text-destructive">
                {String(toolPart.output.error)}
              </span>
            )}
            {state === "output-available" && !hasError && toolPart.output && (
              <StepBody>
                <DocumentToolResult
                  isReadonly={isReadonly}
                  result={toolPart.output}
                  type="request-suggestions"
                />
              </StepBody>
            )}
          </>
        ),
      };
    }
    case "tool-generateImage": {
      const prompt: string = toolPart.input?.prompt ?? "";
      const imageUrl: string | undefined =
        state === "output-available" ? toolPart.output?.imageUrl : undefined;
      return {
        key,
        kind: "generatedImage",
        isActive,
        hasSources: 0,
        verbKey: "generatedImage",
        body: (
          <>
            {prompt && <StepQuery>{prompt}</StepQuery>}
            {imageUrl && <ImageStepBody imageUrl={imageUrl} prompt={prompt} />}
          </>
        ),
      };
    }
    default:
      // Unknown tool — render generic step with the type as its body so we
      // never silently drop a step. Not localized because this branch should
      // only fire in development if a new tool is added without UI.
      return {
        key,
        kind: "calculated",
        isActive,
        hasSources: 0,
        verbKey: "calculated",
        body: <span className="text-ink-3">{part.type}</span>,
      };
  }
};

export const ToolRunRenderer = ({
  group,
  isMessageLoading,
  isLastAssistantMessage,
  isReadonly,
}: ToolRunRendererProps) => {
  const tVerb = useTranslations("chat.tools.run.verb");
  const tRun = useTranslations("chat.tools.run");
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedThoughts, setExpandedThoughts] = useState<Set<string>>(
    () => new Set()
  );

  const toggleThought = (stepKey: string) => {
    setExpandedThoughts((previous) => {
      const next = new Set(previous);
      if (next.has(stepKey)) {
        next.delete(stepKey);
      } else {
        next.add(stepKey);
      }
      return next;
    });
  };

  const lastPart = group.parts.at(-1);
  // biome-ignore lint/suspicious/noExplicitAny: discriminated runtime check
  const lastState: string | undefined = (lastPart as any)?.state;
  const lastIsToolStreaming = lastState ? isStreamingState(lastState) : false;
  const isMessageStreaming =
    isMessageLoading &&
    isLastAssistantMessage &&
    (lastIsToolStreaming || lastPart?.type === "reasoning");

  const startedAtRef = useRef<number>(Date.now());
  const endedAtRef = useRef<number | null>(null);
  if (!isMessageStreaming && endedAtRef.current === null) {
    endedAtRef.current = Date.now();
  }
  if (isMessageStreaming && endedAtRef.current !== null) {
    endedAtRef.current = null;
  }

  const elapsed = useElapsedSeconds(
    isMessageStreaming,
    startedAtRef.current,
    endedAtRef.current
  );

  const steps = useMemo(() => {
    const result: StepDescriptor[] = [];
    for (let i = 0; i < group.parts.length; i++) {
      const step = buildStep({
        part: group.parts[i],
        index: i,
        isLastInGroup: i === group.parts.length - 1,
        isMessageStreaming,
        isReadonly,
      });
      if (step) {
        result.push(step);
      }
    }
    return result;
  }, [group.parts, isMessageStreaming, isReadonly]);

  const totalSources = useMemo(() => {
    const seen = new Set<string>();
    for (const part of group.parts) {
      if (part.type === "tool-webSearch" || part.type === "tool-extractUrl") {
        // biome-ignore lint/suspicious/noExplicitAny: union narrowing at runtime
        const output = (part as any).output;
        if (!output || output.error || !Array.isArray(output.results)) {
          continue;
        }
        for (const result of output.results) {
          if (typeof result?.url === "string") {
            seen.add(extractDomain(result.url));
          }
        }
      }
    }
    return seen.size;
  }, [group.parts]);

  const searchCount = useMemo(
    () =>
      group.parts.filter(
        (part) =>
          part.type === "tool-webSearch" || part.type === "tool-extractUrl"
      ).length,
    [group.parts]
  );

  if (steps.length === 0) {
    return null;
  }

  const onlyThought = steps.length === 1 && steps[0].kind === "thought";

  let title: React.ReactNode;
  if (isMessageStreaming) {
    title = (
      <>
        {tRun("researching")}
        <em className="font-normal text-ink-2 italic">…</em>
      </>
    );
  } else if (onlyThought) {
    title = tRun("thoughtFor", { duration: elapsed });
  } else if (steps.length === 1) {
    title = tRun("lookedItUp");
  } else {
    title = tRun("researched");
  }

  const meta = (
    <>
      {searchCount > 0 && (
        <>
          <span>{tRun("searches", { count: searchCount })}</span>
          <ToolRunMetaSeparator />
        </>
      )}
      {totalSources > 0 && (
        <>
          <span>{tRun("sources", { count: totalSources })}</span>
          <ToolRunMetaSeparator />
        </>
      )}
      <span>
        {isMessageStreaming
          ? tRun("elapsed", { seconds: elapsed })
          : tRun("totalSeconds", { seconds: elapsed })}
      </span>
    </>
  );

  const earlierCount = Math.max(0, steps.length - RECENT_STEPS_COUNT);
  const earlierSteps = earlierCount > 0 ? steps.slice(0, earlierCount) : [];
  const recentSteps = earlierCount > 0 ? steps.slice(earlierCount) : steps;

  return (
    <ToolRun>
      <ToolRunHeader
        isStreaming={isMessageStreaming}
        meta={meta}
        title={title}
      />

      <EarlierStepsToggle
        count={earlierCount}
        hint={
          earlierCount > 0 && !isExpanded ? (
            <>— {tRun("earlierStepsHint", { count: earlierCount })}</>
          ) : null
        }
        isOpen={isExpanded}
        label={tRun("earlierSteps", { count: earlierCount })}
        onToggle={() => setIsExpanded((prev) => !prev)}
      />

      {earlierCount > 0 && isExpanded && (
        <div className="border-rule border-b bg-paper">
          {earlierSteps.map((step, index) => {
            const isThoughtExpanded =
              step.kind === "thought" && expandedThoughts.has(step.key);
            return (
              <ToolRunStep
                body={step.body}
                expandedContent={
                  step.fullText ? (
                    <Response className="grid gap-2">{step.fullText}</Response>
                  ) : undefined
                }
                isActive={step.isActive}
                isExpanded={isThoughtExpanded}
                isFirst={index === 0}
                isLast={index === earlierSteps.length - 1}
                key={step.key}
                kind={step.kind}
                onToggle={
                  step.kind === "thought" && step.fullText
                    ? () => toggleThought(step.key)
                    : undefined
                }
                verb={tVerb(step.verbKey)}
              />
            );
          })}
        </div>
      )}

      <div>
        {recentSteps.map((step, index) => {
          const isThoughtExpanded =
            step.kind === "thought" && expandedThoughts.has(step.key);
          return (
            <ToolRunStep
              body={step.body}
              expandedContent={
                step.fullText ? (
                  <Response className="grid gap-2">{step.fullText}</Response>
                ) : undefined
              }
              isActive={step.isActive}
              isExpanded={isThoughtExpanded}
              isFirst={index === 0 && (earlierCount === 0 || !isExpanded)}
              isLast={index === recentSteps.length - 1}
              key={step.key}
              kind={step.kind}
              onToggle={
                step.kind === "thought" && step.fullText
                  ? () => toggleThought(step.key)
                  : undefined
              }
              verb={tVerb(step.verbKey)}
            />
          );
        })}
      </div>
    </ToolRun>
  );
};
