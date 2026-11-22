import { createHash, randomUUID } from "node:crypto";
import { type APIResponse, expect, test } from "@playwright/test";
import postgres from "postgres";

/**
 * The auth API as a client that is not the website uses it: plain HTTP with
 * bearer tokens, no browser and no cookie. One account goes through its whole
 * life: sign-up, email verification, sign-in, refresh, a copied refresh
 * token, sign-out.
 *
 * The verification code is written to the database by the test instead of
 * being sent: the mail provider is not part of this, and a real code cannot
 * be read back (only its hash is stored).
 */

const API = "/api/v1";
const PASSWORD = "Api-Flow-Passw0rd!";
const VERIFICATION_CODE = "246810";
const CLIENT = {
  platform: "ios",
  deviceName: "API flow test",
  appVersion: "0.0.1",
};

/** Welcome grant (50) plus email-confirmation bonus (100), in kopecks. */
const BALANCE_AFTER_VERIFICATION_MINOR = 15_000;

type TokenPair = {
  tokenType: string;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const bearer = (tokens: TokenPair): Record<string, string> => ({
  authorization: `Bearer ${tokens.accessToken}`,
});

const reasonOf = async (response: APIResponse): Promise<string | undefined> =>
  (await response.json()).data?.reason;

const connectToDatabase = () => {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL is required for the API flow test");
  }
  return postgres(connectionString, { max: 1 });
};

