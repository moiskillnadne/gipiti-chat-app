"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Makes every framer-motion animation honour the OS "reduce motion" setting:
 * transforms (slide, scale) jump to their end value, opacity still fades.
 * The global CSS guard in app/globals.css does not reach framer-motion.
 */
export const ReducedMotionConfig = ({ children }: { children: ReactNode }) => (
  <MotionConfig reducedMotion="user">{children}</MotionConfig>
);
