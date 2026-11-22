import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getActiveUserSubscription } from "@/lib/db/query/subscription/get-active-user-subscription";
import { getClientIp } from "@/server/http/client-ip";
import { authenticateCredentials } from "@/server/modules/auth/authenticate-credentials";
import { authConfig } from "@/server/modules/auth/next-auth.config";
import { getAuthSecret } from "@/server/modules/auth/secret";
import { RATE_LIMITED_SIGN_IN_CODE } from "@/server/modules/auth/sign-in-error-codes";
import {
  getTokenVersionForNewSession,
  isSessionVersionCurrent,
} from "@/server/modules/auth/token-version";
import { getUserByEmail } from "@/server/modules/users/queries/get-by-email";

type CredentialsType = {
  email: string;
  password: string;
};

/**
 * Thrown from `authorize` when the rate limiter refuses a login attempt. A
 * credentials error, so Auth.js treats it as an expected sign-in failure and
 * hands its `code` to the caller.
 */
class RateLimitedSignin extends CredentialsSignin {
  code = RATE_LIMITED_SIGN_IN_CODE;
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  secret: getAuthSecret(),
  logger: {
    error(code, ...message) {
      // Suppress CredentialsSignin errors — these are expected for wrong
      // passwords and for attempts the rate limiter refused.
      if (code instanceof CredentialsSignin) {
        return;
      }
      console.error(`[auth][error] ${code}`, ...message);
    },
    warn(code) {
      console.warn(`[auth][warn] ${code}`);
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "email", type: "email" },
        password: { label: "password", type: "password" },
      },
      async authorize(credentials, request) {
        const { email, password } = credentials as CredentialsType;
        // The limits live in `authenticateCredentials`, not in the `login`
        // action: the Auth.js endpoint `/api/auth/callback/credentials`
        // reaches this function without going through the action. `request`
        // is absent only when the function is called directly, as the tests
        // do.
        const result = await authenticateCredentials({
          email,
          password,
          ip: request?.headers ? getClientIp(request.headers) : null,
        });

        // The form shows one message for both: try again later.
        if (
          result.status === "rate_limited" ||
          result.status === "limiter_unavailable"
        ) {
          throw new RateLimitedSignin();
        }
        if (result.status === "invalid_credentials") {
          return null;
        }

        const userRecord = result.account;

        // Check if user has active subscription
        const subscription = await getActiveUserSubscription({
          userId: userRecord.id,
        });

        return {
          id: userRecord.id,
          email: userRecord.email,
          type: "regular",
          emailVerified: userRecord.emailVerified,
          hasActiveSubscription: subscription !== null,
          isTester: userRecord.isTester,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id as string;
        token.type = user.type;
        token.emailVerified = (user.emailVerified ?? false) as boolean;
        token.hasActiveSubscription = (user.hasActiveSubscription ??
          false) as boolean;
        token.isTester = (user.isTester ?? false) as boolean;
        // The session records the token version it is issued under, read
        // from the database: the cached number may be behind it.
        token.ver = (await getTokenVersionForNewSession(token.id)) ?? 0;
      } else if (!(await isSessionVersionCurrent(token))) {
        // The account's token version moved on since this session was issued
        // (a password reset, "log out everywhere"), or the account is gone.
        // Null ends the session: `auth()` then answers no session, and
        // `GET /api/auth/session` also deletes the cookie. Pages reached
        // through `proxy.ts` get the cookie deleted there.
        return null;
      }

      // On `useSession().update()` the claims are re-read from the database.
      // Nothing is taken from the `session` argument: it is the request body
      // of `POST /api/auth/session`, so the client controls it.
      if (trigger === "update") {
        if (token.id) {
          const subscription = await getActiveUserSubscription({
            userId: token.id,
          });
          token.hasActiveSubscription = subscription !== null;
        }

        if (token.email) {
          const userRecord = await getUserByEmail(token.email);

          if (userRecord) {
            token.emailVerified = userRecord.emailVerified as boolean;
            token.isTester = userRecord.isTester as boolean;
          }
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type;
        // @ts-expect-error - emailVerified is boolean in our schema, not Date
        session.user.emailVerified = token.emailVerified;
        session.user.hasActiveSubscription = token.hasActiveSubscription;
        session.user.isTester = token.isTester;
      }

      return session;
    },
  },
});
