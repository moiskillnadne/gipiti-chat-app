import type { ChatModel } from "@/lib/ai/models";
import type { Model, ModelList } from "@/server/api/v1/_schemas/model";

/** Resolves a key of the `modelList` translation namespace to its text. */
export type ModelTextResolver = (key: string) => string;

/**
 * A registry entry as a client sees it. Only the listed fields are copied:
 * the registry also holds provider options and generation configs that are
 * server business.
 *
 * In the registry `name` and `description` are translation keys
 * (`grok47.name`); the web resolves them in the browser. An API client has no
 * dictionary, so they are resolved here.
 */
export const toModelDto = (
  model: ChatModel,
  resolveText: ModelTextResolver
): Model => ({
  id: model.id,
  name: resolveText(model.name),
  description: resolveText(model.description),
  provider: model.provider ?? null,
  capabilities: {
    reasoning: model.capabilities?.reasoning ?? false,
    attachments: model.capabilities?.attachments ?? false,
    imageGeneration: model.capabilities?.imageGeneration ?? false,
    videoGeneration: model.capabilities?.videoGeneration ?? false,
    // In the registry an unset `toolCalling` means "supported".
    toolCalling: model.capabilities?.toolCalling ?? true,
  },
});

export const toModelListDto = ({
  models,
  defaultModelId,
  resolveText,
}: {
  models: ChatModel[];
  defaultModelId: string;
  resolveText: ModelTextResolver;
}): ModelList => ({
  defaultModelId,
  items: models.map((model) => toModelDto(model, resolveText)),
});
