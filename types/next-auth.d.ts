import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import type { Locale } from "@/i18n/config";

export type UserType = "regular";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
      emailVerified: boolean;
      hasActiveSubscription: boolean;
      isTester: boolean;
      hasUsedTrial: boolean;
      preferredLanguage: Locale;
    } & DefaultSession["user"];
  }

  interface User extends Omit<DefaultUser, "emailVerified"> {
    id?: string;
    email?: string | null;
    type: UserType;
    emailVerified: boolean;
    hasActiveSubscription: boolean;
    isTester: boolean;
    hasUsedTrial: boolean;
    preferredLanguage: Locale;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
    emailVerified: boolean;
    hasActiveSubscription: boolean;
    isTester: boolean;
    hasUsedTrial: boolean;
    preferredLanguage: Locale;
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
