import { createClient } from "redis";

/**
 * Cross-instance "user pressed Stop" signal for a streaming text turn.
 *
 * The stop request (`POST /api/chat/[id]/stop`) and the instance that runs the
 * model call are usually different serverless invocations, so the signal goes
 * through three layers:
 *  1. in-process watchers — the only layer without Redis, and the fast path;
 *  2. Redis pub/sub on `gipiti:chat-stop:<userId>:<chatId>:<turnId>` — reaches
 *     other instances;
 *  3. the same Redis key (`SET ... EX`) — read once right after subscribing, so
 *     a stop that landed before the producer subscribed is not lost.
 *
 * A stop is matched to the TURN, not to the clock: the client generates a
 * `turnId` for every chat POST, sends it in the body and uses it again in the
 * stop request. The server watches `body.turnId`, falling back to the user
 * message id for clients that send none. So clock skew and slow cold starts
 * cannot drop an early stop, a late stop cannot hit the next turn (it has
 * another id, even when regenerate/edit re-send the same user message), and
 * two tabs on one chat do not stop each other. The user id is part of the key,
 * so one user can never stop another user's turn. A marker is consumed when it
 * fires and deleted when the watching turn ends.
 *
 * A resumed stream (after a reload) did not make the POST: the server tells the
 * client the `turnId` in a transient stream part.
 *
 * Everything here is best effort: failures are logged, never thrown.
 */

const KEY_PREFIX = "gipiti:chat-stop:";
// Long enough for a cold start of the producer; the marker is also deleted
// when the watching turn ends.
const STOP_TTL_SECONDS = 60;
const STOP_TTL_MS = STOP_TTL_SECONDS * 1000;
// Route maxDuration is 300s; the margin lets the turn settle before cleanup.
const DEFAULT_MAX_LIFETIME_MS = 330_000;
const REDIS_CONNECT_TIMEOUT_MS = 3000;
const REDIS_RETRY_AFTER_MS = 30_000;

type RedisClient = ReturnType<typeof createClient>;
type RedisPair = { publisher: RedisClient; subscriber: RedisClient };

type Watcher = { trigger: () => void };

const watchers = new Map<string, Set<Watcher>>();
// Stops requested on this instance (key -> when), so a watcher registered a
// moment later (the stop raced the start of the turn) still sees them without
// Redis.
const localStops = new Map<string, number>();

let redisPromise: Promise<RedisPair | null> | undefined;
let redisFailedAt = 0;

type TurnRef = { userId: string; chatId: string; turnId: string };

const stopKey = ({ userId, chatId, turnId }: TurnRef) =>
  `${KEY_PREFIX}${userId}:${chatId}:${turnId}`;

const REDIS_URL_PATTERN = /^rediss?:\/\//;

const isRedisUrl = (url: string | undefined): url is string =>
  Boolean(url && REDIS_URL_PATTERN.test(url));

const noop = () => {
  // Intentionally empty: the cleanup promise never rejects.
};

function hasRecentLocalStop(key: string): boolean {
  const requestedAt = localStops.get(key);
  if (requestedAt === undefined) {
    return false;
  }
  if (Date.now() - requestedAt > STOP_TTL_MS) {
    localStops.delete(key);
    return false;
  }
  return true;
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
 * Ask the instance running turn `turnId` to abort. Resolves once the signal has
 * been handed to every available layer.
 */
export async function requestChatStop(turn: TurnRef): Promise<void> {
  const key = stopKey(turn);

  // The turn runs on this instance: nothing else needs to hear about it.
  const local = [...(watchers.get(key) ?? [])];
  if (local.length > 0) {
    for (const watcher of local) {
      watcher.trigger();
    }
    return;
  }

  const now = Date.now();
  for (const [oldKey, requestedAt] of localStops) {
    if (now - requestedAt > STOP_TTL_MS) {
      localStops.delete(oldKey);
    }
  }
  localStops.set(key, now);

  try {
    const redis = await getRedis();
    if (!redis) {
      return;
    }
    await redis.publisher.set(key, "1", { EX: STOP_TTL_SECONDS });
    await redis.publisher.publish(key, "1");
  } catch (error) {
    console.warn("[chat-stop] failed to publish stop", turn, error);
  }
}

type WatchChatStopArgs = TurnRef & {
  onStop: () => void;
  /** Safety net: the watcher unregisters itself after this long. */
  maxLifetimeMs?: number;
};

/**
 * Call `onStop` (at most once) when a stop is requested for turn `turnId`.
 *
 * Returns at once with a cleanup function (idempotent, never rejects) that the
 * caller must invoke when the turn ends. The Redis subscription is set up in
 * the background so it never sits on the time-to-first-token path; the check of
 * the stored marker right after subscribing covers a stop that landed before
 * the subscription was live. Cleanup waits for a subscription still in flight.
 */
export function watchChatStop({
  userId,
  chatId,
  turnId,
  onStop,
  maxLifetimeMs = DEFAULT_MAX_LIFETIME_MS,
}: WatchChatStopArgs): () => Promise<void> {
  const key = stopKey({ userId, chatId, turnId });
  let stopped = false;
  let cleanedUp = false;
  let subscribed: RedisPair | undefined;

  const trigger = () => {
    if (stopped || cleanedUp) {
      return;
    }
    stopped = true;
    // Consume the marker so nothing can fire again on it.
    localStops.delete(key);
    if (subscribed) {
      subscribed.publisher.del(key).catch((error) => {
        console.warn("[chat-stop] failed to consume marker", { chatId }, error);
      });
    }
    try {
      onStop();
    } catch (error) {
      console.warn("[chat-stop] onStop handler failed", { chatId }, error);
    }
  };
  const listener = () => trigger();

  const watcher: Watcher = { trigger };
  const forKey = watchers.get(key) ?? new Set<Watcher>();
  forKey.add(watcher);
  watchers.set(key, forKey);

  if (hasRecentLocalStop(key)) {
    trigger();
  }

  const ready = (async () => {
    try {
      const redis = await getRedis();
      if (!redis || cleanedUp) {
        return;
      }
      await redis.subscriber.subscribe(key, listener);
      subscribed = redis;
      // A stop published before we subscribed is only visible in the key.
      if (!cleanedUp && (await redis.publisher.exists(key)) > 0) {
        trigger();
      }
    } catch (error) {
      console.warn("[chat-stop] redis watch failed, in-process only", error);
    }
  })();

  let timer: ReturnType<typeof setTimeout> | undefined;
  let cleanup: Promise<void> | undefined;
  const runCleanup = () => {
    cleanup ??= (async () => {
      cleanedUp = true;
      clearTimeout(timer);
      forKey.delete(watcher);
      if (forKey.size === 0 && watchers.get(key) === forKey) {
        watchers.delete(key);
      }
      // The turn is over: its stop marker must not hit a later turn that
      // answers the same user message (regenerate).
      localStops.delete(key);

      await ready;
      if (subscribed) {
        try {
          await subscribed.subscriber.unsubscribe(key, listener);
          await subscribed.publisher.del(key);
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
  localStops.clear();
  redisPromise = undefined;
  redisFailedAt = 0;
}
