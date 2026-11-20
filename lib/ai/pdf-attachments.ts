import type { ChatMessage } from "../types";
import { supportsPdfInput } from "./models";

const PDF_MEDIA_TYPE = "application/pdf";

type ChatMessagePart = ChatMessage["parts"][number];

const isPdfFilePart = (part: ChatMessagePart): boolean =>
  part.type === "file" &&
  (part as { mediaType?: string }).mediaType === PDF_MEDIA_TYPE;

const nameOf = (part: ChatMessagePart): string => {
  const { filename } = part as { filename?: string };
  return filename ? ` "${filename}"` : "";
};

// A PDF the user just attached: the model must say it cannot read it.
const buildCurrentPdfNote = (part: ChatMessagePart): string =>
  `[PDF${nameOf(part)} was not passed to you: this model does not read PDF ` +
  "files. Tell the user you cannot read it and suggest pasting the text or " +
  "attaching images of the pages.]";

// A PDF from an earlier turn: a plain placeholder, so the model does not
// repeat the warning on every later turn.
const buildHistoricPdfNote = (part: ChatMessagePart): string =>
  `[PDF${nameOf(part)} omitted: this model does not read PDF files]`;

/**
 * Replace every PDF file part, anywhere in the history, with a text note for a
 * model that rejects PDFs, so a chat that already holds a PDF keeps working
 * after the user switches to such a model. A PDF in the current user message
 * (the last message) gets a note that asks the model to tell the user; earlier
 * ones get a neutral placeholder. Only the model-facing copy changes: the
 * stored message keeps its file part, so the UI still shows the chip.
 */
export const replacePdfPartsWithNote = (
  messages: ChatMessage[]
): ChatMessage[] =>
  messages.map((message, index) => {
    if (!message.parts.some(isPdfFilePart)) {
      return message;
    }

    const isCurrentUserMessage =
      index === messages.length - 1 && message.role === "user";
    const buildNote = isCurrentUserMessage
      ? buildCurrentPdfNote
      : buildHistoricPdfNote;
    const parts = message.parts.map(
      (part): ChatMessagePart =>
        isPdfFilePart(part) ? { type: "text", text: buildNote(part) } : part
    );

    return { ...message, parts };
  });

/** The messages as the model should see them: no PDF parts if it rejects them. */
export const omitUnsupportedPdfs = (
  messages: ChatMessage[],
  modelId: string
): ChatMessage[] =>
  supportsPdfInput(modelId) ? messages : replacePdfPartsWithNote(messages);
