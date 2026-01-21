# Adding New AI Models

This guide explains how to add new AI models to the application. Follow these steps to ensure consistent integration across all system components.

## Quick Reference Checklist

When adding a new model, modify these files in order:

| # | File | Purpose |
|---|------|---------|
| 1 | `lib/ai/models.ts` | Model definition + model ID array |
| 2 | `lib/ai/providers.ts` | Gateway provider mapping |
| 3 | `lib/ai/entitlements.ts` | User access entitlements |
| 4 | `lib/subscription/subscription-tiers.ts` | Subscription tier access |
| 5 | `messages/en.json` | English translations |
| 6 | `messages/ru.json` | Russian translations |

---

## Step 1: Model Definition (`lib/ai/models.ts`)

### 1.1 Add to `chatModels` Array

Add your model definition to the `chatModels` array:

```typescript
{
  id: "model-id",                    // Internal identifier (kebab-case)
  name: "modelId.name",              // i18n key for display name
  description: "modelId.description", // i18n key for description
  provider: "anthropic",             // "openai" | "google" | "anthropic" | "xai"
  capabilities: {
    reasoning: true,                 // Supports extended thinking
    attachments: true,               // Supports file uploads
    imageGeneration: false,          // Can generate images
  },
  showInUI: true,                    // Show in model selector dropdown
  thinkingConfig: OPUS_THINKING_CONFIG, // Optional: thinking configuration
  providerOptions: {},               // Optional: provider-specific options
},
```

### 1.2 Update Provider Model ID Array

Add the model ID to the appropriate provider array:

```typescript
// For Anthropic models
export const anthropicModelIds = ["opus-4.1", "opus-4.5", "sonnet-4.5", "new-model"] as const;

// For OpenAI models
export const openaiModelIds = ["gpt-5.2", "gpt-5.2-pro", "gpt-5-mini", "new-model"] as const;

// For Google models
export const googleModelIds = ["gemini-3-pro", "new-model"] as const;
```

---

## Step 2: Provider Configuration (`lib/ai/providers.ts`)

Add the gateway mapping in the `languageModels` object:

### For Reasoning Models (with `<think>` tag extraction)

```typescript
"model-id": wrapLanguageModel({
  model: gateway.languageModel("provider/model-name"),
  middleware: extractReasoningMiddleware({ tagName: "think" }),
}),
```

### For Non-Reasoning Models

```typescript
"model-id": gateway.languageModel("provider/model-name"),
```

### Gateway Model ID Patterns

| Provider | Pattern | Example |
|----------|---------|---------|
| Anthropic | `anthropic/claude-{model-name}` | `anthropic/claude-sonnet-4.5` |
| OpenAI | `openai/{model-name}` | `openai/gpt-5.2` |
| Google | `google/{model-name}` | `google/gemini-3-pro-preview` |
| XAI | `xai/{model-name}` | `xai/grok-4-1-fast-reasoning` |

---

## Step 3: User Entitlements (`lib/ai/entitlements.ts`)

Add the model ID to `availableChatModelIds` for the `regular` user type:

```typescript
regular: {
  maxMessagesPerDay: 100,
  availableChatModelIds: [
    // ... existing models
    "new-model-id",
  ],
},
```

---

## Step 4: Subscription Tiers (`lib/subscription/subscription-tiers.ts`)

Add the model ID to `features.allowedModels` in each subscription tier that should have access:

```typescript
allowedModels: [
  "gpt-5.1-instant",
  "gpt-5.1-thinking",
  "gpt-5.2",
  "gpt-5.2-pro",
  "gemini-3-pro",
  "opus-4.5",
  "sonnet-4.5",
  "new-model-id",  // Add here
],
```

### Current Tiers

| Tier | Location |
|------|----------|
| tester | lines 45-52 |
| tester_paid | lines 80-87 |
| basic_monthly | lines 115-122 |
| basic_quarterly | lines 149-156 |
| basic_annual | lines 182-189 |

---

## Step 5: Translations

### English (`messages/en.json`)

Add to the `modelList` section:

```json
"modelId": {
  "name": "Model Display Name",
  "description": "Brief description of the model's capabilities."
}
```

### Russian (`messages/ru.json`)

Add to the `modelList` section:

```json
"modelId": {
  "name": "Название Модели",
  "description": "Краткое описание возможностей модели."
}
```

### Translation Key Convention

- Use camelCase without dots or dashes: `sonnet45`, `gpt52Pro`
- Keep descriptions concise (under 100 characters)

---

## Thinking Configuration

### Types of Thinking Config

#### Effort-Based (Anthropic, OpenAI, Google)

```typescript
const THINKING_CONFIG: ThinkingEffortConfig = {
  type: "effort",
  values: ["low", "medium", "high"] as const,
  default: "high",
};
```

