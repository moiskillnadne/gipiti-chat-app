"use client";

import {
  createContext,
  type ReactNode,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { saveWebSearchEnabledAsCookie } from "@/app/(chat)/actions";

type WebSearchContextValue = {
  isWebSearchEnabled: boolean;
  setIsWebSearchEnabled: (enabled: boolean) => void;
  toggleWebSearch: () => void;
};

const WebSearchContext = createContext<WebSearchContextValue | undefined>(
  undefined
);

export function WebSearchProvider({
  children,
  initialEnabled,
}: {
  children: ReactNode;
  initialEnabled: boolean;
}) {
  const [isWebSearchEnabled, setEnabledState] = useState(initialEnabled);

  const setIsWebSearchEnabled = useCallback((enabled: boolean) => {
    setEnabledState(enabled);
    startTransition(() => {
      saveWebSearchEnabledAsCookie(enabled);
    });
  }, []);

  const toggleWebSearch = useCallback(() => {
    setEnabledState((current) => {
      const next = !current;
      startTransition(() => {
        saveWebSearchEnabledAsCookie(next);
      });
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ isWebSearchEnabled, setIsWebSearchEnabled, toggleWebSearch }),
    [isWebSearchEnabled, setIsWebSearchEnabled, toggleWebSearch]
  );

  return (
    <WebSearchContext.Provider value={value}>
      {children}
    </WebSearchContext.Provider>
  );
}

export function useWebSearch() {
  const context = useContext(WebSearchContext);
  if (context === undefined) {
    throw new Error("useWebSearch must be used within a WebSearchProvider");
  }
  return context;
}

export function useWebSearchRef() {
  const { isWebSearchEnabled } = useWebSearch();
  const webSearchEnabledRef = useRef(isWebSearchEnabled);

  useEffect(() => {
    webSearchEnabledRef.current = isWebSearchEnabled;
  }, [isWebSearchEnabled]);

  return { webSearchEnabledRef };
}
