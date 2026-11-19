import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { DEFAULT_CHAT_MODEL, uiVisibleChatModels } from "@/lib/ai/models";
import { getTranslations } from "@/lib/i18n/translate";
import { toModelListDto } from "@/server/api/v1/_mappers/model";
import { v1 } from "@/server/api/v1/implementer";

/** Where the registry's `name` and `description` keys are translated. */
const MODEL_TEXT_NAMESPACE = "modelList";

/**
 * The models the picker offers: visible in the UI and in the list every
 * account gets. The same two conditions the web applies
 * (`contexts/model-context.tsx`).
 */
const listPickableModels = () => {
  const availableIds = new Set(
    entitlementsByUserType.regular.availableChatModelIds
  );

  return uiVisibleChatModels.filter((model) => availableIds.has(model.id));
};

export const modelsRouter = {
  list: v1.models.list.handler(async () =>
    toModelListDto({
      models: listPickableModels(),
      defaultModelId: DEFAULT_CHAT_MODEL,
      resolveText: await getTranslations(MODEL_TEXT_NAMESPACE),
    })
  ),
};
