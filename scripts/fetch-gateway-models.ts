import { z } from "zod";

// The public catalog needs no API key. It is read directly because the
// installed @ai-sdk/gateway validates `modelType` with a closed enum and
// rejects the newer types (evaluation, realtime, extraction, reranking, speech,
// transcription), so `getAvailableModels()` throws on the live catalog.
const GATEWAY_MODELS_URL = "https://ai-gateway.vercel.sh/v1/models";

// Open on purpose: a type the gateway adds later must not break the script.
type ModelType = string;

const gatewayModelSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  type: z.string(),
  context_window: z.number().optional(),
  max_tokens: z.number().optional(),
  tags: z.array(z.string()).optional(),
  // Present on language models; image and video models price differently.
  pricing: z
    .object({
      input: z.string().optional(),
      output: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

const gatewayResponseSchema = z.object({
  data: z.array(gatewayModelSchema),
});

type GatewayModel = {
  id: string;
  name: string;
  description?: string;
  modelType: ModelType;
  tags: string[];
  contextWindow?: number;
  maxOutputTokens?: number;
  pricing?: {
    input?: string;
    output?: string;
  };
};

// Types printed first, in this order; any other type follows alphabetically.
const PREFERRED_TYPE_ORDER: ModelType[] = [
  "language",
  "embedding",
  "image",
  "video",
];

type FilterOptions = {
  provider?: string;
  type?: ModelType;
  tag?: string;
};

const parseArgs = (): FilterOptions & { help: boolean } => {
  const args = process.argv.slice(2);
  const options: FilterOptions & { help: boolean } = { help: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--provider":
        options.provider = nextArg;
        i++;
        break;
      case "--type":
        options.type = nextArg as ModelType;
        i++;
        break;
      case "--tag":
        options.tag = nextArg;
        i++;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        break;
    }
  }

  return options;
};

const showHelp = () => {
  console.log(`
Usage: pnpm models:list [options]

Options:
  --provider <name>   Filter by provider (openai, anthropic, google, xai, meta, etc.)
  --type <type>       Filter by model type (language, embedding, image, video, ...)
  --tag <tag>         Filter by capability tag (reasoning, vision, tool-use, file-input)
  --help, -h          Show this help message

Examples:
  pnpm models:list
  pnpm models:list -- --provider openai
  pnpm models:list -- --type language
  pnpm models:list -- --tag reasoning
  pnpm models:list -- --provider google --type language
`);
};

const filterModels = (
  models: GatewayModel[],
  options: FilterOptions
): GatewayModel[] => {
  return models.filter((model) => {
    if (options.provider && !model.id.startsWith(`${options.provider}/`)) {
      return false;
    }
    if (options.type && model.modelType !== options.type) {
      return false;
    }
    if (options.tag && !model.tags.includes(options.tag)) {
      return false;
    }
    return true;
  });
};

const formatPrice = (price: string | undefined): string => {
  if (!price) {
    return "N/A";
  }
  const num = Number.parseFloat(price);
  if (Number.isNaN(num)) {
    return "N/A";
  }
  const perThousand = num * 1000;
  if (perThousand < 0.001) {
    return `$${(num * 1_000_000).toFixed(3)}/M`;
  }
  return `$${perThousand.toFixed(4)}/K`;
};

// The catalog reports 0 for models without a token window (image, video).
const formatTokenCount = (tokens: number | undefined): string => {
  if (!tokens) {
    return "N/A";
  }
  return tokens >= 1_000_000
    ? `${(tokens / 1_000_000).toFixed(1)}M`
    : `${Math.round(tokens / 1000)}K`;
};

const padRight = (str: string, length: number): string => {
  return str.length >= length
    ? str.slice(0, length)
    : str + " ".repeat(length - str.length);
};

const printTable = (models: GatewayModel[], title: string) => {
  const divider = "─".repeat(100);
  const headerDivider = "═".repeat(100);

  console.log(`\n${headerDivider}`);
  console.log(`  ${title} (${models.length} models)`);
  console.log(headerDivider);

  if (models.length === 0) {
    console.log("  No models found matching the criteria");
    return;
  }

  console.log(
    `  ${padRight("ID", 48)} ${padRight("Name", 25)} ${padRight("Context", 10)} ${padRight("Max Out", 10)} ${padRight("Input Price", 12)}`
  );
  console.log(`  ${divider}`);

  for (const model of models) {
    const id = padRight(model.id, 48);
    const name = padRight(model.name || "N/A", 25);
    const context = padRight(formatTokenCount(model.contextWindow), 10);
    const maxOut = padRight(formatTokenCount(model.maxOutputTokens), 10);
    const inputPrice = padRight(formatPrice(model.pricing?.input), 12);

    console.log(`  ${id} ${name} ${context} ${maxOut} ${inputPrice}`);
  }
};

const groupModelsByType = (
  models: GatewayModel[]
): Map<ModelType, GatewayModel[]> => {
  const groups = new Map<ModelType, GatewayModel[]>();

  for (const model of models) {
    const group = groups.get(model.modelType) ?? [];
    group.push(model);
    groups.set(model.modelType, group);
  }

  const orderOf = (type: ModelType): number => {
    const index = PREFERRED_TYPE_ORDER.indexOf(type);
    return index === -1 ? PREFERRED_TYPE_ORDER.length : index;
  };

  return new Map(
    [...groups.entries()].sort(
      ([typeA], [typeB]) =>
        orderOf(typeA) - orderOf(typeB) || typeA.localeCompare(typeB)
    )
  );
};

const fetchGatewayModels = async (): Promise<GatewayModel[]> => {
  const response = await fetch(GATEWAY_MODELS_URL);
  if (!response.ok) {
    throw new Error(
      `AI Gateway returned ${response.status} ${response.statusText} for ${GATEWAY_MODELS_URL}`
    );
  }

  const parsed = gatewayResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error(
      `Unexpected AI Gateway catalog shape: ${parsed.error.message}`
    );
  }

  return parsed.data.data.map((model) => ({
    id: model.id,
    name: model.name ?? model.id,
    description: model.description,
    modelType: model.type,
    tags: model.tags ?? [],
    contextWindow: model.context_window,
    maxOutputTokens: model.max_tokens,
    pricing: model.pricing
      ? { input: model.pricing.input, output: model.pricing.output }
      : undefined,
  }));
};

const main = async () => {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  console.log("\nFetching models from Vercel AI Gateway...");

  try {
    const gatewayModels = await fetchGatewayModels();

    const filteredModels = filterModels(gatewayModels, options);

    console.log(`\n${"═".repeat(100)}`);
    console.log("  VERCEL AI GATEWAY MODELS");
    console.log(
      `  Total: ${filteredModels.length} models${options.provider ? ` (provider: ${options.provider})` : ""}${options.type ? ` (type: ${options.type})` : ""}${options.tag ? ` (tag: ${options.tag})` : ""}`
    );
    console.log(`${"═".repeat(100)}`);

    if (options.type) {
      printTable(filteredModels, options.type.toUpperCase());
    } else {
      for (const [type, models] of groupModelsByType(filteredModels)) {
        printTable(models, `${type.toUpperCase()} MODELS`);
      }
    }

    console.log(`\n${"═".repeat(100)}\n`);
  } catch (error) {
    console.error("Error fetching models:", error);
    process.exit(1);
  }
};

main();
