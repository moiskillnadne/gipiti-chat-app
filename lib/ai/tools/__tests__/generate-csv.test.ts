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

import { generateCsvTool } from "../generate-csv";

const GENERATED_CSV_FILENAME = /^generated-.+\.csv$/;
const UTF8_BOM = "﻿";

type ToolExecute = (
  input: { title: string; content: string },
  options: { toolCallId: string; messages: [] }
) => Promise<{ id: string; csvUrl: string | undefined; title: string }>;

const runTool = (input: { title: string; content: string }) => {
  const csvTool = generateCsvTool({ userId: "user-1", chatId: "chat-1" });
  return (csvTool.execute as unknown as ToolExecute)(input, {
    toolCallId: "call-1",
    messages: [],
  });
};

describe("generateCsvTool", () => {
  beforeEach(() => {
    putMock.mockReset();
    saveDocumentMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {
      // Silence the expected "Failed to generate" log in the failure case.
    });
  });

  it("uploads the CSV as UTF-8 with BOM under text/csv and records the document", async () => {
    putMock.mockResolvedValue({ url: "https://blob.example/generated.csv" });
    saveDocumentMock.mockResolvedValue([]);
    const content =
      'name,price\n"Ноутбук 15"" Pro",129999\n"Мышь, беспроводная",2499\n';

    const result = await runTool({ title: "Товары", content });

    expect(putMock).toHaveBeenCalledTimes(1);
    const [filename, body, options] = putMock.mock.calls[0];
    expect(filename).toMatch(GENERATED_CSV_FILENAME);
    expect(Buffer.from(body).toString("utf8")).toBe(`${UTF8_BOM}${content}`);
    expect(options).toEqual({
      access: "public",
      contentType: "text/csv; charset=utf-8",
    });
    expect(saveDocumentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.id,
        title: "Товары",
        kind: "csv",
        content: "https://blob.example/generated.csv",
        userId: "user-1",
      })
    );
    expect(result.csvUrl).toBe("https://blob.example/generated.csv");
  });

  it("returns an undefined url instead of throwing when the upload fails", async () => {
    putMock.mockRejectedValue(new Error("blob down"));

    const result = await runTool({ title: "table", content: "a,b\n1,2\n" });

    expect(result.csvUrl).toBeUndefined();
    expect(result.title).toBe("table");
    expect(saveDocumentMock).not.toHaveBeenCalled();
  });
});
