"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import type { HomeFaqItem } from "@/lib/marketing/landing-content";
import { homeFaqItems } from "@/lib/marketing/landing-content";

import { FadeIn, staggerContainer, staggerItem } from "./fade-in";

const FaqAccordionItem = ({
  item,
  isOpen,
  onToggle,
}: {
  item: HomeFaqItem;
  isOpen: boolean;
  onToggle: () => void;
}) => (
  <motion.div
    className={`rounded-2xl border bg-zinc-900/50 transition-colors ${
      isOpen ? "border-indigo-500/30" : "border-zinc-800"
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

export const FaqSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="px-4 py-20" id="faq">
      <div className="mx-auto max-w-3xl">
        <FadeIn>
          <h2 className="mb-12 text-center font-bold text-3xl text-white md:text-4xl">
            Часто задаваемые вопросы
          </h2>
        </FadeIn>

        <motion.div
          className="space-y-4"
          initial="hidden"
          variants={staggerContainer}
          viewport={{ once: true, margin: "-100px" }}
          whileInView="visible"
        >
          {homeFaqItems.map((item, index) => (
            <FaqAccordionItem
              isOpen={openIndex === index}
              item={item}
              key={item.question}
              onToggle={() => handleToggle(index)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
};
