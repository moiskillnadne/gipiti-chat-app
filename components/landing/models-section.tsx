"use client";

import { motion } from "framer-motion";
import type { ElementType } from "react";

import {
  LogoAnthropic,
  LogoGoogle,
  LogoOpenAI,
  LogoXai,
} from "@/components/icons";

import { FadeIn, staggerContainer, staggerItem } from "./fade-in";

type ModelCard = {
  name: string;
  provider: string;
  Logo: ElementType;
  color: string;
  hoverBorder: string;
  hoverShadow: string;
  gradientBg: string;
  badges: string[];
};

const models: ModelCard[] = [
  {
    name: "ChatGPT 5.2",
    provider: "OpenAI",
    Logo: LogoOpenAI,
    color: "from-emerald-500 to-teal-600",
    hoverBorder: "group-hover:border-emerald-500/30",
    hoverShadow: "group-hover:shadow-emerald-500/10",
    gradientBg: "group-hover:opacity-5",
    badges: ["Вложения", "Изображения"],
  },
  {
    name: "Gemini 3 Pro",
    provider: "Google",
    Logo: LogoGoogle,
    color: "from-blue-500 to-indigo-600",
    hoverBorder: "group-hover:border-blue-500/30",
    hoverShadow: "group-hover:shadow-blue-500/10",
    gradientBg: "group-hover:opacity-5",
    badges: ["Рассуждения", "Вложения"],
  },
  {
    name: "Claude Opus 4.6",
    provider: "Anthropic",
    Logo: LogoAnthropic,
    color: "from-orange-500 to-amber-600",
    hoverBorder: "group-hover:border-orange-500/30",
    hoverShadow: "group-hover:shadow-orange-500/10",
    gradientBg: "group-hover:opacity-5",
    badges: ["Рассуждения", "Вложения"],
  },
  {
    name: "Grok 4.1",
    provider: "xAI",
    Logo: LogoXai,
    color: "from-violet-500 to-purple-600",
    hoverBorder: "group-hover:border-violet-500/30",
    hoverShadow: "group-hover:shadow-violet-500/10",
    gradientBg: "group-hover:opacity-5",
    badges: ["Рассуждения", "Вложения"],
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
          Используйте самые мощные языковые модели от ведущих разработчиков
        </p>
      </FadeIn>

      <motion.div
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
        initial="hidden"
        variants={staggerContainer}
        viewport={{ once: true, margin: "-100px" }}
        whileInView="visible"
      >
        {models.map((model) => (
          <motion.div
            className={`group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-lg transition-[border-color,box-shadow] ${model.hoverBorder} ${model.hoverShadow}`}
            key={model.name}
            variants={staggerItem}
            whileHover={{ y: -4 }}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-br ${model.color} opacity-0 transition-opacity ${model.gradientBg}`}
            />
            <div className="relative">
              <div
                className={`mb-4 inline-flex rounded-xl bg-gradient-to-br ${model.color} p-3`}
              >
                <model.Logo size={24} />
              </div>
              <h3 className="mb-1 font-semibold text-lg text-white">
                {model.name}
              </h3>
              <p className="mb-3 text-sm text-zinc-500">{model.provider}</p>
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
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);
