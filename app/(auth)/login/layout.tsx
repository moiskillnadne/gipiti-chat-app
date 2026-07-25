import type { Metadata } from "next";
import { canonicalUrl } from "@/lib/seo/site";

export const metadata: Metadata = {
  title: "Вход",
  description:
    "Войдите в свой аккаунт GIPITI для доступа к AI-чату с ChatGPT, Gemini, Claude и Grok",
  robots: { index: true, follow: true },
  // Every auth redirect appends a `callbackUrl`, and each variant serves
  // identical content. Pin the canonical so they collapse into the one indexed
  // login page instead of competing as duplicates.
  alternates: { canonical: canonicalUrl("/login") },
  openGraph: {
    title: "Вход в GIPITI",
    description: "Войдите в свой аккаунт GIPITI для доступа к AI-чату",
    type: "website",
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
