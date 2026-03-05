"use client";

import { useEffect } from "react";
import { UTM_COOKIE_MAX_AGE, UTM_COOKIE_NAME } from "@/lib/utm/constants";

const UTM_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

export function UtmCapture() {
  useEffect(() => {
    if (document.cookie.includes(`${UTM_COOKIE_NAME}=`)) return;

    const params = new URLSearchParams(window.location.search);
    const utmData: Record<string, string> = {};

    for (const key of UTM_PARAMS) {
      const value = params.get(key);
      if (value) utmData[key] = value;
    }

    if (Object.keys(utmData).length === 0) return;

    const json = encodeURIComponent(JSON.stringify(utmData));
    document.cookie =
      `${UTM_COOKIE_NAME}=${json}; path=/; max-age=${UTM_COOKIE_MAX_AGE}; samesite=lax`;
  }, []);

  return null;
}
