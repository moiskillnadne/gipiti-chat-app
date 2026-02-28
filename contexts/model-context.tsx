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
import {
  saveChatModelAsCookie,
  saveImageAspectAsCookie,
  saveImageQualityAsCookie,
  saveThinkingSettingAsCookie,
} from "@/app/(chat)/actions";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import {
  type ChatModel,
  chatModels,
  getDefaultImageGenSetting,
  getDefaultThinkingSetting,
  type ImageGenSetting,
  serializeThinkingSetting,
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
  currentImageGenSetting: ImageGenSetting | undefined;
  setCurrentImageGenSetting: (setting: ImageGenSetting | undefined) => void;
  isEmptyChat: boolean;
  setIsEmptyChat: (isEmpty: boolean) => void;
  persistPendingModelChange: () => void;
};

const ModelContext = createContext<ModelContextValue | undefined>(undefined);

export function ModelProvider({
  children,
  initialModelId,
  initialThinkingSetting,
  initialImageGenSetting,
  userType,
}: {
  children: ReactNode;
  initialModelId: string;
  initialThinkingSetting?: ThinkingSetting;
  initialImageGenSetting?: ImageGenSetting;
  userType: UserType;
}) {
  const [currentModelId, setCurrentModelId] = useState(initialModelId);
  const [optimisticModelId, setOptimisticModelId] = useState(initialModelId);
  const [currentThinkingSetting, setCurrentThinkingSettingState] = useState<
    ThinkingSetting | undefined
  >(initialThinkingSetting);
  const [currentImageGenSetting, setCurrentImageGenSettingState] = useState<
    ImageGenSetting | undefined
  >(initialImageGenSetting);
  const [isEmptyChat, setIsEmptyChat] = useState(false);

  // Create refs for stable access in callbacks
  const currentModelIdRef = useRef(currentModelId);
  const currentThinkingSettingRef = useRef(currentThinkingSetting);
  const currentImageGenSettingRef = useRef(currentImageGenSetting);
  const pendingModelChangeRef = useRef<string | null>(null);
  const pendingThinkingSettingChangeRef = useRef<{
    modelId: string;
    setting: ThinkingSetting;
  } | null>(null);
  const pendingImageGenSettingChangeRef = useRef<{
    modelId: string;
    setting: ImageGenSetting;
  } | null>(null);

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  useEffect(() => {
    currentThinkingSettingRef.current = currentThinkingSetting;
  }, [currentThinkingSetting]);

  useEffect(() => {
    currentImageGenSettingRef.current = currentImageGenSetting;
  }, [currentImageGenSetting]);

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
  const setModelId = useCallback(
    (newModelId: string) => {
      setOptimisticModelId(newModelId);
      setCurrentModelId(newModelId);

      // Reset thinking setting to default for new model
      const defaultSetting = getDefaultThinkingSetting(newModelId);
      setCurrentThinkingSettingState(defaultSetting);

      // Reset image gen setting to default for new model
      const defaultImageGenSetting = getDefaultImageGenSetting(newModelId);
      setCurrentImageGenSettingState(defaultImageGenSetting);

      // Conditionally persist to cookie based on chat state
      if (isEmptyChat) {
        pendingModelChangeRef.current = newModelId;
      } else {
        startTransition(() => {
          saveChatModelAsCookie(newModelId);
        });
      }
    },
    [isEmptyChat]
  );

  // Handle thinking setting change with conditional persistence
  const setCurrentThinkingSetting = useCallback(
    (setting: ThinkingSetting | undefined) => {
      setCurrentThinkingSettingState(setting);

      // Conditionally persist to cookie based on chat state
      if (setting && !isEmptyChat) {
        startTransition(() => {
          saveThinkingSettingAsCookie(
            currentModelId,
            serializeThinkingSetting(setting)
          );
        });
      } else if (setting && isEmptyChat) {
        pendingThinkingSettingChangeRef.current = {
          modelId: currentModelId,
          setting,
        };
      }
    },
    [isEmptyChat, currentModelId]
  );

  // Handle image gen setting change with conditional persistence
  const setCurrentImageGenSetting = useCallback(
    (setting: ImageGenSetting | undefined) => {
      setCurrentImageGenSettingState(setting);

      if (setting && !isEmptyChat) {
        startTransition(() => {
          if (setting.quality) {
            saveImageQualityAsCookie(currentModelId, setting.quality);
          }
          if (setting.aspectRatio) {
            saveImageAspectAsCookie(currentModelId, setting.aspectRatio);
          }
        });
      } else if (setting && isEmptyChat) {
        pendingImageGenSettingChangeRef.current = {
          modelId: currentModelId,
          setting,
        };
      }
    },
    [isEmptyChat, currentModelId]
  );

  // Sync optimistic state with actual state
  useEffect(() => {
    setOptimisticModelId(currentModelId);
  }, [currentModelId]);

  // Persist any pending changes to cookies
  const persistPendingModelChange = useCallback(() => {
    if (pendingModelChangeRef.current) {
      const modelToSave = pendingModelChangeRef.current;
      pendingModelChangeRef.current = null;
      startTransition(() => {
        saveChatModelAsCookie(modelToSave);
      });
    }

    if (pendingThinkingSettingChangeRef.current) {
      const { modelId, setting } = pendingThinkingSettingChangeRef.current;
      pendingThinkingSettingChangeRef.current = null;
      startTransition(() => {
        saveThinkingSettingAsCookie(modelId, serializeThinkingSetting(setting));
      });
    }

    if (pendingImageGenSettingChangeRef.current) {
      const { modelId, setting } = pendingImageGenSettingChangeRef.current;
      pendingImageGenSettingChangeRef.current = null;
      startTransition(() => {
        if (setting.quality) {
          saveImageQualityAsCookie(modelId, setting.quality);
        }
        if (setting.aspectRatio) {
          saveImageAspectAsCookie(modelId, setting.aspectRatio);
        }
      });
    }
  }, []);

  const value = useMemo(
    () => ({
      currentModelId: optimisticModelId,
      setModelId,
      availableModels,
      getModelById: getModelByIdFn,
      currentThinkingSetting,
      setCurrentThinkingSetting,
      currentImageGenSetting,
      setCurrentImageGenSetting,
      isEmptyChat,
      setIsEmptyChat,
      persistPendingModelChange,
    }),
    [
      optimisticModelId,
      setModelId,
      availableModels,
      getModelByIdFn,
      currentThinkingSetting,
      setCurrentThinkingSetting,
      currentImageGenSetting,
      setCurrentImageGenSetting,
      isEmptyChat,
      persistPendingModelChange,
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
  const { currentModelId, currentThinkingSetting, currentImageGenSetting } =
    useModel();
  const modelIdRef = useRef(currentModelId);
  const thinkingSettingRef = useRef(currentThinkingSetting);
  const imageGenSettingRef = useRef(currentImageGenSetting);

  useEffect(() => {
    modelIdRef.current = currentModelId;
  }, [currentModelId]);

  useEffect(() => {
    thinkingSettingRef.current = currentThinkingSetting;
  }, [currentThinkingSetting]);

  useEffect(() => {
    imageGenSettingRef.current = currentImageGenSetting;
  }, [currentImageGenSetting]);

  return {
    modelIdRef,
    thinkingSettingRef,
    imageGenSettingRef,
  };
}
