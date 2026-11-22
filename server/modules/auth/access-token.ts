import { decodeProtectedHeader, jwtVerify, SignJWT } from "jose";

import {
  type ApiTokenKey,
  getApiTokenKeys,
} from "@/server/modules/auth/api-token-secret";

const SIGNING_ALGORITHM = "HS256";
const TOKEN_ISSUER = "gipiti";
const TOKEN_AUDIENCE = "gipiti-api";
const MILLISECONDS_PER_SECOND = 1000;

/** An access token is accepted for 15 minutes; then the client refreshes. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** What an access token says about its bearer. */
export type AccessTokenClaims = {
  userId: string;
  /** The `AuthSession` the token belongs to. */
  sessionId: string;
  /** The account's token version when the token was issued. */
  tokenVersion: number;
};

export type SignedAccessToken = {
  token: string;
  expiresAt: Date;
};

/**
 * Signs an access token: a JWS (HS256) with the claims `sub`, `sid`, `ver`,
 * `iss`, `aud`, `iat` and `exp`. It carries no entitlements (email verified,
 * tester, subscription): those are read from the database where they matter.
 *
 * @throws ApiTokenSecretError in production when the secret is missing
 */
export const signAccessToken = async (
  { userId, sessionId, tokenVersion }: AccessTokenClaims,
  now: Date = new Date()
): Promise<SignedAccessToken> => {
  const { current } = getApiTokenKeys();
  const expiresAt = new Date(
    now.getTime() + ACCESS_TOKEN_TTL_SECONDS * MILLISECONDS_PER_SECOND
  );

  const token = await new SignJWT({ sid: sessionId, ver: tokenVersion })
    .setProtectedHeader({
      alg: SIGNING_ALGORITHM,
      kid: current.keyId,
      typ: "JWT",
    })
    .setSubject(userId)
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .sign(current.key);

  return { token, expiresAt };
};

/** The key a token names in its header, or null when it names neither. */
const keyNamedBy = (token: string): ApiTokenKey | null => {
  const { current, previous } = getApiTokenKeys();
  const { kid } = decodeProtectedHeader(token);

  return [current, previous].find((key) => key?.keyId === kid) ?? null;
};

/**
 * Checks an access token's signature, issuer, audience and expiry.
 *
 * Null for anything that is not a valid token of ours, whatever the reason:
 * the caller answers 401 either way and must not tell the reasons apart.
 * This says nothing yet about the session being alive; see
 * `resolveBearerSession`.
 *
 * @throws ApiTokenSecretError in production when the secret is missing
 */
export const verifyAccessToken = async (
  token: string
): Promise<AccessTokenClaims | null> => {
  // Read before the try: a missing secret is the server's fault, not the
  // token's, and must not be reported as "invalid token".
  getApiTokenKeys();

  try {
    const key = keyNamedBy(token);
    if (!key) {
      return null;
    }

    const { payload } = await jwtVerify(token, key.key, {
      algorithms: [SIGNING_ALGORITHM],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });

    const { sub, sid, ver } = payload;
    if (
      typeof sub !== "string" ||
      typeof sid !== "string" ||
      typeof ver !== "number"
    ) {
      return null;
    }

    return { userId: sub, sessionId: sid, tokenVersion: ver };
  } catch {
    return null;
  }
};
