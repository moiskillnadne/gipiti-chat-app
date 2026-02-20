import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import {
  type ArtifactUsage,
  artifactKinds,
  documentHandlersByArtifactKind,
} from "@/lib/artifacts/server";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type CreateDocumentProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  modelId: string;
  onUsage?: (usage: ArtifactUsage) => void;
};

export const createDocument = ({
  session,
  dataStream,
  modelId,
  onUsage,
}: CreateDocumentProps) =>
  tool({
    description:
      "Create a document for writing or content creation activities. For code artifacts, you MUST specify the 'language' parameter with the programming language (e.g., 'javascript', 'typescript', 'python', 'java', 'go', 'rust'). The language determines syntax highlighting and execution capabilities.",
    inputSchema: z.object({
      title: z.string(),
      kind: z.enum(artifactKinds),
      language: z
        .string()
        .optional()
        .describe(
          "Programming language for code artifacts (e.g., python, javascript, typescript, java, go, rust, c, cpp, html, css, sql, json, yaml, markdown). Defaults to python if not specified."
        ),
    }),
    execute: async ({ title, kind, language }) => {
      const id = generateUUID();

      dataStream.write({
        type: "data-kind",
        data: kind,
        transient: true,
      });

      dataStream.write({
        type: "data-id",
        data: id,
        transient: true,
      });

      dataStream.write({
        type: "data-title",
        data: title,
        transient: true,
      });

      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === kind
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${kind}`);
      }

      await documentHandler.onCreateDocument({
        id,
        title,
        dataStream,
        session,
        language,
        modelId,
        onUsage,
      });

      dataStream.write({ type: "data-finish", data: null, transient: true });

      return {
        id,
        title,
        kind,
        content: "A document was created and is now visible to the user.",
      };
    },
  });
