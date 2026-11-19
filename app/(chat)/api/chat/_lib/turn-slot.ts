import {
  acquireTurnSlot,
  type TurnSlot,
  turnSlotKindForMode,
} from "@/lib/billing/turn-slots";
import { ChatSDKError } from "@/lib/errors";
import { getTranslations } from "@/lib/i18n/translate";
import { checkChatRateLimit } from "@/server/http/rate-limit";
import type { ChatTurnContext } from "./context";
import type { ChatMode } from "./resolve-mode";

const rateLimitError = async (
  messageKey: "tooManyRequests" | "tooManyTurnsInFlight"
): Promise<ChatSDKError> => {
  const t = await getTranslations("chat");
  return new ChatSDKError(
    "rate_limit:chat",
    undefined,
    t(`errors.${messageKey}`)
  );
};

/** Throws a 429 `rate_limit:chat` when the user sent too many chat requests. */
export async function enforceChatRateLimit(userId: string): Promise<void> {
  const { success } = await checkChatRateLimit(userId);
  if (!success) {
    throw await rateLimitError("tooManyRequests");
  }
}

/**
 * Take the user's turn slot for the mode, or throw a 429 `rate_limit:chat`
 * when the user already has the maximum number of turns of that kind in flight.
 */
export async function acquireChatTurnSlot({
  userId,
  mode,
  ttlMs,
}: {
  userId: string;
  mode: ChatMode;
  ttlMs: number;
}): Promise<TurnSlot> {
  const slot = await acquireTurnSlot({
    userId,
    kind: turnSlotKindForMode(mode),
    ttlMs,
  });
  if (!slot) {
    throw await rateLimitError("tooManyTurnsInFlight");
  }
  return slot;
}

/**
 * Run a mode handler and release its turn slot once the turn's charge has
 * settled, never before.
 *
 * Text: the handler bills from stream callbacks that outlive `run()`; it
 * resolves `ctx.turnSettlement` after the charge on every terminal path
 * (finish, stop, stream error, and a throw), so the slot is released there.
 * Image/video: the handler awaits its charge before returning, so the slot is
 * released when `run()` settles (returns or throws).
 */
export async function runHoldingTurnSlot({
  mode,
  ctx,
  slot,
  run,
}: {
  mode: ChatMode;
  ctx: ChatTurnContext;
  slot: TurnSlot;
  run: () => Promise<void>;
}): Promise<void> {
  if (mode === "text") {
    ctx.turnSettlement.promise.finally(slot.release);
    await run();
    return;
  }
  try {
    await run();
  } finally {
    await slot.release();
  }
}
