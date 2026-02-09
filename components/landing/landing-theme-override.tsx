"use client";

import { useEffect } from "react";

const LANDING_THEME_COLOR = "#09090b";

export const LandingThemeOverride = () => {
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      return;
    }

    meta.setAttribute("content", LANDING_THEME_COLOR);

    const observer = new MutationObserver(() => {
      if (meta.getAttribute("content") !== LANDING_THEME_COLOR) {
        meta.setAttribute("content", LANDING_THEME_COLOR);
      }
    });

    observer.observe(meta, {
      attributes: true,
      attributeFilter: ["content"],
    });

    return () => {
      observer.disconnect();

      const isDark = document.documentElement.classList.contains("dark");
      meta.setAttribute(
        "content",
        isDark ? "hsl(240deg 10% 3.92%)" : "hsl(0 0% 100%)"
      );
    };
  }, []);

  return null;
};
