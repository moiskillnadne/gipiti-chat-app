import Link from "next/link";

import { catalogModels } from "@/lib/marketing/models-catalog";

/**
 * Rounded down to the nearest ten so the badge stays truthful between
 * releases — it is derived from the catalog rather than hardcoded, which is
 * how it drifted to "18+" while the catalog grew past forty.
 */
const MODEL_COUNT_FLOOR = Math.floor(catalogModels.length / 10) * 10;

export const ModelsHero = () => (
  <section className="px-4 pt-6">
    <div className="mx-auto max-w-6xl">
      <nav
        aria-label="Хлебные крошки"
        className="flex items-center gap-2.5 text-sm text-zinc-500"
      >
        <Link
          className="text-zinc-400 transition-colors hover:text-white"
          href="/"
        >
          Главная
        </Link>
        <span>/</span>
        <b className="font-medium text-zinc-200">Модели</b>
      </nav>

      <div className="pt-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/35 bg-indigo-500/10 px-4 py-2 text-indigo-300 text-sm">
          ✦ {MODEL_COUNT_FLOOR}+ моделей в одной подписке
        </div>
        <h1 className="mt-5 mb-5 max-w-3xl font-bold text-4xl text-white leading-[1.14] tracking-tight md:text-5xl lg:text-[54px]">
          <span>Все нейросети —</span>
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            в одном чате на русском
          </span>
        </h1>
        <p className="mb-8 max-w-2xl text-lg text-zinc-400 leading-relaxed">
          GPT, Claude, Gemini, Grok и модели генерации изображений и видео — без
          VPN, с оплатой российскими картами. Переключайтесь между моделями в
          один клик.
        </p>
        <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center">
          <Link
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-4 font-semibold text-lg text-white shadow-indigo-500/30 shadow-lg transition-shadow hover:shadow-indigo-500/40 hover:shadow-xl"
            href="/register"
          >
            Попробовать бесплатно
          </Link>
          <Link
            className="inline-flex items-center justify-center rounded-full border border-zinc-700 px-7 py-4 font-medium text-base text-zinc-200 transition-colors hover:border-zinc-500"
            href="/#pricing"
          >
            Смотреть тарифы
          </Link>
        </div>
      </div>
    </div>
  </section>
);
