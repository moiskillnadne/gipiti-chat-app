import { compare } from "bcrypt-ts";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getAuthSecret } from "@/lib/auth/secret";
import { DUMMY_PASSWORD } from "@/lib/constants";
import { getActiveUserSubscription } from "@/lib/db/queries";
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
  providers: [
    Credentials({
      credentials: {
        email: { label: "email", type: "email" },
        password: { label: "password", type: "password" },
      },
      async authorize(credentials) {
        const { email, password } = credentials as CredentialsType;
        const users = await getUserByEmail(email);

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
          hasUsedTrial: user.trialUsedAt !== null,
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
        token.hasUsedTrial = (user.hasUsedTrial ?? false) as boolean;
      }

      // Refresh from database on session update
      if (trigger === "update") {
        console.log(
          "JWT callback triggered with update, session data:",
          session
        );

        if (token.id) {
          // Check subscription status from database
          const subscription = await getActiveUserSubscription({
            userId: token.id,
          });
          token.hasActiveSubscription = subscription !== null;
        }

        if (token.email) {
          const [dbUser] = await getUserByEmail(token.email);
          if (dbUser) {
            console.log("DB user emailVerified:", dbUser.emailVerified);
            token.emailVerified = dbUser.emailVerified as boolean;
            token.isTester = dbUser.isTester as boolean;
            token.hasUsedTrial = dbUser.trialUsedAt !== null;
          }
        }

        // Also allow updating directly from session data
        if (session?.emailVerified !== undefined) {
          console.log(
            "Updating token.emailVerified from session:",
            session.emailVerified
          );
          token.emailVerified = session.emailVerified as boolean;
        }
        if (session?.hasActiveSubscription !== undefined) {
          token.hasActiveSubscription =
            session.hasActiveSubscription as boolean;
        }

        console.log("Final token.emailVerified:", token.emailVerified);
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
        session.user.hasUsedTrial = token.hasUsedTrial;
        console.log("Session callback - emailVerified:", token.emailVerified);
      }

      return session;
    },
  },
});
