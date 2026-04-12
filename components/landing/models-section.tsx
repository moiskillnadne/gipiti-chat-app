"use client";

import { motion } from "framer-motion";
import type { ElementType } from "react";

import {
  LogoAnthropic,
  LogoBFL,
  LogoGoogle,
  LogoOpenAI,
  LogoRecraft,
  LogoXai,
} from "@/components/icons";

import { FadeIn, staggerContainer, staggerItem } from "./fade-in";

type ProviderModel = {
  name: string;
  badges: string[];
};

type ProviderCard = {
  provider: string;
  Logo: ElementType;
  color: string;
  hoverBorder: string;
  hoverShadow: string;
  gradientBg: string;
  models: ProviderModel[];
};

const providers: ProviderCard[] = [
  {
    provider: "OpenAI",
    Logo: LogoOpenAI,
    color: "from-emerald-500 to-teal-600",
    hoverBorder: "group-hover:border-emerald-500/30",
    hoverShadow: "group-hover:shadow-emerald-500/10",
    gradientBg: "group-hover:opacity-5",
    models: [
      { name: "GPT 5.2", badges: ["Рассуждения", "Вложения"] },
      { name: "GPT 5.4 Mini", badges: ["Рассуждения", "Вложения"] },
      { name: "GPT Codex 5.2", badges: ["Код", "Рассуждения"] },
      { name: "GPT Image 1.5", badges: ["Изображения"] },
    ],
  },
  {
    provider: "Google",
    Logo: LogoGoogle,
    color: "from-blue-500 to-indigo-600",
    hoverBorder: "group-hover:border-blue-500/30",
    hoverShadow: "group-hover:shadow-blue-500/10",
    gradientBg: "group-hover:opacity-5",
    models: [
      { name: "Gemini 3.1 Pro", badges: ["Рассуждения", "Вложения"] },
      { name: "Gemini 3 Pro Image", badges: ["Изображения"] },
      { name: "Veo 3.1", badges: ["Видео"] },
    ],
  },
  {
    provider: "Anthropic",
    Logo: LogoAnthropic,
    color: "from-orange-500 to-amber-600",
    hoverBorder: "group-hover:border-orange-500/30",
    hoverShadow: "group-hover:shadow-orange-500/10",
    gradientBg: "group-hover:opacity-5",
    models: [
      { name: "Claude Opus 4.6", badges: ["Рассуждения", "Вложения"] },
      { name: "Claude Sonnet 4.6", badges: ["Рассуждения", "Вложения"] },
    ],
  },
  {
    provider: "xAI",
    Logo: LogoXai,
    color: "from-violet-500 to-purple-600",
    hoverBorder: "group-hover:border-violet-500/30",
    hoverShadow: "group-hover:shadow-violet-500/10",
    gradientBg: "group-hover:opacity-5",
    models: [
      { name: "Grok 4.1", badges: ["Рассуждения", "Вложения"] },
      { name: "Grok Code Fast", badges: ["Код"] },
      { name: "Grok Imagine", badges: ["Изображения", "Видео"] },
    ],
  },
  {
    provider: "BFL",
    Logo: LogoBFL,
    color: "from-cyan-500 to-sky-600",
    hoverBorder: "group-hover:border-cyan-500/30",
    hoverShadow: "group-hover:shadow-cyan-500/10",
    gradientBg: "group-hover:opacity-5",
    models: [
      { name: "Flux 2 Max", badges: ["Изображения"] },
      { name: "Flux Kontext Pro", badges: ["Изображения"] },
    ],
  },
  {
    provider: "Recraft",
    Logo: LogoRecraft,
    color: "from-rose-500 to-pink-600",
    hoverBorder: "group-hover:border-rose-500/30",
    hoverShadow: "group-hover:shadow-rose-500/10",
    gradientBg: "group-hover:opacity-5",
    models: [{ name: "Recraft V4 Pro", badges: ["Изображения"] }],
  },
];

export const ModelsSection = () => (
  <section className="px-4 py-20" id="models">
    <div className="mx-auto max-w-6xl">
      <FadeIn>
        <h2 className="mb-4 text-center font-bold text-3xl text-white md:text-4xl">
          Доступные AI-модели
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-zinc-400">
          18+ моделей от 6 провайдеров — текст, изображения, видео и код
        </p>
      </FadeIn>

      <motion.div
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        initial="hidden"
        variants={staggerContainer}
        viewport={{ once: true, margin: "-100px" }}
        whileInView="visible"
      >
        {providers.map((provider) => (
          <motion.div
            className={`group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-lg transition-[border-color,box-shadow] ${provider.hoverBorder} ${provider.hoverShadow}`}
            key={provider.provider}
            variants={staggerItem}
            whileHover={{ y: -4 }}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${provider.color} opacity-0 transition-opacity ${provider.gradientBg}`}
            />
            <div className="relative">
              <div className="mb-4 flex items-center gap-3">
                <div
                  className={`inline-flex rounded-xl bg-gradient-to-br ${provider.color} p-3`}
                >
                  <provider.Logo size={24} />
                </div>
                <h3 className="font-semibold text-lg text-white">
                  {provider.provider}
                </h3>
              </div>
              <div className="space-y-3">
                {provider.models.map((model) => (
                  <div key={model.name}>
                    <p className="mb-1 text-sm text-zinc-300">{model.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {model.badges.map((badge) => (
                        <span
                          className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400"
                          key={badge}
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);
