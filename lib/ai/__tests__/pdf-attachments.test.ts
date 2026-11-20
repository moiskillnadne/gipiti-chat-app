import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/types";
import {
  omitUnsupportedPdfs,
  replacePdfPartsWithNote,
} from "../pdf-attachments";

const PDF_URL = "https://store.public.blob.vercel-storage.com/report.pdf";

const buildMessage = (
  id: string,
  parts: ChatMessage["parts"]
): ChatMessage => ({ id, role: "user", parts });

const pdfPart = (filename?: string): ChatMessage["parts"][number] => ({
  type: "file",
  mediaType: "application/pdf",
  url: PDF_URL,
  ...(filename && { filename }),
});

const textOf = (part: ChatMessage["parts"][number]): string =>
  part.type === "text" ? part.text : "";

describe("replacePdfPartsWithNote", () => {
  it("asks the model to tell the user when the PDF is in the current message", () => {
    const history = [
      buildMessage("m1", [
        { type: "text", text: "Summarise this" },
        pdfPart("report.pdf"),
      ]),
    ];

    const [current] = replacePdfPartsWithNote(history);

    expect(textOf(current.parts[1])).toContain("report.pdf");
    expect(textOf(current.parts[1])).toContain("Tell the user");
    expect(JSON.stringify(current)).not.toContain(PDF_URL);
  });

  it("leaves a neutral placeholder, with no instruction, for an earlier PDF", () => {
    const history = [
      buildMessage("m1", [pdfPart("report.pdf")]),
      buildMessage("m2", [{ type: "text", text: "And now?" }]),
    ];

    const [earlier] = replacePdfPartsWithNote(history);

    expect(textOf(earlier.parts[0])).toBe(
      '[PDF "report.pdf" omitted: this model does not read PDF files]'
    );
    expect(JSON.stringify(earlier)).not.toContain(PDF_URL);
  });

  it("keeps images, text and unrelated files untouched", () => {
    const imagePart: ChatMessage["parts"][number] = {
      type: "file",
      mediaType: "image/png",
      url: "https://store.public.blob.vercel-storage.com/a.png",
    };
    const message = buildMessage("m1", [
      { type: "text", text: "Look" },
      imagePart,
    ]);

    const result = replacePdfPartsWithNote([message]);

    expect(result[0]).toBe(message);
  });

  it("does not mutate the stored messages", () => {
    const part = pdfPart();
    const message = buildMessage("m1", [part]);

    replacePdfPartsWithNote([message]);

    expect(message.parts[0]).toBe(part);
  });

  it("writes a note without a file name when the part has none", () => {
    const [result] = replacePdfPartsWithNote([buildMessage("m1", [pdfPart()])]);

    expect(textOf(result.parts[0])).not.toContain("undefined");
    expect(textOf(result.parts[0])).toContain("[PDF was not passed");
  });
});

describe("omitUnsupportedPdfs (real model registry)", () => {
  const history = (): ChatMessage[] => [
    buildMessage("m1", [pdfPart("report.pdf")]),
    buildMessage("m2", [{ type: "text", text: "Compare" }, pdfPart("b.pdf")]),
  ];

  it("removes every PDF part from the messages sent to qwen4-max", () => {
    const result = omitUnsupportedPdfs(history(), "qwen4-max");

    expect(
      result
        .flatMap((message) => message.parts)
        .some((part) => part.type === "file")
    ).toBe(false);
    expect(JSON.stringify(result)).not.toContain(PDF_URL);
  });

  it.each(["gpt-6.2-sol", "muse-ember"])(
    "passes the messages to %s untouched",
    (modelId) => {
      const messages = history();

      expect(omitUnsupportedPdfs(messages, modelId)).toBe(messages);
    }
  );
});
