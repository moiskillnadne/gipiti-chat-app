import { getUpstashClient } from "@/lib/redis";
import { MEDIA_TURN_SLOT_LIMIT, TEXT_TURN_SLOT_LIMIT } from "./constants";

/** Image and video turns share the media slot. */
export type TurnSlotKind = "text" | "media";

export type TurnSlotMode = "text" | "image" | "video";

/** A held slot. `release` is idempotent and never rejects. */
export type TurnSlot = {
  release: () => Promise<void>;
  /** Resolves once `release` has finished. */
  whenReleased: Promise<void>;
};

type SlotAcquireInput = {
  key: string;
  slotId: string;
  limit: number;
  ttlMs: number;
  nowMs: number;
};

type SlotReleaseInput = {
  key: string;
  slotId: string;
};

export type TurnSlotBackend = {
  /** Atomically drops expired slots and takes one if under `limit`. */
  acquire: (input: SlotAcquireInput) => Promise<boolean>;
  release: (input: SlotReleaseInput) => Promise<void>;
};

/** The two Upstash commands the Redis backend needs. */
export type RedisSlotClient = {
  eval: (script: string, keys: string[], args: string[]) => Promise<unknown>;
  zrem: (key: string, member: string) => Promise<unknown>;
};

type AcquireTurnSlotInput = {
  userId: string;
  kind: TurnSlotKind;
  /** How long a slot lives if it is never released (a crashed turn). */
  ttlMs: number;
};

type TurnSlotLimiterOptions = {
  primary: TurnSlotBackend;
  /** Used when the primary backend fails, for the turn that hit the failure. */
  fallback: TurnSlotBackend;
  now?: () => number;
  generateSlotId?: () => string;
};

const SLOT_LIMITS: Record<TurnSlotKind, number> = {
  text: TEXT_TURN_SLOT_LIMIT,
  media: MEDIA_TURN_SLOT_LIMIT,
};

// One sorted set per user and kind: member = slot id, score = expiry (ms).
// KEYS[1] key; ARGV: now, limit, expiresAt, ttlMs, slotId.
const ACQUIRE_SLOT_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) then
  return 0
end
redis.call('ZADD', KEYS[1], ARGV[3], ARGV[5])
redis.call('PEXPIRE', KEYS[1], ARGV[4])
return 1
`;

export const turnSlotKindForMode = (mode: TurnSlotMode): TurnSlotKind =>
  mode === "text" ? "text" : "media";

const slotKey = (kind: TurnSlotKind, userId: string): string =>
  `turn-slots:${kind}:${userId}`;

export const createRedisSlotBackend = (
  client: RedisSlotClient
): TurnSlotBackend => ({
  acquire: async ({ key, slotId, limit, ttlMs, nowMs }) => {
    const result = await client.eval(
      ACQUIRE_SLOT_SCRIPT,
      [key],
      [
        String(nowMs),
        String(limit),
        String(nowMs + ttlMs),
        String(ttlMs),
        slotId,
      ]
    );
    return Number(result) === 1;
  },
  release: async ({ key, slotId }) => {
    await client.zrem(key, slotId);
  },
});

/** Per-process backend with the same semantics as the Redis one. */
export const createMemorySlotBackend = (): TurnSlotBackend => {
  // key → (slot id → expiry ms)
  const slotsByKey = new Map<string, Map<string, number>>();

  // Synchronous, so check-and-take cannot interleave within the process.
  const takeSlot = ({
    key,
    slotId,
    limit,
    ttlMs,
    nowMs,
  }: SlotAcquireInput): boolean => {
    const slots = slotsByKey.get(key) ?? new Map<string, number>();
    slotsByKey.set(key, slots);
    for (const [id, expiresAt] of slots) {
      if (expiresAt <= nowMs) {
        slots.delete(id);
      }
    }
    if (slots.size >= limit) {
      return false;
    }
    slots.set(slotId, nowMs + ttlMs);
    return true;
  };

  const dropSlot = ({ key, slotId }: SlotReleaseInput): void => {
    const slots = slotsByKey.get(key);
    slots?.delete(slotId);
    if (slots?.size === 0) {
      slotsByKey.delete(key);
    }
  };

  return {
    acquire: (input) => Promise.resolve(takeSlot(input)),
    release: (input) => {
      dropSlot(input);
      return Promise.resolve();
    },
  };
};

/**
 * Limits how many turns of each kind one user has in flight. A Redis failure on
 * acquire neither lets the turn through unchecked nor blocks it: that turn is
 * counted on the fallback (in-memory) backend instead.
 */
export const createTurnSlotLimiter = ({
  primary,
  fallback,
  now = Date.now,
  generateSlotId = () => crypto.randomUUID(),
}: TurnSlotLimiterOptions) => {
  const acquireOn = async (
    backend: TurnSlotBackend,
    input: SlotAcquireInput
  ): Promise<TurnSlotBackend | null> =>
    (await backend.acquire(input)) ? backend : null;

  const acquire = async ({
    userId,
    kind,
    ttlMs,
  }: AcquireTurnSlotInput): Promise<TurnSlot | null> => {
    const input: SlotAcquireInput = {
      key: slotKey(kind, userId),
      slotId: generateSlotId(),
      limit: SLOT_LIMITS[kind],
      ttlMs,
      nowMs: now(),
    };

    let holder: TurnSlotBackend | null;
    try {
      holder = await acquireOn(primary, input);
    } catch (error) {
      console.error("[turn-slot] acquire failed, using in-memory slots", {
        userId,
        kind,
        error,
      });
      holder = await acquireOn(fallback, input);
    }
    if (!holder) {
      return null;
    }

    const heldOn = holder;
    const { promise: whenReleased, resolve: markReleased } =
      Promise.withResolvers<void>();
    let isReleaseStarted = false;
    const release = async (): Promise<void> => {
      if (isReleaseStarted) {
        return whenReleased;
      }
      isReleaseStarted = true;
      try {
        await heldOn.release({ key: input.key, slotId: input.slotId });
      } catch (error) {
        // The slot expires with its TTL; a failed release must not break the
        // turn that is finishing.
        console.error("[turn-slot] release failed", { userId, kind, error });
      } finally {
        markReleased();
      }
    };

    return { release, whenReleased };
  };

  return { acquire };
};

let defaultLimiter: ReturnType<typeof createTurnSlotLimiter> | undefined;

const getDefaultLimiter = (): ReturnType<typeof createTurnSlotLimiter> => {
  if (defaultLimiter) {
    return defaultLimiter;
  }
  const fallback = createMemorySlotBackend();
  const client = getUpstashClient();
  defaultLimiter = createTurnSlotLimiter({
    // Without Redis the in-memory backend is the only one (per process).
    primary: client ? createRedisSlotBackend(client) : fallback,
    fallback,
  });
  return defaultLimiter;
};

/** Take a turn slot for the user, or null when the kind's limit is reached. */
export const acquireTurnSlot = (
  input: AcquireTurnSlotInput
): Promise<TurnSlot | null> => getDefaultLimiter().acquire(input);
