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
import type { UserType } from "@/app/(auth)/auth";
import { saveChatModelAsCookie } from "@/app/(chat)/actions";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import {
  type ChatModel,
  chatModels,
  getDefaultThinkingSetting,
  type ThinkingSetting,
  uiVisibleChatModels,
} from "@/lib/ai/models";

type ModelContextValue = {
  currentModelId: string;
  setModelId: (modelId: string) => void;
  availableModels: ChatModel[];
  getModelById: (id: string) => ChatModel | undefined;
  currentThinkingSetting: ThinkingSetting | undefined;
  setCurrentThinkingSetting: (setting: ThinkingSetting | undefined) => void;
};

const ModelContext = createContext<ModelContextValue | undefined>(undefined);

export function ModelProvider({
  children,
  initialModelId,
  initialThinkingSetting,
  userType,
}: {
  children: ReactNode;
  initialModelId: string;
  initialThinkingSetting?: ThinkingSetting;
  userType: UserType;
}) {
  const [currentModelId, setCurrentModelId] = useState(initialModelId);
  const [optimisticModelId, setOptimisticModelId] = useState(initialModelId);
  const [currentThinkingSetting, setCurrentThinkingSetting] = useState<
    ThinkingSetting | undefined
  >(initialThinkingSetting);

  // Create refs for stable access in callbacks
  const currentModelIdRef = useRef(currentModelId);
  const currentThinkingSettingRef = useRef(currentThinkingSetting);

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  useEffect(() => {
    currentThinkingSettingRef.current = currentThinkingSetting;
  }, [currentThinkingSetting]);

  // Filter models based on user entitlements and UI visibility
  const availableModels = useMemo(() => {
    const entitlements = entitlementsByUserType[userType];
    const entitledModelIds = new Set(entitlements.availableChatModelIds);

    return uiVisibleChatModels.filter((model) =>
      entitledModelIds.has(model.id)
    );
  }, [userType]);

  // Get model by ID from all chat models
  const getModelByIdFn = useCallback((id: string) => {
    return chatModels.find((m) => m.id === id);
  }, []);

  // Handle model change with thinking setting coordination
  const setModelId = useCallback((newModelId: string) => {
    setOptimisticModelId(newModelId);
    setCurrentModelId(newModelId);

    // Reset thinking setting to default for new model
    const defaultSetting = getDefaultThinkingSetting(newModelId);
    setCurrentThinkingSetting(defaultSetting);

    // Persist to cookie
    startTransition(() => {
      saveChatModelAsCookie(newModelId);
    });
  }, []);

  // Sync optimistic state with actual state
  useEffect(() => {
    setOptimisticModelId(currentModelId);
  }, [currentModelId]);

  const value = useMemo(
    () => ({
      currentModelId: optimisticModelId,
      setModelId,
      availableModels,
      getModelById: getModelByIdFn,
      currentThinkingSetting,
      setCurrentThinkingSetting,
    }),
    [
      optimisticModelId,
      setModelId,
      availableModels,
      getModelByIdFn,
      currentThinkingSetting,
    ]
  );

  return (
    <ModelContext.Provider value={value}>{children}</ModelContext.Provider>
  );
}

export function useModel() {
  const context = useContext(ModelContext);
  if (context === undefined) {
    throw new Error("useModel must be used within a ModelProvider");
  }
  return context;
}

// Export refs for cases where we need stable references
export function useModelRefs() {
  const { currentModelId, currentThinkingSetting } = useModel();
  const modelIdRef = useRef(currentModelId);
  const thinkingSettingRef = useRef(currentThinkingSetting);

  useEffect(() => {
    modelIdRef.current = currentModelId;
  }, [currentModelId]);

  useEffect(() => {
    thinkingSettingRef.current = currentThinkingSetting;
  }, [currentThinkingSetting]);

  return {
    modelIdRef,
    thinkingSettingRef,
  };
}
