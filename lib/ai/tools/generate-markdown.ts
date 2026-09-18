import { tool } from "ai";
import z from "zod/v4";
import { saveDocument } from "../../db/query/document/save-document";
import { generateUUID } from "../../utils";
import { uploadGeneratedMarkdown } from "../media-upload";

type GenerateMarkdownProps = {
  userId: string;
  chatId: string;
};

export const generateMarkdownTool = ({ userId }: GenerateMarkdownProps) =>
  tool({
    description: `Generate a downloadable Markdown (.md) file, OR produce an updated version of a .md file already in the conversation.

Use this tool when:
- The user explicitly asks to create, make, generate, export, save, or download a Markdown / .md file (e.g. "сделай md", "сохрани в markdown", "экспортируй в .md", "create a README.md").
- The user wants written content delivered as a Markdown file rather than as a chat reply — notes, README, documentation, a spec, a changelog.
- The user asks to modify, update, extend, or rewrite a .md file that is already in the conversation — one they uploaded or one you generated earlier — and wants the updated file back.

Prefer generatePdf or generateDocx when the user asks specifically for a PDF or Word document. Do NOT use this tool when:
- The user just wants an answer in chat and did not ask for a file. Markdown formatting in a normal reply does not require this tool.
- The user wants to read, summarize, or analyze an attached .md file without producing a new file — answer directly instead.

How to author the file:
- Pass the complete file body in "content" as GitHub-Flavored Markdown. It is written to the file verbatim, so include everything: headings, lists, tables, code fences, links, images, front matter if the user needs it.
- Write in the same language as the user. Cyrillic and other non-Latin text are preserved as UTF-8.
- Pass a short, human-readable file name in "title" (without the .md extension).

Updating an existing file:
- Reproduce the ENTIRE file in "content" with ONLY the requested changes applied. Keep everything the user did not ask to change exactly as it was — structure, wording, and formatting. Never return just the changed fragment; always emit the complete updated file.`,
    inputSchema: z.object({
      title: z
        .string()
        .describe("Short, human-readable file name without the .md extension."),
      content: z
        .string()
        .describe(
          "The full file body as GitHub-Flavored Markdown. When updating an existing file, include the entire file, not just the changes."
        ),
    }),
    execute: async ({ title, content }) => {
      const id = generateUUID();
      try {
        const markdownUrl = await uploadGeneratedMarkdown(content);

        await saveDocument({
          id,
          title,
          content: markdownUrl,
          kind: "markdown",
          userId,
        });

        return {
          id,
          markdownUrl,
          title,
          content: "Markdown file was generated and uploaded successfully.",
        };
      } catch (error) {
        console.error("Failed to generate Markdown file", error);
        return {
          id,
          markdownUrl: undefined as string | undefined,
          title,
          content: "Failed to generate the Markdown file.",
        };
      }
    },
  });

export const generateMarkdown = generateMarkdownTool;
