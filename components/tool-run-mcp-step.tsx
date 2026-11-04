import type { ReactNode } from "react";
import type { TranslateFn } from "@/lib/i18n/translate";
import {
  KNOWN_ERROR_CODES,
  parseMcpPartName,
  readMcpFailure,
} from "@/lib/integrations/ui";
import type { McpToolUIPart } from "@/lib/types";

export type McpStep = {
  /** Localized "<integration>: <tool>" label for the step verb. */
  verb: string;
  body: ReactNode;
};

type BuildMcpStepArgs = {
  part: McpToolUIPart;
  t: TranslateFn;
};

/**
 * Run-card row for an MCP tool call. Each status is its own keyed element so a
 * streaming -> done swap replaces a whole node (page translators, GIPITI-101).
 */
export const buildMcpStep = ({ part, t }: BuildMcpStepArgs): McpStep => {
  const name = parseMcpPartName(part.type);
  const integration =
    name?.integration === "custom" || !name
      ? t("run.customIntegration")
      : name.integration;
  const verb = t("run.call", { integration, tool: name?.tool ?? "" });

  if (part.state === "output-error") {
    return {
      verb,
      body: (
        <span className="text-destructive" key="error">
          {t("errors.tool_error")}
        </span>
      ),
    };
  }

  const failure = readMcpFailure(part.output);
  if (failure) {
    const code = (KNOWN_ERROR_CODES as readonly string[]).includes(failure.code)
      ? failure.code
      : "tool_error";
    return {
      verb,
      body: (
        <span className="text-destructive" key="failed">
          {t(`errors.${code}`)}
        </span>
      ),
    };
  }

  if (part.state === "output-available") {
    return {
      verb,
      body: (
        <span className="text-ink-3" key="done">
          {t("run.done")}
        </span>
      ),
    };
  }

  return {
    verb,
    body: (
      <span className="text-ink-3" key="running">
        {t("run.running")}
      </span>
    ),
  };
};
