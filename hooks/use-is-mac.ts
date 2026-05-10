"use client";

import { useEffect, useState } from "react";

const MAC_PATTERN = /Mac|iPhone|iPad|iPod/;

export function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      return;
    }
    setIsMac(MAC_PATTERN.test(navigator.userAgent));
  }, []);

  return isMac;
}
