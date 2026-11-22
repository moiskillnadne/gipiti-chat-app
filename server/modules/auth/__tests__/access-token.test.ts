import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACCESS_TOKEN_TTL_SECONDS,
  signAccessToken,
  verifyAccessToken,
} from "@/server/modules/auth/access-token";
import {
  ApiTokenSecretError,
  getApiTokenKeys,
} from "@/server/modules/auth/api-token-secret";

const { environment } = vi.hoisted(() => ({
  environment: { isProduction: false },
}));

vi.mock("@/server/env", () => ({
  get isProductionEnvironment() {
    return environment.isProduction;
  },
}));

const SECRET = "a-test-secret-that-is-long-enough-0001";
const OTHER_SECRET = "a-test-secret-that-is-long-enough-0002";
const CLAIMS = {
  userId: "user-1",
  sessionId: "session-1",
  tokenVersion: 3,
};
const NOW = new Date("2026-11-22T12:00:00.000Z");
const ONE_SECOND_MS = 1000;

const signForeignToken = (
  overrides: { issuer?: string; audience?: string; keyId?: string } = {}
): Promise<string> =>
  new SignJWT({ sid: CLAIMS.sessionId, ver: CLAIMS.tokenVersion })
    .setProtectedHeader({
      alg: "HS256",
      kid: overrides.keyId ?? getApiTokenKeys().current.keyId,
    })
    .setSubject(CLAIMS.userId)
    .setIssuer(overrides.issuer ?? "gipiti")
    .setAudience(overrides.audience ?? "gipiti-api")
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(SECRET));

beforeEach(() => {
  environment.isProduction = false;
  vi.stubEnv("API_TOKEN_SECRET", SECRET);
  vi.stubEnv("API_TOKEN_SECRET_PREVIOUS", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("access tokens", () => {
  it("round-trips the claims and expires 15 minutes after it was issued", async () => {
    // Act
    const { token, expiresAt } = await signAccessToken(CLAIMS, NOW);
    vi.useFakeTimers({ now: NOW });
    const claims = await verifyAccessToken(token);

    // Assert
    expect(claims).toEqual(CLAIMS);
    expect(expiresAt.getTime() - NOW.getTime()).toBe(
      ACCESS_TOKEN_TTL_SECONDS * ONE_SECOND_MS
    );
  });

  it("refuses a token after its 15 minutes", async () => {
    // Arrange
    const { token, expiresAt } = await signAccessToken(CLAIMS, NOW);

    // Act
    vi.useFakeTimers({ now: new Date(expiresAt.getTime() + ONE_SECOND_MS) });
    const claims = await verifyAccessToken(token);

    // Assert
    expect(claims).toBeNull();
  });

  it("refuses a token signed with another secret", async () => {
    // Arrange
    const { token } = await signAccessToken(CLAIMS);
    vi.stubEnv("API_TOKEN_SECRET", OTHER_SECRET);

    // Act and assert
    expect(await verifyAccessToken(token)).toBeNull();
  });

  it("still accepts a token signed with the previous secret after a rotation", async () => {
    // Arrange
    const { token } = await signAccessToken(CLAIMS);
    vi.stubEnv("API_TOKEN_SECRET_PREVIOUS", SECRET);
    vi.stubEnv("API_TOKEN_SECRET", OTHER_SECRET);

    // Act and assert
    expect(await verifyAccessToken(token)).toEqual(CLAIMS);
  });

  it("signs new tokens with the current secret, never the previous one", async () => {
    // Arrange
    vi.stubEnv("API_TOKEN_SECRET_PREVIOUS", OTHER_SECRET);

    // Act
    const { token } = await signAccessToken(CLAIMS);
    vi.stubEnv("API_TOKEN_SECRET_PREVIOUS", "");

    // Assert
    expect(await verifyAccessToken(token)).toEqual(CLAIMS);
  });

  it.each<[string, { issuer?: string; audience?: string; keyId?: string }]>([
    ["another issuer", { issuer: "someone-else" }],
    ["another audience", { audience: "another-api" }],
    ["a key id it does not know", { keyId: "ffffffff" }],
  ])("refuses a correctly signed token with %s", async (_case, overrides) => {
    // Arrange
    const token = await signForeignToken(overrides);

    // Act and assert
    expect(await verifyAccessToken(token)).toBeNull();
  });

  it.each<[string, string]>([
    ["an empty string", ""],
    ["text that is not a token", "not.a.token"],
    ["an unsigned token", "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTEifQ."],
  ])("refuses %s", async (_case, token) => {
    expect(await verifyAccessToken(token)).toBeNull();
  });

  it("refuses a token whose payload was changed after signing", async () => {
    // Arrange
    const { token } = await signAccessToken(CLAIMS);
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: "user-2", sid: "session-1", ver: 3 })
    ).toString("base64url");

    // Act and assert
    expect(
      await verifyAccessToken(`${header}.${forgedPayload}.${signature}`)
    ).toBeNull();
  });
});

describe("the API token secret", () => {
  it("falls back to a development secret outside production", async () => {
    // Arrange
    vi.stubEnv("API_TOKEN_SECRET", "");

    // Act
    const { token } = await signAccessToken(CLAIMS);

    // Assert
    expect(await verifyAccessToken(token)).toEqual(CLAIMS);
  });

  it.each<[string, string]>([
    ["missing", ""],
    ["shorter than 32 characters", "too-short"],
  ])(
    "throws in production when the secret is %s, for signing and for verifying",
    async (_case, secret) => {
      // Arrange
      const { token } = await signAccessToken(CLAIMS);
      environment.isProduction = true;
      vi.stubEnv("API_TOKEN_SECRET", secret);

      // Act and assert
      await expect(signAccessToken(CLAIMS)).rejects.toBeInstanceOf(
        ApiTokenSecretError
      );
      await expect(verifyAccessToken(token)).rejects.toBeInstanceOf(
        ApiTokenSecretError
      );
    }
  );

  it("ignores a previous secret that is too short", () => {
    // Arrange
    vi.stubEnv("API_TOKEN_SECRET_PREVIOUS", "too-short");

    // Act and assert
    expect(getApiTokenKeys().previous).toBeNull();
  });
});
