// SPIKE S7 (GIPITI-231), not for main. NextAuth's `getToken` falls back to
// the Authorization header when there is no session cookie. Our API access
// token will be a signed JWT (JWS, HS256), not NextAuth's encrypted one.
// `getToken` must answer null for it and must not throw.
import { SignJWT } from "jose";
import { getToken } from "next-auth/jwt";
import { describe, expect, it } from "vitest";

const AUTH_SECRET = "spike-auth-secret-spike-auth-secret";
const API_TOKEN_SECRET = new TextEncoder().encode(
  "spike-api-token-secret-spike-api-token-secret"
);

const createAccessToken = (): Promise<string> =>
  new SignJWT({ sid: "session-1", ver: 1 })
    .setProtectedHeader({ alg: "HS256", kid: "current" })
    .setSubject("user-1")
    .setIssuer("gipiti")
    .setAudience("gipiti-api")
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(API_TOKEN_SECRET);

describe("getToken with a bearer JWS", () => {
  it("returns null instead of throwing", async () => {
    // Arrange
    const accessToken = await createAccessToken();
    const headers = new Headers({ authorization: `Bearer ${accessToken}` });

    // Act
    const token = await getToken({
      req: { headers },
      secret: AUTH_SECRET,
      secureCookie: true,
    });

    // Assert
    expect(accessToken.split(".")).toHaveLength(3);
    expect(token).toBeNull();
  });

  it("returns null for a request with no cookie and no header", async () => {
    // Act
    const token = await getToken({
      req: { headers: new Headers() },
      secret: AUTH_SECRET,
      secureCookie: true,
    });

    // Assert
    expect(token).toBeNull();
  });
});
