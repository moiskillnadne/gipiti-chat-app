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
import useSWR from "swr";
import { saveTextStyleAsCookie } from "@/app/(chat)/actions";
import type { TextStyle } from "@/lib/db/schema";
import { fetcher } from "@/lib/utils";

type StyleContextValue = {
  currentStyleId: string | null;
  setStyleId: (styleId: string | null) => void;
  styles: TextStyle[];
  isLoading: boolean;
  refreshStyles: () => void;
};

const StyleContext = createContext<StyleContextValue | undefined>(undefined);

export function StyleProvider({
  children,
  initialStyleId,
}: {
  children: ReactNode;
  initialStyleId: string | null;
}) {
  const [currentStyleId, setCurrentStyleId] = useState<string | null>(
    initialStyleId
  );
  const currentStyleIdRef = useRef(currentStyleId);

  useEffect(() => {
    currentStyleIdRef.current = currentStyleId;
  }, [currentStyleId]);

  const {
    data: styles,
    isLoading,
    mutate: refreshStyles,
  } = useSWR<TextStyle[]>("/api/text-styles", fetcher);

  // Clear selected style if it was deleted
  useEffect(() => {
    if (styles && currentStyleId) {
      const stillExists = styles.some((s) => s.id === currentStyleId);
      if (!stillExists) {
        setCurrentStyleId(null);
        startTransition(() => {
          saveTextStyleAsCookie(null);
        });
      }
    }
  }, [styles, currentStyleId]);

  const setStyleId = useCallback((styleId: string | null) => {
    setCurrentStyleId(styleId);
    currentStyleIdRef.current = styleId;
    startTransition(() => {
      saveTextStyleAsCookie(styleId);
    });
  }, []);

  const handleRefreshStyles = useCallback(() => {
    refreshStyles();
  }, [refreshStyles]);

  const value = useMemo(
    () => ({
      currentStyleId,
      setStyleId,
      styles: styles ?? [],
      isLoading,
      refreshStyles: handleRefreshStyles,
    }),
    [currentStyleId, setStyleId, styles, isLoading, handleRefreshStyles]
  );

  return (
    <StyleContext.Provider value={value}>{children}</StyleContext.Provider>
  );
}

export function useStyle() {
  const context = useContext(StyleContext);
  if (context === undefined) {
    throw new Error("useStyle must be used within a StyleProvider");
  }
  return context;
}

export function useStyleRef() {
  const { currentStyleId } = useStyle();
  const styleIdRef = useRef(currentStyleId);

  useEffect(() => {
    styleIdRef.current = currentStyleId;
  }, [currentStyleId]);

  return { styleIdRef };
}
