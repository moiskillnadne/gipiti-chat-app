import { createClient } from "redis";

/**
 * Cross-instance "user pressed Stop" signal for a streaming text turn.
 *
 * The stop request (`POST /api/chat/[id]/stop`) and the instance that runs the
 * model call are usually different serverless invocations, so the signal goes
 * through three layers:
 *  1. in-process watchers — the only layer without Redis, and the fast path;
 *  2. Redis pub/sub on `gipiti:chat-stop:<chatId>` — reaches other instances;
 *  3. the same Redis key (`SET ... EX`) — read once right after subscribing, so
 *     a stop that landed before the producer subscribed is not lost.
 *
 * The value is the server timestamp of the stop. A producer only honours a stop
 * with `ts >= startedAt` of its own turn, so a stale stop from an earlier turn
 * of the same chat can never kill the next one.
 *
 * Everything here is best effort: failures are logged, never thrown.
 */

const KEY_PREFIX = "gipiti:chat-stop:";
const STOP_TTL_SECONDS = 120;
const STOP_TTL_MS = STOP_TTL_SECONDS * 1000;
// Route maxDuration is 300s; the margin lets the turn settle before cleanup.
const DEFAULT_MAX_LIFETIME_MS = 330_000;
const REDIS_CONNECT_TIMEOUT_MS = 3000;
const REDIS_RETRY_AFTER_MS = 30_000;

type RedisClient = ReturnType<typeof createClient>;
type RedisPair = { publisher: RedisClient; subscriber: RedisClient };

type Watcher = { startedAt: number; trigger: (ts: number) => void };

const watchers = new Map<string, Set<Watcher>>();
// Stops requested on this instance, so a watcher registered a moment later
// (stop raced the start of the turn) still sees them without Redis.
const lastLocalStop = new Map<string, number>();

let redisPromise: Promise<RedisPair | null> | undefined;
let redisFailedAt = 0;

const stopKey = (chatId: string) => `${KEY_PREFIX}${chatId}`;

const REDIS_URL_PATTERN = /^rediss?:\/\//;

const isRedisUrl = (url: string | undefined): url is string =>
  Boolean(url && REDIS_URL_PATTERN.test(url));

const noop = () => {
  // Intentionally empty: the cleanup promise never rejects.
};

function recentLocalStop(chatId: string): number | undefined {
  const ts = lastLocalStop.get(chatId);
  if (ts === undefined) {
    return;
  }
  if (Date.now() - ts > STOP_TTL_MS) {
    lastLocalStop.delete(chatId);
    return;
  }
  return ts;
}

async function connectRedis(url: string): Promise<RedisPair | null> {
  const publisher = createClient({ url });
  const subscriber = publisher.duplicate();
  const onError = (error: unknown) =>
    console.warn("[chat-stop] redis client error", error);
  publisher.on("error", onError);
  subscriber.on("error", onError);

  try {
    await Promise.race([
      Promise.all([publisher.connect(), subscriber.connect()]),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("redis connect timeout")),
          REDIS_CONNECT_TIMEOUT_MS
        )
      ),
    ]);
    return { publisher, subscriber };
  } catch (error) {
    console.warn("[chat-stop] redis unavailable, in-process only", error);
    publisher.destroy();
    subscriber.destroy();
    return null;
  }
}

/**
 * Lazily created singleton pair (publisher + pub/sub subscriber). Resolves to
 * null when Redis is not configured or could not be reached; a failed connect
 * is retried after a cooldown.
 */
function getRedis(): Promise<RedisPair | null> {
  const retry =
    redisFailedAt > 0 && Date.now() - redisFailedAt > REDIS_RETRY_AFTER_MS;
  if (redisPromise && !retry) {
    return redisPromise;
  }

  const url = process.env.REDIS_URL || process.env.KV_URL;
  if (!isRedisUrl(url)) {
    redisPromise = Promise.resolve(null);
    return redisPromise;
  }

  redisFailedAt = 0;
  redisPromise = connectRedis(url).then((pair) => {
    if (!pair) {
      redisFailedAt = Date.now();
    }
    return pair;
  });
  return redisPromise;
}

