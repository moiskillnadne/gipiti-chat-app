"use client";

import { motion } from "framer-motion";

import { FadeIn, staggerContainer, staggerItem } from "./fade-in";

type Step = {
  step: number;
  title: string;
  description: string;
};

const steps: Step[] = [
  {
    step: 1,
    title: "Зарегистрируйтесь",
    description: "Создайте аккаунт за 30 секунд — нужен только email и пароль.",
  },
  {
    step: 2,
    title: "Выберите тариф",
    description:
      "Подберите подходящий план и начните с 3-х дневного пробного периода.",
  },
  {
    step: 3,
    title: "Выберите модель",
    description:
      "Переключайтесь между ChatGPT, Gemini, Claude и Grok в один клик.",
  },
  {
    step: 4,
    title: "Решайте задачи",
    description:
      "Генерируйте тексты, анализируйте документы, создавайте изображения и многое другое.",
  },
];

const StepConnector = ({ isVertical }: { isVertical: boolean }) => (
  <motion.div
    className={
      isVertical
        ? "mx-auto h-8 w-px bg-gradient-to-b from-indigo-500/50 to-purple-500/50"
        : "mt-7 hidden h-px flex-1 bg-gradient-to-r from-indigo-500/50 to-purple-500/50 lg:block"
    }
    initial={{ scaleY: isVertical ? 0 : 1, scaleX: isVertical ? 1 : 0 }}
    transition={{ duration: 0.6, ease: "easeOut" }}
    viewport={{ once: true }}
    whileInView={{ scaleY: 1, scaleX: 1 }}
  />
);

export const HowItWorksSection = () => (
  <section className="px-4 py-20">
    <div className="mx-auto max-w-6xl">
      <FadeIn>
        <h2 className="mb-4 text-center font-bold text-3xl text-white md:text-4xl">
          Как это работает
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-zinc-400">
          Начните использовать AI за 4 простых шага
        </p>
      </FadeIn>

      {/* Desktop: horizontal */}
      <motion.div
        className="hidden items-start lg:flex"
        initial="hidden"
        variants={staggerContainer}
        viewport={{ once: true, margin: "-100px" }}
        whileInView="visible"
      >
        {steps.map((item, index) => (
          <div className="contents" key={item.step}>
            <motion.div
              className="flex flex-1 flex-col items-center text-center"
              variants={staggerItem}
            >
              <motion.div
                className="mb-4 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white text-xl shadow-indigo-500/25 shadow-lg"
                transition={{ type: "spring", stiffness: 300 }}
                whileHover={{ scale: 1.1 }}
              >
                {item.step}
              </motion.div>
              <h3 className="mb-2 font-semibold text-lg text-white">
                {item.title}
              </h3>
              <p className="max-w-[200px] text-sm text-zinc-400">
                {item.description}
              </p>
            </motion.div>
            {index < steps.length - 1 && <StepConnector isVertical={false} />}
          </div>
        ))}
      </motion.div>

      {/* Mobile: vertical */}
      <motion.div
        className="flex flex-col items-center lg:hidden"
        initial="hidden"
        variants={staggerContainer}
        viewport={{ once: true, margin: "-100px" }}
        whileInView="visible"
      >
        {steps.map((item, index) => (
          <div className="flex flex-col items-center" key={item.step}>
            <motion.div
              className="flex flex-col items-center text-center"
              variants={staggerItem}
            >
              <motion.div
                className="mb-4 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-white text-xl shadow-indigo-500/25 shadow-lg"
                transition={{ type: "spring", stiffness: 300 }}
                whileHover={{ scale: 1.1 }}
              >
                {item.step}
              </motion.div>
              <h3 className="mb-2 font-semibold text-lg text-white">
                {item.title}
              </h3>
              <p className="max-w-xs text-sm text-zinc-400">
                {item.description}
              </p>
            </motion.div>
            {index < steps.length - 1 && <StepConnector isVertical />}
          </div>
        ))}
      </motion.div>
    </div>
  </section>
);
