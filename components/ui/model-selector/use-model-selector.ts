"use client";

import { useCallback, useMemo, useState } from "react";

import {
  CAPABILITY_KEYS,
  getModelCapabilityFlags,
  type ModelCapabilityKey,
  modelMatchesCapabilities,
} from "@/lib/ai/model-capability";
import type { ChatModel, ModelProvider } from "@/lib/ai/models";
import type { TranslateFn } from "@/lib/i18n/translate";

export type GroupBy = "provider" | "capability";

export type ModelGroup = {
  key: string;
  kind: "provider" | "capability";
  providerKey?: ModelProvider;
  label: string;
  models: ChatModel[];
};

const PROVIDER_ORDER: ModelProvider[] = [
  "openai",
  "google",
  "anthropic",
  "xai",
  "bfl",
  "recraft",
];

const CAPABILITY_BUCKET_ORDER: ModelCapabilityKey[] = [
  "video",
  "image",
  "code",
  "text",
];

type UseModelSelectorArgs = {
  availableModels: ChatModel[];
  t: TranslateFn;
};

export function useModelSelector({ availableModels, t }: UseModelSelectorArgs) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<GroupBy>("provider");
  const [caps, setCaps] = useState<Set<ModelCapabilityKey>>(() => new Set());

  const toggleCap = useCallback((cap: ModelCapabilityKey) => {
    setCaps((prev) => {
      const next = new Set(prev);
      if (next.has(cap)) {
        next.delete(cap);
      } else {
        next.add(cap);
      }
      return next;
    });
  }, []);

  const clearCaps = useCallback(() => {
    setCaps(new Set());
  }, []);

  const filteredModels = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    return availableModels.filter((model) => {
      if (!modelMatchesCapabilities(model, caps)) {
        return false;
      }
      if (!trimmed) {
        return true;
      }
      const translatedName = t(model.name).toLowerCase();
      return translatedName.includes(trimmed);
    });
  }, [availableModels, caps, query, t]);

  const capCounts = useMemo(() => {
    const counts: Record<ModelCapabilityKey, number> = {
      text: 0,
      code: 0,
      image: 0,
      video: 0,
    };
    for (const model of availableModels) {
      const flags = getModelCapabilityFlags(model);
      for (const cap of CAPABILITY_KEYS) {
        if (flags[cap]) {
          counts[cap] += 1;
        }
      }
    }
    return counts;
  }, [availableModels]);

  const groups = useMemo<ModelGroup[]>(() => {
    if (group === "provider") {
      return buildProviderGroups(filteredModels, t);
    }
    return buildCapabilityGroups(filteredModels, t);
  }, [filteredModels, group, t]);

  const flatRows = useMemo(() => groups.flatMap((g) => g.models), [groups]);

  return {
    query,
    setQuery,
    group,
    setGroup,
    caps,
    toggleCap,
    clearCaps,
    filteredModels,
    capCounts,
    groups,
    flatRows,
    resetState: () => {
      setQuery("");
    },
  };
}

function buildProviderGroups(
  models: ChatModel[],
  t: TranslateFn
): ModelGroup[] {
  const buckets = new Map<string, ChatModel[]>();
  for (const model of models) {
    const provider = model.provider ?? "other";
    const list = buckets.get(provider);
    if (list) {
      list.push(model);
    } else {
      buckets.set(provider, [model]);
    }
  }

  const ordered: ModelGroup[] = [];
  for (const provider of PROVIDER_ORDER) {
    const list = buckets.get(provider);
    if (!list?.length) {
      continue;
    }
    ordered.push({
      key: provider,
      kind: "provider",
      providerKey: provider,
      label: t(`providers.${provider}`),
      models: list,
    });
    buckets.delete(provider);
  }

  for (const [providerKey, list] of buckets) {
    ordered.push({
      key: providerKey,
      kind: "provider",
      label: providerKey.toUpperCase(),
      models: list,
    });
  }

  return ordered;
}

function buildCapabilityGroups(
  models: ChatModel[],
  t: TranslateFn
): ModelGroup[] {
  const seen = new Set<string>();
  const groups: ModelGroup[] = [];
  for (const cap of CAPABILITY_BUCKET_ORDER) {
    const inGroup: ChatModel[] = [];
    for (const model of models) {
      if (seen.has(model.id)) {
        continue;
      }
      const flags = getModelCapabilityFlags(model);
      if (flags[cap]) {
        inGroup.push(model);
        seen.add(model.id);
      }
    }
    if (inGroup.length === 0) {
      continue;
    }
    groups.push({
      key: cap,
      kind: "capability",
      label: t(`groupBucket.${cap}`),
      models: inGroup,
    });
  }
  return groups;
}
