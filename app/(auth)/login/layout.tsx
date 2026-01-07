import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Вход",
  description:
    "Войдите в свой аккаунт GIPITI для доступа к AI-чату с ChatGPT, Gemini, Claude и Grok",
  robots: { index: true, follow: true },
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

