import { compare } from "bcrypt-ts";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getAuthSecret } from "@/lib/auth/secret";
import { DUMMY_PASSWORD } from "@/lib/constants";
import { getActiveUserSubscription } from "@/lib/db/query/subscription/get-active-user-subscription";
import { getUserByEmail } from "../../lib/db/query/user/get-by-email";
import { authConfig } from "./auth.config";

export type { UserType } from "@/types/next-auth";

type CredentialsType = {
  email: string;
  password: string;
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
      // Suppress CredentialsSignin errors — these are expected for wrong passwords
      if (code instanceof Error && code.name === "CredentialsSignin") {
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
      async authorize(credentials) {
        const { email, password } = credentials as CredentialsType;
        const userRecord = await getUserByEmail(email);

        if (!userRecord) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        if (!userRecord.password) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const passwordsMatch = await compare(password, userRecord.password);

        if (!passwordsMatch) {
          return null;
        }

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
