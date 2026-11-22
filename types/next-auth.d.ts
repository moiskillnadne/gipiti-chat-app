import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

export type UserType = "regular";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
      emailVerified: boolean;
      hasActiveSubscription: boolean;
      isTester: boolean;
    } & DefaultSession["user"];
  }

  interface User extends Omit<DefaultUser, "emailVerified"> {
    id?: string;
    email?: string | null;
    type: UserType;
    emailVerified: boolean;
    hasActiveSubscription: boolean;
    isTester: boolean;
    /** The account's token version as `authorize` read it. */
    tokenVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
    emailVerified: boolean;
    hasActiveSubscription: boolean;
    isTester: boolean;
    /**
     * The account's token version when the session was issued. Absent on
     * cookies older than the claim, which count as version 0.
     */
    ver?: number;
  }
}

declare module "@auth/core/adapters" {
  // biome-ignore lint/nursery/useConsistentTypeDefinitions: Required for module augmentation
  interface AdapterUser {
    id: string;
    email: string;
    emailVerified: boolean;
  }
}
