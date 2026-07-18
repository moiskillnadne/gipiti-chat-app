"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import {
  FadeIn,
  staggerContainer,
  staggerItem,
} from "@/components/landing/fade-in";
import type {
  LandingFaqItem,
  ModelLandingAccent,
} from "@/lib/marketing/model-landings";

import { accentClasses } from "./accent-styles";

type ModelLandingFaqProps = {
  accent: ModelLandingAccent;
  items: LandingFaqItem[];
  modelName: string;
};

const FaqAccordionItem = ({
  item,
  isOpen,
  openBorderClass,
  onToggle,
}: {
  item: LandingFaqItem;
  isOpen: boolean;
  openBorderClass: string;
  onToggle: () => void;
}) => (
  <motion.div
    className={`rounded-2xl border bg-zinc-900/50 transition-colors ${
      isOpen ? openBorderClass : "border-zinc-800"
    }`}
    variants={staggerItem}
  >
    <button
      className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left text-white"
      onClick={onToggle}
      type="button"
    >
      <span className="font-medium">{item.question}</span>
      <motion.div
        animate={{ rotate: isOpen ? 180 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <ChevronDownIcon className="size-5 shrink-0 text-zinc-400" />
      </motion.div>
    </button>
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          initial={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <p className="px-6 pb-5 text-sm text-zinc-400 leading-relaxed">
            {item.answer}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
);

export const ModelLandingFaq = ({
  accent,
  items,
  modelName,
}: ModelLandingFaqProps) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const openBorderClass = accentClasses[accent].faqOpenBorder;

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <FadeIn>
          <h2 className="mb-11 text-center font-bold text-3xl text-white tracking-tight md:text-[34px]">
            Вопросы о {modelName}
          </h2>
        </FadeIn>

        <motion.div
          className="space-y-4"
          initial="hidden"
          variants={staggerContainer}
          viewport={{ once: true, margin: "-100px" }}
          whileInView="visible"
        >
          {items.map((item, index) => (
            <FaqAccordionItem
              isOpen={openIndex === index}
              item={item}
              key={item.question}
              onToggle={() => handleToggle(index)}
              openBorderClass={openBorderClass}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
};
