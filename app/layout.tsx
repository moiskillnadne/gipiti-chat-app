import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Geist_Mono, Rubik } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "sonner";
import { ErrorLogger } from "@/components/error-logger";
import { ThemeProvider } from "@/components/theme-provider";
import { YandexMetrika } from "@/components/yandex-metrika";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  metadataBase: new URL("https://gipiti.ru"),
  title: {
    default: "GIPITI - AI-чат с ChatGPT, Gemini, Claude и Grok",
    template: "%s | GIPITI",
  },
  description:
    "GIPITI — платформа с доступом к лучшим AI-моделям: ChatGPT 5.2, Gemini 3 Pro, Claude Opus 4.5 и Grok 4.1. Генерация текста, изображений, анализ документов.",
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
    title: "GIPITI - AI-чат с ChatGPT, Gemini, Claude и Grok",
    description: "Доступ к лучшим AI-моделям в одном месте",
  },
  twitter: {
    card: "summary_large_image",
    title: "GIPITI - AI-чат с ChatGPT, Gemini, Claude и Grok",
    description: "Доступ к лучшим AI-моделям в одном месте",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  maximumScale: 1,
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

const LIGHT_THEME_COLOR = "hsl(0 0% 100%)";
const DARK_THEME_COLOR = "hsl(240deg 10% 3.92%)";
const THEME_COLOR_SCRIPT = `\
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    var isDark = html.classList.contains('dark');
    meta.setAttribute('content', isDark ? '${DARK_THEME_COLOR}' : '${LIGHT_THEME_COLOR}');
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeColor();
})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      className={`${rubik.variable} ${geistMono.variable}`}
      lang={locale}
      suppressHydrationWarning
    >
      <head>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: <This is a script>
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
        <script src="https://widget.cloudpayments.ru/bundles/cloudpayments.js" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ErrorLogger />
        <SpeedInsights />
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            disableTransitionOnChange
            enableSystem
          >
            <Toaster position="top-center" />
            <SessionProvider>{children}</SessionProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
        <Analytics />
        <YandexMetrika />
      </body>
    </html>
  );
}
