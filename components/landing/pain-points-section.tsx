"use client";

import { motion } from "framer-motion";
import {
  CreditCardIcon,
  ShieldAlertIcon,
  ShuffleIcon,
  TrendingUpIcon,
} from "lucide-react";
import type { ElementType } from "react";

import { FadeIn, staggerContainer, staggerItem } from "./fade-in";

type PainPoint = {
  icon: ElementType;
  title: string;
  description: string;
};

const painPoints: PainPoint[] = [
  {
    icon: ShieldAlertIcon,
    title: "Региональные ограничения",
    description:
      "Множество AI-сервисов заблокированы или недоступны в России. Приходится использовать VPN и сталкиваться с блокировками аккаунтов.",
  },
  {
    icon: CreditCardIcon,
    title: "Нужна зарубежная карта",
    description:
      "Для оплаты иностранных AI-сервисов требуется международная карта, которую сложно получить из-за санкций.",
  },
  {
    icon: ShuffleIcon,
    title: "Множество разных сервисов",
    description:
      "Для доступа к разным моделям приходится регистрироваться и оплачивать несколько платформ — ChatGPT, Claude, Gemini.",
  },
  {
    icon: TrendingUpIcon,
    title: "Дорогие подписки",
    description:
      "Отдельная подписка на каждый AI-сервис в валюте обходится дорого. Суммарная стоимость может достигать десятков тысяч рублей.",
  },
];

export const PainPointsSection = () => (
  <section className="px-4 py-20">
    {/* Red gradient divider */}
    <div className="mx-auto mb-16 h-px max-w-6xl bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

    <div className="mx-auto max-w-6xl">
      <FadeIn>
        <h2 className="mb-4 text-center font-bold text-3xl text-white md:text-4xl">
          Знакомые проблемы?
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-zinc-400">
          Доступ к современным AI-моделям в России — это целый квест
        </p>
      </FadeIn>

      <motion.div
        className="grid gap-6 md:grid-cols-2"
        initial="hidden"
        variants={staggerContainer}
        viewport={{ once: true, margin: "-100px" }}
        whileInView="visible"
      >
        {painPoints.map((point) => (
          <motion.div
            className="group rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 transition-[border-color,box-shadow] hover:border-red-500/30 hover:shadow-lg hover:shadow-red-500/5"
            key={point.title}
            variants={staggerItem}
            whileHover={{ scale: 1.02, y: -4 }}
          >
            <div className="mb-4 inline-flex rounded-xl bg-red-500/10 p-3">
              <point.icon className="size-6 text-red-400" />
            </div>
            <h3 className="mb-2 font-semibold text-lg text-white">
              {point.title}
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {point.description}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);
