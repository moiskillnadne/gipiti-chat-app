"use client";

import { motion } from "framer-motion";
import {
  BrainIcon,
  Code2Icon,
  FileTextIcon,
  ImageIcon,
  MessageSquareIcon,
  SearchIcon,
  VideoIcon,
  ZapIcon,
} from "lucide-react";
import type { ElementType } from "react";

import type { HomeFeatureIcon } from "@/lib/marketing/landing-content";
import { homeFeatures } from "@/lib/marketing/landing-content";

import { FadeIn, staggerContainer, staggerItem } from "./fade-in";

const featureIcons: Record<HomeFeatureIcon, ElementType> = {
  "message-square": MessageSquareIcon,
  image: ImageIcon,
  video: VideoIcon,
  code: Code2Icon,
  "file-text": FileTextIcon,
  search: SearchIcon,
  brain: BrainIcon,
  zap: ZapIcon,
};

export const FeaturesSection = () => (
  <section className="px-4 py-20" id="features">
    <div className="mx-auto max-w-6xl">
      <FadeIn>
        <h2 className="mb-4 text-center font-bold text-3xl text-white md:text-4xl">
          Возможности платформы
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-zinc-400">
          Всё необходимое для продуктивной работы с искусственным интеллектом
        </p>
      </FadeIn>

      <motion.div
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
        initial="hidden"
        variants={staggerContainer}
        viewport={{ once: true, margin: "-100px" }}
        whileInView="visible"
      >
        {homeFeatures.map((feature) => {
          const FeatureIcon = featureIcons[feature.icon];

          return (
            <motion.div
              className="group rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 backdrop-blur-sm transition-[border-color,box-shadow] hover:border-indigo-500/30"
              key={feature.title}
              variants={staggerItem}
              whileHover={{ y: -4 }}
            >
              <div className="mb-4 inline-flex rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-3">
                <FeatureIcon className="size-6 text-indigo-400" />
              </div>
              <h3 className="mb-2 font-semibold text-lg text-white">
                {feature.title}
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Inline CTA */}
      <FadeIn delay={0.3}>
        <div className="mt-10 text-center">
          <a
            className="inline-flex items-center gap-2 text-indigo-400 transition-colors hover:text-indigo-300"
            href="#pricing"
          >
            Начать использовать
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </FadeIn>
    </div>
  </section>
);