/**
 * Ask the instance running `chatId`'s current turn to abort. Resolves once the
 * signal has been handed to every available layer.
 */
export async function requestChatStop(chatId: string): Promise<void> {
  const ts = Date.now();

  lastLocalStop.set(chatId, ts);
  for (const watcher of [...(watchers.get(chatId) ?? [])]) {
    watcher.trigger(ts);
  }

  try {
    const redis = await getRedis();
    if (!redis) {
      return;
    }
    const key = stopKey(chatId);
    await redis.publisher.set(key, String(ts), { EX: STOP_TTL_SECONDS });
    await redis.publisher.publish(key, String(ts));
  } catch (error) {
    console.warn("[chat-stop] failed to publish stop", { chatId }, error);
  }
}

type WatchChatStopArgs = {
  chatId: string;
  /** Server timestamp (ms) at which this turn started; older stops are ignored. */
  startedAt: number;
  onStop: () => void;
  /** Safety net: the watcher unregisters itself after this long. */
  maxLifetimeMs?: number;
};

/**
 * Call `onStop` (at most once) when a stop newer than `startedAt` is requested
 * for the chat. Resolves after the Redis subscription is live and the early-stop
 * check has run, to a cleanup function (idempotent) that the caller must invoke
 * when the turn ends.
 */
export async function watchChatStop({
  chatId,
  startedAt,
  onStop,
  maxLifetimeMs = DEFAULT_MAX_LIFETIME_MS,
}: WatchChatStopArgs): Promise<() => Promise<void>> {
  let stopped = false;
  let cleanedUp = false;
  let subscribed: RedisPair | undefined;
  const channel = stopKey(chatId);

  const trigger = (ts: number) => {
    if (stopped || cleanedUp || !(ts >= startedAt)) {
      return;
    }
    stopped = true;
    try {
      onStop();
    } catch (error) {
      console.warn("[chat-stop] onStop handler failed", { chatId }, error);
    }
  };
  const listener = (message: string) => trigger(Number(message));

  const watcher: Watcher = { startedAt, trigger };
  const forChat = watchers.get(chatId) ?? new Set<Watcher>();
  forChat.add(watcher);
  watchers.set(chatId, forChat);

  const localStop = recentLocalStop(chatId);
  if (localStop !== undefined) {
    trigger(localStop);
  }

  try {
    const redis = await getRedis();
    if (redis) {
      await redis.subscriber.subscribe(channel, listener);
      subscribed = redis;
      // A stop published before we subscribed is only visible in the key.
      const stored = await redis.publisher.get(channel);
      if (stored !== null) {
        trigger(Number(stored));
      }
    }
  } catch (error) {
    console.warn("[chat-stop] redis watch failed, in-process only", error);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let cleanup: Promise<void> | undefined;
  const runCleanup = () => {
    cleanup ??= (async () => {
      cleanedUp = true;
      clearTimeout(timer);
      forChat.delete(watcher);
      if (forChat.size === 0 && watchers.get(chatId) === forChat) {
        watchers.delete(chatId);
      }
      if (subscribed) {
        try {
          await subscribed.subscriber.unsubscribe(channel, listener);
        } catch (error) {
          console.warn("[chat-stop] unsubscribe failed", { chatId }, error);
        }
      }
    })();
    return cleanup;
  };

  timer = setTimeout(() => {
    runCleanup().catch(noop);
  }, maxLifetimeMs);
  // Never keep a serverless process / test runner alive just for this timer.
  timer.unref?.();

  return runCleanup;
}

/** Test hook: drop all in-process state (watchers, remembered stops, clients). */
export function __resetStopSignalForTests(): void {
  watchers.clear();
  lastLocalStop.clear();
  redisPromise = undefined;
  redisFailedAt = 0;
}
