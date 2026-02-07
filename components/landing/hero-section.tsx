"use client";

import { motion } from "framer-motion";
import { SparklesIcon } from "lucide-react";

import { ChatMockup } from "./chat-mockup";
import { FadeIn } from "./fade-in";

const providerColors = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-orange-500",
  "bg-violet-500",
];

export const HeroSection = () => (
  <section className="relative overflow-hidden px-4 pt-32 pb-20">
    {/* Background layers */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />
    <motion.div
      animate={{
        x: [0, 30, -20, 0],
        y: [0, -20, 30, 0],
        scale: [1, 1.1, 0.95, 1],
      }}
      className="-translate-x-1/2 absolute top-1/4 left-1/2 size-[600px] rounded-full bg-indigo-500/5 blur-3xl"
      transition={{
        duration: 20,
        repeat: Number.POSITIVE_INFINITY,
        ease: "linear",
      }}
    />

    <div className="relative mx-auto max-w-5xl text-center">
      {/* Animated badge */}
      <FadeIn delay={0.1}>
        <div className="mb-6 inline-flex animate-shimmer items-center gap-2 rounded-full border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 px-4 py-2 text-indigo-300 text-sm">
          <SparklesIcon className="size-4" />
          <span>Все лучшие AI-модели в одном месте</span>
        </div>
      </FadeIn>

      {/* Headline */}
      <FadeIn delay={0.2}>
        <h1 className="mb-6 font-bold text-5xl leading-tight md:text-7xl">
          <span className="text-white">Все лучшие AI-модели</span>
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            в одном месте
          </span>
        </h1>
      </FadeIn>

      {/* Subtitle */}
      <FadeIn delay={0.3}>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-zinc-400 md:text-xl">
          GIPITI — единая платформа для общения с передовыми AI-моделями.
          Генерируйте текст, изображения, анализируйте документы.
        </p>
      </FadeIn>

      {/* Dual CTAs */}
      <FadeIn delay={0.4}>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            className="inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-4 font-semibold text-lg text-white shadow-indigo-500/25 shadow-lg transition-all hover:shadow-indigo-500/30 hover:shadow-xl sm:w-auto"
            href="#pricing"
          >
            Попробовать бесплатно
          </a>
          <a
            className="inline-flex w-full items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/50 px-8 py-4 font-semibold text-lg text-zinc-300 transition-all hover:border-zinc-600 hover:bg-zinc-800/50 sm:w-auto"
            href="#pricing"
          >
            Посмотреть тарифы
          </a>
        </div>
      </FadeIn>

      {/* Social proof */}
      <FadeIn delay={0.5}>
        <div className="mt-10 flex items-center justify-center gap-3">
          <div className="-space-x-2 flex">
            {providerColors.map((color) => (
              <div
                className={`size-8 rounded-full border-2 border-zinc-950 ${color}`}
                key={color}
              />
            ))}
          </div>
          <span className="text-sm text-zinc-500">
            Более 500 пользователей уже используют GIPITI
          </span>
        </div>
      </FadeIn>

      {/* Chat mockup */}
      <div className="mt-16">
        <ChatMockup />
      </div>
    </div>
  </section>
);
