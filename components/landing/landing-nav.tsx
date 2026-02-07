"use client";

import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

const navLinks = [
  { label: "Модели", href: "#models" },
  { label: "Возможности", href: "#features" },
  { label: "Тарифы", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export const LandingNav = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 50);
  });

  return (
    <motion.header
      animate={{
        backgroundColor: isScrolled
          ? "rgba(9, 9, 11, 0.9)"
          : "rgba(9, 9, 11, 0)",
        borderBottomColor: isScrolled
          ? "rgba(39, 39, 42, 0.5)"
          : "rgba(39, 39, 42, 0)",
      }}
      className="fixed top-0 z-50 w-full border-b backdrop-blur-xl"
      transition={{ duration: 0.3 }}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link className="font-bold text-2xl text-white" href="/">
          GIPITI
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              className="text-sm text-zinc-400 transition-colors hover:text-white"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            className="text-sm text-zinc-400 transition-colors hover:text-white"
            href="/login"
          >
            Войти
          </Link>
          <motion.div
            animate={{
              opacity: isScrolled ? 1 : 0,
              scale: isScrolled ? 1 : 0.9,
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
          >
            <a
              className="hidden rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2 font-medium text-sm text-white transition-all hover:shadow-indigo-500/25 hover:shadow-lg sm:inline-flex"
              href="#pricing"
            >
              Попробовать бесплатно
            </a>
          </motion.div>
        </div>
      </nav>
    </motion.header>
  );
};
