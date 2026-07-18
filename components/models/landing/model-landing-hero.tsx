import Link from "next/link";

import type { ModelLanding } from "@/lib/marketing/model-landings";

import { accentClasses } from "./accent-styles";
import { ModelLandingChatMockup } from "./model-landing-chat-mockup";

/** oklch hues for the social-proof avatar stack (design: nb-avatars). */
const PROOF_AVATAR_HUES = [275, 315, 235, 45];

export const ModelLandingHero = ({ landing }: { landing: ModelLanding }) => {
  const accent = accentClasses[landing.accent];

  return (
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
          <Link
            className="text-zinc-400 transition-colors hover:text-white"
            href="/models"
          >
            Модели
          </Link>
          <span>/</span>
          <b className="font-medium text-zinc-200">{landing.name}</b>
        </nav>

        <div className="grid items-center gap-10 pt-12 pb-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div>
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${accent.badge}`}
            >
              ✦ {landing.badge}
            </div>
            <h1 className="mt-5 mb-5 font-bold text-4xl text-white leading-[1.14] tracking-tight md:text-5xl lg:text-[54px]">
              <span>{landing.h1Top}</span>
              <br />
              <span
                className={`bg-clip-text text-transparent ${accent.gradientText}`}
              >
                {landing.h1Gradient}
              </span>
            </h1>
            <p className="mb-8 text-lg text-zinc-400 leading-relaxed">
              {landing.sub}
            </p>
            <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center">
              <Link
                className={`inline-flex items-center justify-center rounded-full px-8 py-4 font-semibold text-lg text-white shadow-lg transition-shadow hover:shadow-xl ${accent.primaryButton}`}
                href="/register"
              >
                {landing.ctaMain}
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-full border border-zinc-700 px-7 py-4 font-medium text-base text-zinc-200 transition-colors hover:border-zinc-500"
                href="/#pricing"
              >
                Смотреть тарифы
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-3">
              <div aria-hidden="true" className="flex">
                {PROOF_AVATAR_HUES.map((hue) => (
                  <span
                    className="-ml-2 size-7 rounded-full border-2 border-zinc-950 first:ml-0"
                    key={hue}
                    style={{ background: `oklch(0.5 0.12 ${hue})` }}
                  />
                ))}
              </div>
              <span className="text-[13px] text-zinc-500">
                Более 500 пользователей уже используют GIPITI
              </span>
            </div>
          </div>

          <ModelLandingChatMockup landing={landing} />
        </div>
      </div>
    </section>
  );
};
