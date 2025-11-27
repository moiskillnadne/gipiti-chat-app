import { compare } from "bcrypt-ts";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getAuthSecret } from "@/lib/auth/secret";
import { DUMMY_PASSWORD } from "@/lib/constants";
import { getActiveUserSubscription, getUser } from "@/lib/db/queries";
import { authConfig } from "./auth.config";

export type { UserType } from "@/types/next-auth";

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  secret: getAuthSecret(),
  providers: [
    Credentials({
      credentials: {},
      async authorize({ email, password }: any) {
        const users = await getUser(email);

        if (users.length === 0) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const [user] = users;

        if (!user.password) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const passwordsMatch = await compare(password, user.password);

        if (!passwordsMatch) {
          return null;
        }

        // Check if user has active subscription
        const subscription = await getActiveUserSubscription({
          userId: user.id,
        });

        return {
          ...user,
          type: "regular",
          emailVerified: user.emailVerified,
          hasActiveSubscription: subscription !== null,
          isTester: user.isTester,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.type = user.type;
        token.emailVerified = (user.emailVerified ?? false) as boolean;
        token.hasActiveSubscription = (user.hasActiveSubscription ??
          false) as boolean;
        token.isTester = (user.isTester ?? false) as boolean;
      }

      // Refresh from database on session update
      if (trigger === "update") {
        if (token.id) {
          // Check subscription status from database
          const subscription = await getActiveUserSubscription({
            userId: token.id,
          });
          token.hasActiveSubscription = subscription !== null;
        }

        if (token.email) {
          const [dbUser] = await getUser(token.email);
          if (dbUser) {
            token.emailVerified = dbUser.emailVerified as boolean;
            token.isTester = dbUser.isTester as boolean;
          }
        }

        // Also allow updating directly from session data
        if (session?.emailVerified !== undefined) {
          token.emailVerified = session.emailVerified as boolean;
        }
        if (session?.hasActiveSubscription !== undefined) {
          token.hasActiveSubscription =
            session.hasActiveSubscription as boolean;
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
