import { compare } from "bcrypt-ts";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getAuthSecret } from "@/lib/auth/secret";
import { RATE_LIMITED_SIGN_IN_CODE } from "@/lib/auth/sign-in-error-codes";
import { DUMMY_PASSWORD } from "@/lib/constants";
import { getActiveUserSubscription } from "@/lib/db/query/subscription/get-active-user-subscription";
import { getClientIp } from "@/lib/http/client-ip";
import {
  beginLoginAttempt,
  recordFailedLogin,
  recordSuccessfulLogin,
} from "@/lib/rate-limit";
import type { User } from "@/server/db/schema";
import { getUserByEmail } from "../../lib/db/query/user/get-by-email";
import { authConfig } from "./auth.config";

export type { UserType } from "@/types/next-auth";

type CredentialsType = {
  email: string;
  password: string;
};

/** How long an attempt on an account under a guessing attack is held back. */
const THROTTLED_LOGIN_DELAY_MS = 2000;

/**
 * Thrown from `authorize` when the rate limiter refuses a login attempt. A
 * credentials error, so Auth.js treats it as an expected sign-in failure and
 * hands its `code` to the caller.
 */
class RateLimitedSignin extends CredentialsSignin {
  code = RATE_LIMITED_SIGN_IN_CODE;
}

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

/**
 * The account these credentials open, or null. An unknown email and an
 * account without a password still cost one bcrypt comparison, so the answer
 * takes as long as a wrong password and does not reveal which emails exist.
 */
const findUserByCredentials = async ({
  email,
  password,
}: CredentialsType): Promise<User | null> => {
  const userRecord = await getUserByEmail(email);

  if (!userRecord?.password) {
    await compare(password, DUMMY_PASSWORD);
    return null;
  }

  const passwordsMatch = await compare(password, userRecord.password);

  return passwordsMatch ? userRecord : null;
};

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
        // The limits live here, not in the `login` action: the Auth.js
        // endpoint `/api/auth/callback/credentials` reaches this function
        // without going through the action. `request` is absent only when
        // the function is called directly, as the tests do.
        const identity = {
          email,
          ip: request?.headers ? getClientIp(request.headers) : null,
        };

        const attempt = await beginLoginAttempt(identity);
        if (!attempt.isAllowed) {
          throw new RateLimitedSignin();
        }
        if (attempt.shouldDelay) {
          await wait(THROTTLED_LOGIN_DELAY_MS);
        }

        const userRecord = await findUserByCredentials({ email, password });

        if (!userRecord) {
          await recordFailedLogin(identity);
          return null;
        }

        await recordSuccessfulLogin(identity);

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
