"use client";

import { motion } from "framer-motion";
import { CheckIcon } from "lucide-react";
import Link from "next/link";

import { FadeIn } from "./fade-in";

const pricingFeatures = [
  "Доступ ко всем AI-моделям",
  "ChatGPT 5.2, Gemini 3 Pro",
  "Claude Opus 4.6, Grok 4.1",
  "Генерация изображений",
  "Анализ документов до 10MB",
  "Поиск в интернете",
  "Режим рассуждений",
  "3M токенов в месяц",
];

export const PricingSection = () => (
  <section className="px-4 py-20" id="pricing">
    <FadeIn>
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-4 text-center font-bold text-3xl text-white md:text-4xl">
          Простой и понятный тариф
        </h2>
        <p className="mx-auto mb-12 max-w-xl text-center text-zinc-400">
          Все AI-модели и функции в одной подписке. 3 дня бесплатного пробного
          периода.
        </p>

        {/* Animated gradient border */}
        <div className="relative animate-gradient-border rounded-3xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-px">
          <div className="rounded-3xl bg-zinc-950 p-8 md:p-12">
            <div className="text-center">
              {/* Savings comparison */}
              <div className="mb-6">
                <p className="mb-1 text-sm text-zinc-500">
                  <span className="line-through">
                    5 отдельных подписок ~ 15,000 ₽/мес
                  </span>
                </p>
                <p className="text-emerald-400 text-sm">
                  Вы экономите более 13,000 ₽ ежемесячно
                </p>
              </div>

              {/* Price */}
              <div className="mb-2">
                <span className="font-bold text-5xl text-white md:text-6xl">
                  1 999
                </span>
                <span className="text-xl text-zinc-400"> ₽/месяц</span>
              </div>
              <p className="mb-8 text-sm text-zinc-500">3M токенов в месяц</p>

              {/* Feature checklist */}
              <div className="mx-auto mb-10 grid max-w-lg gap-3 text-left sm:grid-cols-2">
                {pricingFeatures.map((feature) => (
                  <div className="flex items-center gap-2" key={feature}>
                    <CheckIcon className="size-4 shrink-0 text-emerald-400" />
                    <span className="text-sm text-zinc-300">{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <motion.div
                transition={{ type: "spring", stiffness: 300 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  className="inline-flex w-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-4 font-semibold text-lg text-white shadow-indigo-500/25 shadow-lg transition-all hover:shadow-2xl hover:shadow-indigo-500/30 sm:w-auto"
                  href="/register"
                >
                  Начать 3-ех дневный пробный период
                </Link>
              </motion.div>

              <p className="mt-4 text-xs text-zinc-600">
                Отмена подписки в любой момент. Без скрытых платежей.
              </p>
            </div>
          </div>
        </div>
      </div>
    </FadeIn>
  </section>
);