test.describe("auth API flow with bearer tokens", () => {
  const email = `api-flow-${randomUUID()}@example.test`;
  const sql = connectToDatabase();

  test.beforeAll(async () => {
    // A fresh database has no currency row, and an account's balance needs
    // one. The app's default currency is RUB with two minor-unit digits.
    await sql`
      INSERT INTO "Currency" (code, name, symbol, minor_units)
      VALUES ('RUB', 'Russian ruble', '₽', 2)
      ON CONFLICT (code) DO NOTHING
    `;
  });

  test.afterAll(async () => {
    await sql`DELETE FROM "User" WHERE email = ${email}`;
    await sql.end();
  });

  test("an account signs up, verifies its email, signs in, refreshes and signs out", async ({
    request,
  }) => {
    // --- sign-up -----------------------------------------------------------
    const registered = await request.post(`${API}/auth/register`, {
      data: { email, password: PASSWORD, language: "ru-RU", client: CLIENT },
    });
    expect(registered.status()).toBe(201);
    const registration = await registered.json();
    const signUpTokens: TokenPair = registration.tokens;
    expect(registration.user).toMatchObject({ email, emailVerified: false });
    expect(signUpTokens.tokenType).toBe("Bearer");
    // The welcome grant waits for the email to be verified.
    expect(registration.user.balance.total.amountMinor).toBe(0);

    const duplicate = await request.post(`${API}/auth/register`, {
      data: { email, password: PASSWORD, client: CLIENT },
    });
    expect(duplicate.status()).toBe(409);
    expect(await reasonOf(duplicate)).toBe("email_taken");

    // --- email verification ------------------------------------------------
    await sql`
      UPDATE "User"
      SET email_verification_code = ${sha256(VERIFICATION_CODE)},
          email_verification_code_expiry = now() + interval '30 minutes',
          email_verification_attempts = 0
      WHERE email = ${email}
    `;

    const wrongCode = await request.post(
      `${API}/auth/email-verification/verify`,
      { headers: bearer(signUpTokens), data: { code: "000000" } }
    );
    expect(wrongCode.status()).toBe(400);
    expect((await wrongCode.json()).data).toEqual({
      reason: "invalid_code",
      attemptsLeft: 4,
    });

    const verified = await request.post(
      `${API}/auth/email-verification/verify`,
      { headers: bearer(signUpTokens), data: { code: VERIFICATION_CODE } }
    );
    expect(verified.status()).toBe(200);
    expect(await verified.json()).toEqual({
      emailVerified: true,
      bonusGranted: true,
      welcomeGrantCredited: true,
    });

    // --- sign-in -----------------------------------------------------------
    const wrongPassword = await request.post(`${API}/auth/login`, {
      data: { email, password: "Wrong-Passw0rd!", client: CLIENT },
    });
    expect(wrongPassword.status()).toBe(401);
    expect(await reasonOf(wrongPassword)).toBe("invalid_credentials");

    const loggedIn = await request.post(`${API}/auth/login`, {
      data: { email, password: PASSWORD, client: CLIENT },
    });
    expect(loggedIn.status()).toBe(200);
    const login = await loggedIn.json();
    const loginTokens: TokenPair = login.tokens;
    expect(login.user).toMatchObject({ email, emailVerified: true });
    expect(login.user.balance.total.amountMinor).toBe(
      BALANCE_AFTER_VERIFICATION_MINOR
    );

    // --- who am I ----------------------------------------------------------
    const me = await request.get(`${API}/me`, { headers: bearer(loginTokens) });
    expect(me.status()).toBe(200);
    expect((await me.json()).email).toBe(email);

    const anonymous = await request.get(`${API}/me`);
    expect(anonymous.status()).toBe(401);

    const sessions = await request.get(`${API}/auth/sessions`, {
      headers: bearer(loginTokens),
    });
    const sessionItems: { isCurrent: boolean }[] = (await sessions.json())
      .items;
    // The sign-up session and the sign-in session.
    expect(sessionItems).toHaveLength(2);
    expect(sessionItems.filter((session) => session.isCurrent)).toHaveLength(1);

    // --- refresh -----------------------------------------------------------
    const refreshed = await request.post(`${API}/auth/refresh`, {
      data: { refreshToken: loginTokens.refreshToken },
    });
    expect(refreshed.status()).toBe(200);
    const refreshedTokens: TokenPair = (await refreshed.json()).tokens;
    expect(refreshedTokens.refreshToken).not.toBe(loginTokens.refreshToken);

    const meAfterRefresh = await request.get(`${API}/me`, {
      headers: bearer(refreshedTokens),
    });
    expect(meAfterRefresh.status()).toBe(200);

    // --- a copied refresh token --------------------------------------------
    // Pretend the first refresh happened more than 30 seconds ago, so that
    // presenting the same token again is no longer a retry.
    await sql`
      UPDATE "RefreshToken"
      SET used_at = used_at - interval '31 seconds'
      WHERE token_hash = ${sha256(loginTokens.refreshToken)}
    `;

    const reused = await request.post(`${API}/auth/refresh`, {
      data: { refreshToken: loginTokens.refreshToken },
    });
    expect(reused.status()).toBe(401);
    expect(await reasonOf(reused)).toBe("refresh_reused");

    // The whole session is gone, for the rightful holder too.
    const afterReuse = await request.post(`${API}/auth/refresh`, {
      data: { refreshToken: refreshedTokens.refreshToken },
    });
    expect(afterReuse.status()).toBe(401);
    expect(await reasonOf(afterReuse)).toBe("session_revoked");

    const meAfterReuse = await request.get(`${API}/me`, {
      headers: bearer(refreshedTokens),
    });
    expect(meAfterReuse.status()).toBe(401);

    // --- sign-out ----------------------------------------------------------
    // The sign-up session is another session and still alive.
    const stillSignedIn = await request.get(`${API}/me`, {
      headers: bearer(signUpTokens),
    });
    expect(stillSignedIn.status()).toBe(200);

    const loggedOut = await request.post(`${API}/auth/logout`, {
      headers: bearer(signUpTokens),
    });
    expect(loggedOut.status()).toBe(204);

    const meAfterLogout = await request.get(`${API}/me`, {
      headers: bearer(signUpTokens),
    });
    expect(meAfterLogout.status()).toBe(401);
    expect(await reasonOf(meAfterLogout)).toBe("invalid_token");
  });
});
