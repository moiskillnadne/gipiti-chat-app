import { getUpstashClient } from "@/server/integrations/redis/client";

/**
 * How long a cached version may live. A bump overwrites the cached value at
 * once; the expiry only bounds how long a stale value can survive when that
 * write is lost (Redis unreachable at the moment of the bump).
 */
const TOKEN_VERSION_CACHE_SECONDS = 600;

/** What a session without a `ver` claim was issued under: the first version. */
const INITIAL_TOKEN_VERSION = 0;

const cacheKeyOf = (userId: string): string => `tv:${userId}`;

/** The claims of a session that the version check reads. */
export type VersionedSessionClaims = {
  /** The account the session belongs to. */
  id?: string;
  /** The token version the session was issued under; absent on old cookies. */
  ver?: number;
};

const readCachedVersion = async (userId: string): Promise<number | null> => {
  const redis = getUpstashClient();
  if (!redis) {
    return null;
  }

  try {
    const cached = await redis.get<number>(cacheKeyOf(userId));

    return typeof cached === "number" ? cached : null;
  } catch (error) {
    console.warn("[token-version] cache read failed:", error);
    return null;
  }
};

/**
 * Loaded on first use: `proxy.ts` calls this module on page navigations, and
 * the database driver should stay out of its way while the cache answers.
 */
const readStoredVersion = async (userId: string): Promise<number | null> => {
  const { getUserTokenVersion } = await import(
    "@/server/modules/users/queries/get-token-version"
  );

  return getUserTokenVersion(userId);
};

/**
 * Caches a version read from the database, unless a value is already there.
 * "Unless": between that read and this write the account may have been
 * bumped, and the bump's own write must not be replaced by the older number.
 */
const cacheStoredVersion = async (
  userId: string,
  version: number
): Promise<void> => {
  const redis = getUpstashClient();
  if (!redis) {
    return;
  }

  try {
    await redis.set(cacheKeyOf(userId), version, {
      ex: TOKEN_VERSION_CACHE_SECONDS,
      nx: true,
    });
  } catch (error) {
    console.warn("[token-version] cache write failed:", error);
  }
};

/**
 * The account's current token version: from Redis when it is there, otherwise
 * from the database. Null when the account does not exist.
 *
 * @throws when the database has to be asked and cannot be read
 */
export const getTokenVersion = async (
  userId: string
): Promise<number | null> => {
  const cachedVersion = await readCachedVersion(userId);
  if (cachedVersion !== null) {
    return cachedVersion;
  }

  const storedVersion = await readStoredVersion(userId);
  if (storedVersion !== null) {
    await cacheStoredVersion(userId, storedVersion);
  }

  return storedVersion;
};

/**
 * Tells the cache that the account's version is now `version`. Called right
 * after the database update that bumped it, so that sessions issued under
 * the old version stop being accepted at once, not when the cached value
 * expires.
 */
export const rememberTokenVersion = async (
  userId: string,
  version: number
): Promise<void> => {
  const redis = getUpstashClient();
  if (!redis) {
    return;
  }

  try {
    await redis.set(cacheKeyOf(userId), version, {
      ex: TOKEN_VERSION_CACHE_SECONDS,
    });
  } catch (error) {
    // The stale value lives until it expires; see TOKEN_VERSION_CACHE_SECONDS.
    console.error(
      `[token-version] could not cache version ${version} of user ${userId}:`,
      error
    );
  }
};

/**
 * Whether a session was issued under the account's current token version.
 *
 * False when the version moved on (password reset, "log out everywhere") or
 * the account is gone. True, with an error logged, when the version cannot
 * be read at all: a failed lookup must not sign every user out, and nothing
 * a stale session could reach works without the database either.
 */
export const isSessionVersionCurrent = async ({
  id,
  ver,
}: VersionedSessionClaims): Promise<boolean> => {
  if (!id) {
    return false;
  }

  try {
    const currentVersion = await getTokenVersion(id);

    return currentVersion === (ver ?? INITIAL_TOKEN_VERSION);
  } catch (error) {
    console.error("[token-version] version check failed, session kept:", error);
    return true;
  }
};
