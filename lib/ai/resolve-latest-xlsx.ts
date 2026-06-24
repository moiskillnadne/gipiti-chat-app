import type { ChatMessage } from "@/lib/types";
import { XLSX_MIME_TYPE } from "./xlsx-extract";

/**
 * Find the URL of the most recent spreadsheet in a conversation, scanning
 * newest→oldest. Resolves an .xlsx from any of the ways one can enter history:
 *  - a `file` attachment the user uploaded (the XLSX MIME type)
 *  - a workbook produced by the `generateXlsx` tool
 *  - a workbook produced by the `updateXlsx` tool
 *
 * The `updateXlsx` tool uses this as "the spreadsheet the user is referring to
 * right now" to load and edit it round-trip. Returns undefined when the
 * conversation has no spreadsheet.
 */
export function resolveLatestXlsxUrl(
  messages: ChatMessage[]
): string | undefined {
  for (const message of [...messages].reverse()) {
    for (const part of [...message.parts].reverse()) {
      if (part.type === "file" && part.mediaType === XLSX_MIME_TYPE) {
        return part.url;
      }

      if (
        part.type === "tool-generateXlsx" &&
        part.state === "output-available" &&
        part.output?.xlsxUrl
      ) {
        return part.output.xlsxUrl;
      }

      if (
        part.type === "tool-updateXlsx" &&
        part.state === "output-available" &&
        part.output?.xlsxUrl
      ) {
        return part.output.xlsxUrl;
      }
    }
  }

  return;
}
