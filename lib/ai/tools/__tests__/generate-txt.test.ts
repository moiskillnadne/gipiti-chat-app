import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted above imports, so the mocks it references must be too.
const { putMock, saveDocumentMock } = vi.hoisted(() => ({
  putMock: vi.fn(),
  saveDocumentMock: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({ put: putMock }));
vi.mock("@/lib/ai/watermark", () => ({ applyImageWatermark: vi.fn() }));
vi.mock("../../../db/query/document/save-document", () => ({
  saveDocument: saveDocumentMock,
}));

import { generateTxtTool } from "../generate-txt";

const GENERATED_TXT_FILENAME = /^generated-.+\.txt$/;

type ToolExecute = (
  input: { title: string; content: string },
  options: { toolCallId: string; messages: [] }
) => Promise<{ id: string; txtUrl: string | undefined; title: string }>;

const runTool = (input: { title: string; content: string }) => {
  const txtTool = generateTxtTool({ userId: "user-1", chatId: "chat-1" });
  return (txtTool.execute as unknown as ToolExecute)(input, {
    toolCallId: "call-1",
    messages: [],
  });
};

describe("generateTxtTool", () => {
  beforeEach(() => {
    putMock.mockReset();
    saveDocumentMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {
      // Silence the expected "Failed to generate" log in the failure case.
    });
  });

  it("uploads the content verbatim as a UTF-8 .txt blob and records the document", async () => {
    putMock.mockResolvedValue({ url: "https://blob.example/generated.txt" });
    saveDocumentMock.mockResolvedValue([]);
    const content = "Список покупок\n\n1. Хлеб\n2. Молоко\n";

    const result = await runTool({ title: "Покупки", content });

    expect(putMock).toHaveBeenCalledTimes(1);
    const [filename, body, options] = putMock.mock.calls[0];
    expect(filename).toMatch(GENERATED_TXT_FILENAME);
    expect(Buffer.from(body).toString("utf8")).toBe(content);
    expect(options).toEqual({
      access: "public",
      contentType: "text/plain; charset=utf-8",
    });
    expect(saveDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.id,
        title: "Покупки",
        kind: "txt",
        content: "https://blob.example/generated.txt",
        userId: "user-1",
      })
    );
    expect(result.txtUrl).toBe("https://blob.example/generated.txt");
  });

  it("returns an undefined url instead of throwing when the upload fails", async () => {
    putMock.mockRejectedValue(new Error("blob down"));

    const result = await runTool({ title: "notes", content: "hello" });

    expect(result.txtUrl).toBeUndefined();
    expect(result.title).toBe("notes");
    expect(saveDocumentMock).not.toHaveBeenCalled();
  });
});
