"use client";

import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

import { isLandingSectionLink } from "@/lib/marketing/landing-links";
import {
  landingLoginLink,
  landingNavLinks,
  landingRegisterLink,
} from "@/lib/marketing/landing-nav-links";

import { LandingMobileMenu } from "./landing-mobile-menu";

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
        <Link
          className="font-bold text-2xl text-white"
          href="/"
          prefetch={false}
        >
          GIPITI
        </Link>

        <div className="hidden items-center gap-6 md:flex lg:gap-8">
          {landingNavLinks.map((link) => (
            <Link
              className="text-sm text-zinc-400 transition-colors hover:text-white"
              href={link.href}
              key={link.href}
              prefetch={isLandingSectionLink(link.href) ? false : undefined}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Link
            className="text-sm text-zinc-400 transition-colors hover:text-white"
            href={landingLoginLink.href}
            prefetch={false}
          >
            {landingLoginLink.label}
          </Link>
          {/* Below `sm` the mobile menu carries this action. */}
          <Link
            className="hidden rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-2 font-medium text-sm text-white transition-all hover:shadow-indigo-500/25 hover:shadow-lg sm:inline-flex"
            href={landingRegisterLink.href}
            prefetch={false}
          >
            {landingRegisterLink.label}
          </Link>
          <LandingMobileMenu />
        </div>
      </nav>
    </motion.header>
  );
};
