import { SessionProvider } from "next-auth/react";

// The top-up dialog and email verification read/update the session on the
// client. Scoped here rather than in the root layout — see app/(auth)/layout.tsx.
export default function SubscriptionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
