"use client";

import { type RefObject, useCallback, useRef, useState } from "react";

import { isTextTruncated } from "@/lib/utils/is-text-truncated";

type OverflowTooltip<T extends HTMLElement> = {
  textRef: RefObject<T>;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

/**
 * Controlled state for a Radix tooltip that repeats an ellipsis-truncated text:
 * it opens on hover or keyboard focus only while the text in `textRef` overflows.
 */
export const useOverflowTooltip = <
  T extends HTMLElement = HTMLSpanElement,
>(): OverflowTooltip<T> => {
  const textRef = useRef<T>(null);
  const [isOpen, setIsOpen] = useState(false);

  const onOpenChange = useCallback((isRequested: boolean) => {
    setIsOpen(isRequested && isTextTruncated(textRef.current));
  }, []);

  return { textRef, isOpen, onOpenChange };
};

/** Tooltip content that wraps any string and never runs past the viewport. */
export const OVERFLOW_TOOLTIP_CONTENT_CLASS =
  "max-w-[min(20rem,var(--radix-tooltip-content-available-width))] text-pretty text-[13px] [overflow-wrap:anywhere]";
