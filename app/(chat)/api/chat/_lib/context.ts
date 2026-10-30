import type { UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import type {
  ImageGenSetting,
  ThinkingSetting,
  VideoGenSetting,
} from "@/lib/ai/models";
import type { ProjectContextInput, RequestHints } from "@/lib/ai/prompts";
import type { ImageGenerationUsageAccumulator } from "@/lib/ai/tools/generate-image";
import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import type { TurnAbort } from "./turn-abort";
import type { TurnOutcome, TurnSettlement } from "./turn-lifecycle";

/**
 * Writer handed to createUIMessageStream's execute callback. Intentionally the
 * loose (default-generic) writer: the route does not parametrize the stream
 * with ChatMessage, so data parts (e.g. the imageGenerationFinish payload with
 * its extra documentId) are written permissively, matching prior behavior.
 */
export type StreamWriter = UIMessageStreamWriter;

/**
 * Everything a mode handler needs to run one chat turn. Assembled by
 * prepareChatTurn after auth, persistence, and history sanitization.
 */
export type ChatTurnContext = {
  session: Session;
  userId: string;
  chatId: string;
  streamId: string;
  message: ChatMessage;
  uiMessages: ChatMessage[];
  model: string;
  thinkingSetting: ThinkingSetting | undefined;
  imageGenSetting: ImageGenSetting | undefined;
  videoGenSetting: VideoGenSetting | undefined;
  previousGenerationId?: string;
  webSearchEnabled: boolean;
  /** Multi-step inference cap; drives stopWhen + the validator's log context. */
  stepLimit: number;
  requestHints: RequestHints;
  projectContext: ProjectContextInput | null;
  imageUsageAccumulator: ImageGenerationUsageAccumulator;
  /**
   * Mutable sink for the merged usage record. Only the text handler sets it;
   * the stream's onFinish reads it to persist the chat's last context (image
   * and video turns intentionally leave it unset, matching prior behavior).
   */
  lastUsage: { value?: AppUsage };
  hasBalance: boolean;
  /**
   * Stop control for the turn: `turnAbort.signal` aborts the provider request;
   * `turnAbort.requestAbort()` is the entry point for a user stop (it waits
   * for running tool calls to finish first).
   */
  turnAbort: TurnAbort;
  /**
   * Resolved by the handler on every terminal path, once the turn is billed.
   * The route awaits it (text turns) before persisting the assistant message,
   * because the SDK does not await `onAbort`.
   */
  turnSettlement: TurnSettlement;
  /** How the turn ended; set by the text handler (or the route for a skipped turn). */
  turnOutcome?: TurnOutcome;
};

/** A mode handler: runs inference for one turn, writing to the UI stream. */
export type StreamHandler = (
  ctx: ChatTurnContext,
  writer: StreamWriter
) => Promise<void>;
