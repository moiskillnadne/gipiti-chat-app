import {
  BrainIcon,
  FileTextIcon,
  ImageIcon,
  MessageSquareIcon,
  SearchIcon,
  SparklesIcon,
  ZapIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";

export const metadata: Metadata = {
  title: "GIPITI - AI-чат с ChatGPT, Gemini, Claude и Grok",
  description:
    "GIPITI — платформа с доступом к лучшим AI-моделям: ChatGPT 5.2, Gemini 3 Pro, Claude Opus 4.6 и Grok 4.1. Генерация текста, изображений, анализ документов.",
  alternates: {
    canonical: "https://gipiti.ru",
  },
};

const models = [
  {
    name: "ChatGPT 5.2",
    provider: "OpenAI",
    color: "from-emerald-500 to-teal-600",
  },
  {
    name: "Gemini 3 Pro",
    provider: "Google",
    color: "from-blue-500 to-indigo-600",
  },
  {
    name: "Claude Opus 4.6",
    provider: "Anthropic",
    color: "from-orange-500 to-amber-600",
  },
  { name: "Grok 4.1", provider: "xAI", color: "from-violet-500 to-purple-600" },
];

const features = [
  {
    icon: MessageSquareIcon,
    title: "Умный чат",
    description: "Общайтесь с лучшими AI-моделями в одном месте",
  },
  {
    icon: ImageIcon,
    title: "Генерация изображений",
    description: "Создавайте изображения с GPT Image 1.5 и Gemini 3 Pro Image",
  },
  {
    icon: FileTextIcon,
    title: "Анализ документов",
    description: "Загружайте PDF, изображения и текстовые файлы до 10MB",
  },
  {
    icon: SearchIcon,
    title: "Поиск в интернете",
    description: "AI получает актуальную информацию из сети",
  },
  {
    icon: BrainIcon,
    title: "Режим рассуждений",
    description: "Расширенный анализ для сложных задач",
  },
  {
    icon: ZapIcon,
    title: "Быстрые ответы",
    description: "Мгновенные ответы от ведущих AI-моделей",
  },
];

const plans = [
  { name: "Старт", price: "1 999", period: "месяц", tokens: "1M токенов" },
  {
    name: "Оптимальный",
    price: "4 999",
    period: "квартал",
    tokens: "3M токенов",
    badge: "Экономия 17%",
  },
  {
    name: "Лучший",
    price: "14 999",
    period: "год",
    tokens: "12M токенов",
    badge: "Экономия 37%",
  },
];

export default function LandingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "GIPITI",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: "AI-чат платформа с доступом к ChatGPT, Gemini, Claude и Grok",
    url: "https://gipiti.ru",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "1999",
      highPrice: "14999",
      priceCurrency: "RUB",
      offerCount: "3",
    },
    featureList: [
      "Доступ к ChatGPT 5.2",
      "Доступ к Gemini 3 Pro",
      "Доступ к Claude Opus 4.6",
      "Доступ к Grok 4.1",
      "Генерация изображений",
      "Анализ документов",
      "Поиск в интернете",
    ],
  };

  return (
    <>
      <Script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: <It's fine here for SEO>
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        id="json-ld"
        type="application/ld+json"
      />

      <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950">
        {/* Navigation */}
        <header className="fixed top-0 z-50 w-full border-zinc-800 border-b bg-zinc-950/80 backdrop-blur-md">
          <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
            <Link className="font-bold text-2xl text-white" href="/">
              GIPITI
            </Link>
            <div className="flex items-center gap-4">
              <Link
                className="text-zinc-400 transition-colors hover:text-white"
                href="/login"
              >
                Войти
              </Link>
              <Link
                className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-2 font-medium text-white transition-all hover:opacity-90"
                href="/register"
              >
                Начать бесплатно
              </Link>
            </div>
          </nav>
        </header>

        {/* Hero Section */}
        <section className="relative overflow-hidden px-4 pt-32 pb-20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />
          <div className="relative mx-auto max-w-5xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-indigo-300 text-sm">
              <SparklesIcon className="size-4" />
              <span>Все лучшие AI-модели в одном месте</span>
            </div>

            <h1 className="mb-6 bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text font-bold text-5xl text-transparent leading-tight md:text-7xl">
              AI-чат с ChatGPT,
              <br />
              Gemini, Claude и Grok
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg text-zinc-400 md:text-xl">
              GIPITI — единая платформа для общения с передовыми AI-моделями.
              Генерируйте текст, изображения, анализируйте документы.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                className="w-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-4 font-semibold text-lg text-white transition-all hover:opacity-90 sm:w-auto"
                href="/register"
              >
                Попробовать бесплатно
              </Link>
              <Link
                className="w-full rounded-full border border-zinc-700 bg-zinc-900 px-8 py-4 font-semibold text-lg text-zinc-300 transition-all hover:bg-zinc-800 sm:w-auto"
                href="#pricing"
              >
                Посмотреть тарифы
              </Link>
            </div>
          </div>
        </section>

        {/* Models Section */}
        <section className="px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-4 text-center font-bold text-3xl text-white md:text-4xl">
              Доступные AI-модели
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-zinc-400">
              Используйте самые мощные языковые модели от ведущих разработчиков
            </p>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {models.map((model) => (
                <div
                  className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-zinc-700"
                  key={model.name}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${model.color} opacity-0 transition-opacity group-hover:opacity-5`}
                  />
                  <div
                    className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${model.color} p-3`}
                  >
                    <BrainIcon className="size-6 text-white" />
                  </div>
                  <h3 className="mb-1 font-semibold text-lg text-white">
                    {model.name}
                  </h3>
                  <p className="text-sm text-zinc-500">{model.provider}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-4 text-center font-bold text-3xl text-white md:text-4xl">
              Возможности платформы
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-zinc-400">
              Всё необходимое для продуктивной работы с искусственным
              интеллектом
            </p>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-zinc-700"
                  key={feature.title}
                >
                  <div className="mb-4 inline-flex rounded-xl bg-zinc-800 p-3">
                    <feature.icon className="size-6 text-indigo-400" />
                  </div>
                  <h3 className="mb-2 font-semibold text-lg text-white">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-zinc-400">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className="px-4 py-20" id="pricing">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-4 text-center font-bold text-3xl text-white md:text-4xl">
              Простые и понятные тарифы
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-zinc-400">
              Выберите план, который подходит именно вам. 3 дня бесплатного
              пробного периода для всех тарифов.
            </p>

            <div className="grid gap-6 md:grid-cols-3">
              {plans.map((plan, index) => (
                <div
                  className={`relative rounded-2xl border p-6 transition-all ${
                    index === 1
                      ? "border-indigo-500/50 bg-gradient-to-b from-indigo-500/10 to-transparent"
                      : "border-zinc-800 bg-zinc-900/50"
                  }`}
                  key={plan.name}
                >
                  {plan.badge ? (
                    <div className="-top-3 absolute right-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-3 py-1 text-white text-xs">
                      {plan.badge}
                    </div>
                  ) : null}
                  <h3 className="mb-2 font-semibold text-lg text-white">
                    {plan.name}
                  </h3>
                  <div className="mb-4">
                    <span className="font-bold text-4xl text-white">
                      {plan.price}
                    </span>
                    <span className="text-zinc-400"> ₽/{plan.period}</span>
                  </div>
                  <p className="mb-6 text-sm text-zinc-400">{plan.tokens}</p>
                  <Link
                    className={`block w-full rounded-full py-3 text-center font-medium transition-all ${
                      index === 1
                        ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:opacity-90"
                        : "border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    }`}
                    href="/subscribe"
                  >
                    Выбрать план
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-4 py-20">
          <div className="mx-auto max-w-4xl rounded-3xl border border-zinc-800 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-12 text-center">
            <h2 className="mb-4 font-bold text-3xl text-white md:text-4xl">
              Готовы начать?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-zinc-400">
              Присоединяйтесь к тысячам пользователей, которые уже используют
              GIPITI для работы с AI
            </p>
            <Link
              className="inline-flex rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-4 font-semibold text-lg text-white transition-all hover:opacity-90"
              href="/register"
            >
              Начать бесплатно
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-zinc-800 border-t px-4 py-12">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
              <div className="font-bold text-white text-xl">GIPITI</div>
              <nav className="flex flex-wrap items-center justify-center gap-6">
                <Link
                  className="text-sm text-zinc-400 hover:text-white"
                  href="/legal/offer"
                >
                  Оферта
                </Link>
                <Link
                  className="text-sm text-zinc-400 hover:text-white"
                  href="/legal/privacy"
                >
                  Политика конфиденциальности
                </Link>
                <Link
                  className="text-sm text-zinc-400 hover:text-white"
                  href="/legal/support"
                >
                  Поддержка
                </Link>
              </nav>
            </div>
            <div className="mt-8 text-center text-sm text-zinc-500">
              © {new Date().getFullYear()} GIPITI. Все права защищены.
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