#### Budget-Based (Token limit)

```typescript
const THINKING_CONFIG: ThinkingBudgetConfig = {
  type: "budget",
  presets: [
    { value: 1024, label: "Light" },
    { value: 4096, label: "Medium" },
    { value: 16384, label: "Deep" },
  ] as const,
  default: 4096,
};
```

### Existing Configs

| Config | Values | Default | Used By |
|--------|--------|---------|---------|
| `OPUS_THINKING_CONFIG` | low, medium, high | high | opus-4.5, sonnet-4.5 |
| `GPT52_THINKING_CONFIG` | none, medium, high | medium | gpt-5.2 |
| `GEMINI3_THINKING_CONFIG` | low, high | low | gemini-3-pro |

---

## Capability Flags

| Capability | Purpose |
|------------|---------|
| `reasoning` | Model supports extended thinking with `<think>` tags |
| `attachments` | Model can process file uploads (images, PDFs) |
| `imageGeneration` | Model can generate images |

---

## Provider-Specific Options

### Google Image Generation

```typescript
providerOptions: {
  google: {
    mediaResolution: "MEDIA_RESOLUTION_HIGH",
    imageConfig: {
      imageSize: "2K",
      aspectRatio: "16:9",
    },
  },
},
```

### OpenAI Image Generation

```typescript
providerOptions: {
  openai: {
    imageSize: "1024x1024",
    imageQuality: "hd",
  },
},
```

---

## Testing Checklist

After adding a new model, verify:

- [ ] `pnpm dev` - Application starts without errors
- [ ] Model appears in the model selector dropdown
- [ ] `isProviderModel("model-id")` returns `true` (e.g., `isAnthropicModel`)
- [ ] Thinking settings appear (if `thinkingConfig` is set)
- [ ] File attachments work (if `attachments: true`)
- [ ] Reasoning blocks are displayed (if `reasoning: true`)
- [ ] Token usage is tracked in database
- [ ] Translations display correctly in EN and RU
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes

### Manual Test Flow

1. Start dev server: `pnpm dev`
2. Login to the application
3. Open model selector dropdown
4. Verify new model appears with correct name/description
5. Select the new model
6. If reasoning model: verify thinking effort slider appears
7. Send a test message
8. Verify response streams correctly
9. Check thinking blocks display (if applicable)
10. Check database for token usage entry

---

## Troubleshooting

### Model Not Appearing in Dropdown

1. Check `showInUI: true` in model definition
2. Verify model is in `entitlementsByUserType.regular.availableChatModelIds`
3. Verify model is in subscription tier's `allowedModels`

### Thinking Settings Not Appearing

1. Verify `thinkingConfig` is set in model definition
2. Check `supportsThinkingConfig(modelId)` returns `true`

### Gateway Connection Errors

1. Verify gateway model ID is correct
2. Check Vercel AI Gateway dashboard for model availability
3. Ensure API keys are configured for the provider

### Token Costs Not Tracked

1. TokenLens may not recognize new models immediately
2. Costs will be `null` but usage (tokens) will still be recorded
3. Update TokenLens or wait for catalog refresh

---

## Example: Adding a New Anthropic Model

### 1. models.ts

```typescript
// Add to chatModels array
{
  id: "haiku-4.5",
  name: "haiku45.name",
  description: "haiku45.description",
  provider: "anthropic",
  capabilities: {
    reasoning: false,
    attachments: true,
  },
  showInUI: true,
},

// Update anthropicModelIds
export const anthropicModelIds = ["opus-4.1", "opus-4.5", "sonnet-4.5", "haiku-4.5"] as const;
```

### 2. providers.ts

```typescript
"haiku-4.5": gateway.languageModel("anthropic/claude-haiku-4.5"),
```

### 3. entitlements.ts

```typescript
availableChatModelIds: [
  // ... existing models
  "haiku-4.5",
],
```

### 4. subscription-tiers.ts

```typescript
// Add to all relevant tiers
allowedModels: [
  // ... existing models
  "haiku-4.5",
],
```

### 5. messages/en.json

```json
"haiku45": {
  "name": "Haiku 4.5",
  "description": "Anthropic's fastest model for simple tasks."
}
```

### 6. messages/ru.json

```json
"haiku45": {
  "name": "Haiku 4.5",
  "description": "Самая быстрая модель Anthropic для простых задач."
}
```

---

## Related Files

- `lib/ai/models.ts` - Model definitions and helpers
- `lib/ai/providers.ts` - Gateway provider configuration
- `lib/ai/entitlements.ts` - User access control
- `lib/subscription/subscription-tiers.ts` - Subscription tier configuration
- `lib/ai/token-quota.ts` - Token usage tracking
- `messages/*.json` - Translation files
