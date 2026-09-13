import { SessionProvider } from "next-auth/react";

// Login/register/manage-subscription read the session on the client. Keeping
// the provider here (not in the root layout) spares public pages the
// `/api/auth/session` round-trips it fires on every mount.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SessionProvider>{children}</SessionProvider>;
}
