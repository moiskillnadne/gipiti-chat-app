"use client";

import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { useEffect, useRef } from "react";

import {
  LogoAnthropic,
  LogoGoogle,
  LogoOpenAI,
  LogoXai,
} from "@/components/icons";

import { staggerContainer, staggerItem } from "./fade-in";

type StatItem = {
  value: number;
  suffix: string;
  label: string;
};

const stats: StatItem[] = [
  { value: 4, suffix: "+", label: "AI-провайдеров" },
  { value: 10, suffix: "+", label: "AI-моделей" },
  { value: 500, suffix: "+", label: "пользователей" },
];

const providers = [
  { Logo: LogoOpenAI, name: "OpenAI" },
  { Logo: LogoGoogle, name: "Google" },
  { Logo: LogoAnthropic, name: "Anthropic" },
  { Logo: LogoXai, name: "xAI" },
];

const AnimatedCounter = ({
  value,
  suffix,
}: {
  value: number;
  suffix: string;
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (latest) => Math.round(latest));
  const isInView = useInView(ref, { once: true, margin: "-100px 0px" });

  useEffect(() => {
    if (isInView) {
      animate(motionVal, value, { duration: 1.5, ease: "easeOut" });
    }
  }, [isInView, motionVal, value]);

  useEffect(() => {
    const unsubscribe = rounded.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = `${latest}${suffix}`;
      }
    });
    return unsubscribe;
  }, [rounded, suffix]);

  return (
    <span className="font-bold text-3xl text-white md:text-4xl" ref={ref}>
      0{suffix}
    </span>
  );
};

export const TrustBar = () => (
  <section className="border-zinc-800/50 border-y bg-zinc-900/30 px-4 py-16">
    <div className="mx-auto max-w-6xl">
      {/* Stats row */}
      <div className="mb-12 grid grid-cols-3 gap-8">
        {stats.map((stat) => (
          <div className="text-center" key={stat.label}>
            <AnimatedCounter suffix={stat.suffix} value={stat.value} />
            <p className="mt-1 text-sm text-zinc-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Provider logos */}
      <motion.div
        className="flex items-center justify-center gap-10 md:gap-16"
        initial="hidden"
        variants={staggerContainer}
        viewport={{ once: true, margin: "-50px" }}
        whileInView="visible"
      >
        {providers.map((provider) => (
          <motion.div
            className="flex items-center gap-2 text-zinc-500"
            key={provider.name}
            variants={staggerItem}
          >
            <provider.Logo size={24} />
            <span className="hidden text-sm md:inline">{provider.name}</span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);
