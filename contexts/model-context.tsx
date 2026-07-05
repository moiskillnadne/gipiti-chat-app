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
  saveImageStyleAsCookie,
  saveThinkingSettingAsCookie,
  saveVideoAspectAsCookie,
  saveVideoDurationAsCookie,
  saveVideoModeAsCookie,
  saveVideoResolutionAsCookie,
} from "@/app/(chat)/actions";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import {
  type ChatModel,
  chatModels,
  getDefaultImageGenSetting,
  getDefaultThinkingSetting,
  getDefaultVideoGenSetting,
  type ImageGenSetting,
  serializeThinkingSetting,
  type ThinkingSetting,
  uiVisibleChatModels,
  type VideoGenSetting,
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
  currentVideoGenSetting: VideoGenSetting | undefined;
  setCurrentVideoGenSetting: (setting: VideoGenSetting | undefined) => void;
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
  initialVideoGenSetting,
  userType,
}: {
  children: ReactNode;
  initialModelId: string;
  initialThinkingSetting?: ThinkingSetting;
  initialImageGenSetting?: ImageGenSetting;
  initialVideoGenSetting?: VideoGenSetting;
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
  const [currentVideoGenSetting, setCurrentVideoGenSettingState] = useState<
    VideoGenSetting | undefined
  >(initialVideoGenSetting);
  const [isEmptyChat, setIsEmptyChat] = useState(false);

  // Create refs for stable access in callbacks
  const currentModelIdRef = useRef(currentModelId);
  const currentThinkingSettingRef = useRef(currentThinkingSetting);
  const currentImageGenSettingRef = useRef(currentImageGenSetting);
  const currentVideoGenSettingRef = useRef(currentVideoGenSetting);
  const pendingModelChangeRef = useRef<string | null>(null);
  const pendingThinkingSettingChangeRef = useRef<{
    modelId: string;
    setting: ThinkingSetting;
  } | null>(null);
  const pendingImageGenSettingChangeRef = useRef<{
    modelId: string;
    setting: ImageGenSetting;
  } | null>(null);
  const pendingVideoGenSettingChangeRef = useRef<{
    modelId: string;
    setting: VideoGenSetting;
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

  useEffect(() => {
    currentVideoGenSettingRef.current = currentVideoGenSetting;
  }, [currentVideoGenSetting]);

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

      // Reset video gen setting to default for new model
      const defaultVideoGenSetting = getDefaultVideoGenSetting(newModelId);
      setCurrentVideoGenSettingState(defaultVideoGenSetting);

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
          if (setting.style) {
            saveImageStyleAsCookie(currentModelId, setting.style);
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

  // Handle video gen setting change with conditional persistence
  const setCurrentVideoGenSetting = useCallback(
    (setting: VideoGenSetting | undefined) => {
      setCurrentVideoGenSettingState(setting);

      if (setting && !isEmptyChat) {
        startTransition(() => {
          if (setting.aspectRatio) {
            saveVideoAspectAsCookie(currentModelId, setting.aspectRatio);
          }
          if (setting.duration) {
            saveVideoDurationAsCookie(currentModelId, setting.duration);
          }
          if (setting.resolution) {
            saveVideoResolutionAsCookie(currentModelId, setting.resolution);
          }
          if (setting.mode) {
            saveVideoModeAsCookie(currentModelId, setting.mode);
          }
        });
      } else if (setting && isEmptyChat) {
        pendingVideoGenSettingChangeRef.current = {
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
        if (setting.style) {
          saveImageStyleAsCookie(modelId, setting.style);
        }
      });
    }

    if (pendingVideoGenSettingChangeRef.current) {
      const { modelId, setting } = pendingVideoGenSettingChangeRef.current;
      pendingVideoGenSettingChangeRef.current = null;
      startTransition(() => {
        if (setting.aspectRatio) {
          saveVideoAspectAsCookie(modelId, setting.aspectRatio);
        }
        if (setting.duration) {
          saveVideoDurationAsCookie(modelId, setting.duration);
        }
        if (setting.resolution) {
          saveVideoResolutionAsCookie(modelId, setting.resolution);
        }
        if (setting.mode) {
          saveVideoModeAsCookie(modelId, setting.mode);
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
      currentVideoGenSetting,
      setCurrentVideoGenSetting,
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
      currentVideoGenSetting,
      setCurrentVideoGenSetting,
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
  const {
    currentModelId,
    currentThinkingSetting,
    currentImageGenSetting,
    currentVideoGenSetting,
  } = useModel();
  const modelIdRef = useRef(currentModelId);
  const thinkingSettingRef = useRef(currentThinkingSetting);
  const imageGenSettingRef = useRef(currentImageGenSetting);
  const videoGenSettingRef = useRef(currentVideoGenSetting);

  useEffect(() => {
    modelIdRef.current = currentModelId;
  }, [currentModelId]);

  useEffect(() => {
    thinkingSettingRef.current = currentThinkingSetting;
  }, [currentThinkingSetting]);

  useEffect(() => {
    imageGenSettingRef.current = currentImageGenSetting;
  }, [currentImageGenSetting]);

  useEffect(() => {
    videoGenSettingRef.current = currentVideoGenSetting;
  }, [currentVideoGenSetting]);

  return {
    modelIdRef,
    thinkingSettingRef,
    imageGenSettingRef,
    videoGenSettingRef,
  };
}
