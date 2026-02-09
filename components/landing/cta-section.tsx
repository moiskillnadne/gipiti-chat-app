"use client";

import { motion } from "framer-motion";

import { FadeIn } from "./fade-in";

export const CtaSection = () => (
  <section className="relative overflow-hidden px-4 py-24">
    {/* Background glow */}
    <div className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 size-[500px] rounded-full bg-indigo-500/10 blur-3xl" />

    <div className="relative mx-auto max-w-3xl text-center">
      <FadeIn>
        <h2 className="mb-4 font-bold text-3xl text-white md:text-5xl">
          Готовы начать?
        </h2>
        <p className="mx-auto mb-10 max-w-xl text-lg text-zinc-400">
          Получите доступ ко всем AI-моделям за одну подписку
        </p>

        <motion.div
          transition={{ type: "spring", stiffness: 300 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <a
            className="inline-flex rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-10 py-4 font-semibold text-lg text-white shadow-indigo-500/25 shadow-lg transition-all hover:shadow-2xl hover:shadow-indigo-500/30"
            href="#pricing"
          >
            Попробовать бесплатно
          </a>
        </motion.div>
      </FadeIn>
    </div>
  </section>
);
