import type { Metadata } from "next";

import { ResetPasswordPageClient } from "./reset-password-page-client";

export const metadata: Metadata = {
  title: "Новый пароль",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

/**
 * Reads the reset token from the link on the server and hands it to the
 * client page, so the client page needs neither `useSearchParams()` nor the
 * `<Suspense>` boundary that hook requires.
 */
export default async function Page({ searchParams }: PageProps) {
  const { token } = await searchParams;

  return (
    <ResetPasswordPageClient token={typeof token === "string" ? token : ""} />
  );
}
