import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Geist_Mono, Rubik } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "sonner";
import { ErrorLogger } from "@/components/error-logger";
import { UtmCapture } from "@/components/utm-capture";
import { YandexMetrika } from "@/components/yandex-metrika";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  metadataBase: new URL("https://gipiti.ru"),
  title: {
    default: "GIPITI - Агрегатор нейросетей. ChatGPT, Gemini, Claude и Grok.",
    template: "%s | GIPITI",
  },
  description:
    "GIPITI — платформа с доступом к лучшим AI-моделям: ChatGPT 5.2, Gemini 3.1 Pro, Claude Opus 4.6 и Grok 4.1. Генерация текста, изображений, видео, кода, анализ документов.",
  keywords: [
    "AI чат",
    "ChatGPT",
    "Gemini",
    "Claude",
    "Grok",
    "нейросеть",
    "искусственный интеллект",
    "генерация текста",
    "генерация изображений",
    "генерация видео",
    "генерация кода",
    "анализ документов",
  ],
  authors: [{ name: "GIPITI" }],
  creator: "GIPITI",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "https://gipiti.ru",
    siteName: "GIPITI",
    title: "GIPITI - Агрегатор нейросетей. ChatGPT, Gemini, Claude и Grok",
    description:
      "GIPITI — платформа с доступом к лучшим AI-моделям: ChatGPT 5.2, Gemini 3.1 Pro, Claude Opus 4.6 и Grok 4.1. Генерация текста, изображений, видео, кода, анализ документов.",
  },
  twitter: {
    card: "summary_large_image",
    title: "GIPITI - Агрегатор нейросетей. ChatGPT, Gemini, Claude и Grok",
    description: "Доступ к лучшим AI-моделям в одном месте",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  maximumScale: 1,
  viewportFit: "cover",
};

const rubik = Rubik({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-rubik",
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

const PAPER_THEME_COLOR = "#fafaf9";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      className={`${rubik.variable} ${geistMono.variable} scroll-smooth`}
      lang={locale}
      suppressHydrationWarning
    >
      <head>
        <meta content={PAPER_THEME_COLOR} name="theme-color" />
        <script src="https://widget.cloudpayments.ru/bundles/cloudpayments.js" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ErrorLogger />
        <UtmCapture />
        <SpeedInsights />
        <NextIntlClientProvider messages={messages}>
          <Toaster position="top-center" />
          <SessionProvider>{children}</SessionProvider>
        </NextIntlClientProvider>
        <Analytics />
        <YandexMetrika />
      </body>
    </html>
  );
}
