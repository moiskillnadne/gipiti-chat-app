import Link from "next/link";

import type { ModelLanding } from "@/lib/marketing/model-landings";

import { accentClasses } from "./accent-styles";

export const ModelLandingCta = ({ landing }: { landing: ModelLanding }) => {
  const accent = accentClasses[landing.accent];

  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <div
          className={`relative overflow-hidden rounded-3xl border px-6 pt-16 pb-14 text-center sm:px-12 ${accent.ctaBorder}`}
        >
          <div
            aria-hidden="true"
            className={`-inset-[40%] pointer-events-none absolute ${accent.ctaGlow}`}
          />
          <div className="relative">
            <h2 className="mb-3 font-bold text-3xl text-white tracking-tight md:text-4xl">
              Попробуйте {landing.name} бесплатно
            </h2>
            <p className="mx-auto mb-7 max-w-lg text-lg text-zinc-400 leading-relaxed">
              Дарим 200 ₽ каждому новому пользователю — хватит на первые
              вопросы. Карта не нужна.
            </p>
            <Link
              className={`inline-flex items-center justify-center rounded-full px-8 py-4 font-semibold text-lg text-white shadow-lg transition-shadow hover:shadow-xl ${accent.primaryButton}`}
              href="/register"
            >
              Начать бесплатно
            </Link>
            <p className="mt-5 text-sm text-zinc-500">
              Без VPN · Оплата в рублях · Отмена в любой момент
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
