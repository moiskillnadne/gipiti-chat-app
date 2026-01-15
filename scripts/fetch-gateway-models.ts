import { createGateway } from "@ai-sdk/gateway";
import "dotenv/config";

type ModelType = "language" | "embedding" | "image";

type GatewayModel = {
  id: string;
  name: string;
  description?: string;
  modelType: ModelType;
  pricing?: {
    input: string;
    output: string;
  };
};

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
  --type <type>       Filter by model type (language, embedding, image)
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
    `  ${padRight("ID", 35)} ${padRight("Name", 25)} ${padRight("Context", 10)} ${padRight("Max Out", 10)} ${padRight("Input Price", 12)}`
  );
  console.log(`  ${divider}`);

  for (const model of models) {
    const id = padRight(model.id, 35);
    const name = padRight(model.name || "N/A", 25);
    const context = padRight("N/A", 10);
    const maxOut = padRight("N/A", 10);
    const inputPrice = padRight(formatPrice(model.pricing?.input), 12);

    console.log(`  ${id} ${name} ${context} ${maxOut} ${inputPrice}`);
  }
};

const groupModelsByType = (
  models: GatewayModel[]
): Record<ModelType, GatewayModel[]> => {
  const groups: Record<ModelType, GatewayModel[]> = {
    language: [],
    embedding: [],
    image: [],
  };

  for (const model of models) {
    const type = model.modelType || "language";
    if (groups[type]) {
      groups[type].push(model);
    }
  }

  return groups;
};

const main = async () => {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    console.error("Error: AI_GATEWAY_API_KEY environment variable is not set");
    console.error("\nSet it in your .env.local file or pass it inline:");
    console.error("  AI_GATEWAY_API_KEY=your_key pnpm models:list");
    process.exit(1);
  }

  console.log("\nFetching models from Vercel AI Gateway...");

  try {
    const gateway = createGateway({ apiKey });
    const { models } = await gateway.getAvailableModels();

    const gatewayModels: GatewayModel[] = models.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description ?? undefined,
      modelType: m.modelType as ModelType,
      pricing: m.pricing
        ? {
            input: m.pricing.input,
            output: m.pricing.output,
          }
        : undefined,
    }));

    const filteredModels = filterModels(gatewayModels, options);

    console.log(`\n${"═".repeat(100)}`);
    console.log("  VERCEL AI GATEWAY MODELS");
    console.log(
      `  Total: ${filteredModels.length} models${options.provider ? ` (provider: ${options.provider})` : ""}${options.type ? ` (type: ${options.type})` : ""}`
    );
    console.log(`${"═".repeat(100)}`);

    if (options.type) {
      printTable(filteredModels, options.type.toUpperCase());
    } else {
      const grouped = groupModelsByType(filteredModels);

      if (grouped.language.length > 0) {
        printTable(grouped.language, "LANGUAGE MODELS");
      }
      if (grouped.embedding.length > 0) {
        printTable(grouped.embedding, "EMBEDDING MODELS");
      }
      if (grouped.image.length > 0) {
        printTable(grouped.image, "IMAGE MODELS");
      }
    }

    console.log(`\n${"═".repeat(100)}\n`);
  } catch (error) {
    console.error("Error fetching models:", error);
    process.exit(1);
  }
};

main();
