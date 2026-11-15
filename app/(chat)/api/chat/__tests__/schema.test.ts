import { describe, expect, it } from "vitest";

import { chatModelIds } from "@/lib/ai/models";
import { postRequestBodySchema } from "../schema";

const CHAT_ID = "3f0b2c1e-6f0a-4d53-9f0e-1c2d3e4f5a6b";
const MESSAGE_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

const bodyWithFileUrl = (url: string): unknown => ({
  id: CHAT_ID,
  message: {
    id: MESSAGE_ID,
    role: "user",
    parts: [
      { type: "file", mediaType: "text/plain", name: "notes.txt", url },
      { type: "text", text: "Summarize" },
    ],
  },
  selectedChatModel: chatModelIds[0],
});

describe("postRequestBodySchema file part url", () => {
  it("accepts an attachment stored in Vercel Blob", () => {
    const result = postRequestBodySchema.safeParse(
      bodyWithFileUrl("https://store.public.blob.vercel-storage.com/notes.txt")
    );

    expect(result.success).toBe(true);
  });

  it.each([
    ["an internal address", "http://169.254.169.254/latest/meta-data/"],
    ["a foreign host", "https://example.com/notes.txt"],
    ["a data URL", "data:text/plain;base64,aGk="],
  ])("rejects %s", (_label, url) => {
    const result = postRequestBodySchema.safeParse(bodyWithFileUrl(url));

    expect(result.success).toBe(false);
  });
});
