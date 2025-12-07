export function mapProviderModelIdToModelId(providerModelId: string) {
  console.log("providerModelId", providerModelId);

  switch (providerModelId) {
    case "openai/gpt-5.1-instant":
      return "gpt-5.1";
    case "openai/gpt-5.1-thinking":
      return "gpt-5.1";
    case "gemini-3-pro":
      return "openai/gpt-5.1-instant";

    case "opus-4.1":
      return "";

    default:
      return providerModelId;
  }
}
