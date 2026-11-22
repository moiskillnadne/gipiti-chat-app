import { createHash } from "node:crypto";

import { isProductionEnvironment } from "@/server/env";

/** Shorter secrets are refused: an HS256 key should be at least 256 bits. */
const MIN_SECRET_LENGTH = 32;

/**
 * Used outside production when `API_TOKEN_SECRET` is not set, so that local
 * development, tests and CI need no setup. Never used in production: there a
 * missing secret is an error.
 */
const DEVELOPMENT_SECRET = "development-api-token-secret-not-for-production";

const KEY_ID_LENGTH = 8;

/** A signing key and the id that tokens signed with it carry (`kid`). */
export type ApiTokenKey = {
  keyId: string;
  key: Uint8Array;
};

export type ApiTokenKeys = {
  /** Signs new tokens and verifies them. */
  current: ApiTokenKey;
  /** Verifies tokens signed before a rotation; signs nothing. */
  previous: ApiTokenKey | null;
};

/** Thrown when the API token secret is missing or too short in production. */
export class ApiTokenSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiTokenSecretError";
  }
}

/**
 * The key id is derived from the secret, so rotating a secret needs no
 * second setting: the old tokens name the old secret by themselves.
 */
const toKey = (secret: string): ApiTokenKey => ({
  keyId: createHash("sha256")
    .update(secret)
    .digest("hex")
    .slice(0, KEY_ID_LENGTH),
  key: new TextEncoder().encode(secret),
});

const readCurrentSecret = (): string => {
  const secret = process.env.API_TOKEN_SECRET;

  if (secret && secret.length >= MIN_SECRET_LENGTH) {
    return secret;
  }

  if (isProductionEnvironment) {
    throw new ApiTokenSecretError(
      secret
        ? `API_TOKEN_SECRET must be at least ${MIN_SECRET_LENGTH} characters`
        : "API_TOKEN_SECRET is not set"
    );
  }

  return DEVELOPMENT_SECRET;
};

/**
 * The keys of API access tokens, read from the environment on each call (not
 * at import): a build, or a deployment that serves only the website, works
 * without the secret, and only the token endpoints fail when it is missing.
 *
 * `API_TOKEN_SECRET` is its own secret, never `AUTH_SECRET`: a session cookie
 * and an API token must not be verifiable with the same key.
 *
 * To rotate: move the current value to `API_TOKEN_SECRET_PREVIOUS`, set a new
 * `API_TOKEN_SECRET`, and remove the previous one after 15 minutes (the life
 * of an access token).
 *
 * @throws ApiTokenSecretError in production when the secret is missing or short
 */
export const getApiTokenKeys = (): ApiTokenKeys => {
  const previousSecret = process.env.API_TOKEN_SECRET_PREVIOUS;

  return {
    current: toKey(readCurrentSecret()),
    previous:
      previousSecret && previousSecret.length >= MIN_SECRET_LENGTH
        ? toKey(previousSecret)
        : null,
  };
};
