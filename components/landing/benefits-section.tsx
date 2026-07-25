"use client";

import { motion } from "framer-motion";
import {
  GlobeIcon,
  LanguagesIcon,
  PiggyBankIcon,
  WalletIcon,
} from "lucide-react";
import type { ElementType } from "react";

import type { HomeBenefitIcon } from "@/lib/marketing/landing-content";
import { homeBenefits } from "@/lib/marketing/landing-content";

import { FadeIn, staggerContainer, staggerItem } from "./fade-in";

const benefitIcons: Record<HomeBenefitIcon, ElementType> = {
  globe: GlobeIcon,
  wallet: WalletIcon,
  languages: LanguagesIcon,
  "piggy-bank": PiggyBankIcon,
};

export const BenefitsSection = () => (
  <section className="px-4 py-20">
    {/* Green gradient divider */}
    <div className="mx-auto mb-16 h-px max-w-6xl bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

    <div className="mx-auto max-w-6xl">
      <FadeIn>
        <h2 className="mb-4 text-center font-bold text-3xl text-white md:text-4xl">
          Как GIPITI решает эти проблемы
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-zinc-400">
          Простой доступ к лучшим AI-моделям без лишних сложностей
        </p>
      </FadeIn>

      <motion.div
        className="grid gap-6 md:grid-cols-2"
        initial="hidden"
        variants={staggerContainer}
        viewport={{ once: true, margin: "-100px" }}
        whileInView="visible"
      >
        {homeBenefits.map((benefit) => {
          const BenefitIcon = benefitIcons[benefit.icon];

          return (
            <motion.div
              className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-[border-color,box-shadow] hover:border-emerald-500/30 hover:shadow-emerald-500/5 hover:shadow-lg"
              key={benefit.title}
              variants={staggerItem}
              whileHover={{ scale: 1.02, y: -4 }}
            >
              <div className="mb-4 inline-flex rounded-xl bg-emerald-500/10 p-3">
                <BenefitIcon className="size-6 text-emerald-400" />
              </div>
              <h3 className="mb-2 font-semibold text-lg text-white">
                {benefit.title}
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {benefit.description}
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
            Попробовать бесплатно
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </FadeIn>
    </div>
  </section>
);
