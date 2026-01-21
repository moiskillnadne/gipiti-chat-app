"use client";

import { cpp } from "@codemirror/lang-cpp";
import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import type { Extension } from "@codemirror/state";
import { EditorState, Transaction } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { memo, useEffect, useRef } from "react";
import type { Suggestion } from "@/lib/db/schema";

type SupportedLanguage =
  | "python"
  | "javascript"
  | "typescript"
  | "java"
  | "go"
  | "rust"
  | "c"
  | "cpp"
  | "html"
  | "css"
  | "sql"
  | "json"
  | "yaml"
  | "markdown";

const languageExtensions: Record<SupportedLanguage, () => Extension> = {
  python: () => python(),
  javascript: () => javascript(),
  typescript: () => javascript({ typescript: true }),
  java: () => java(),
  go: () => go(),
  rust: () => rust(),
  c: () => cpp(),
  cpp: () => cpp(),
  html: () => html(),
  css: () => css(),
  sql: () => sql(),
  json: () => json(),
  yaml: () => yaml(),
  markdown: () => markdown(),
};

const getLanguageExtension = (language: string): Extension => {
  const normalizedLang = language.toLowerCase() as SupportedLanguage;
  const extensionFactory = languageExtensions[normalizedLang];
  return extensionFactory ? extensionFactory() : python();
};

type EditorProps = {
  content: string;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: "streaming" | "idle";
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  suggestions: Suggestion[];
  language?: string;
};

function PureCodeEditor({
  content,
  onSaveContent,
  status,
  language = "python",
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const languageRef = useRef(language);

  // Keep language ref updated
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const startState = EditorState.create({
        doc: content,
        extensions: [
          basicSetup,
          getLanguageExtension(languageRef.current),
          oneDark,
        ],
      });

      editorRef.current = new EditorView({
        state: startState,
        parent: containerRef.current,
      });
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
    // NOTE: we only want to run this effect once
    // eslint-disable-next-line
  }, [content]);

  // Update editor when language changes
  useEffect(() => {
    if (editorRef.current) {
      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const transaction = update.transactions.find(
            (tr) => !tr.annotation(Transaction.remote)
          );

          if (transaction) {
            const newContent = update.state.doc.toString();
            onSaveContent(newContent, true);
          }
        }
      });

      const currentSelection = editorRef.current.state.selection;

      const newState = EditorState.create({
        doc: editorRef.current.state.doc,
        extensions: [
          basicSetup,
          getLanguageExtension(language),
          oneDark,
          updateListener,
        ],
        selection: currentSelection,
      });

      editorRef.current.setState(newState);
    }
  }, [onSaveContent, language]);

  useEffect(() => {
    if (editorRef.current && content) {
      const currentContent = editorRef.current.state.doc.toString();

      if (status === "streaming" || currentContent !== content) {
        const transaction = editorRef.current.state.update({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: content,
          },
          annotations: [Transaction.remote.of(true)],
        });

        editorRef.current.dispatch(transaction);
      }
    }
  }, [content, status]);

  return (
    <div
      className="not-prose relative w-full pb-[calc(80dvh)] text-sm"
      ref={containerRef}
    />
  );
}

function areEqual(prevProps: EditorProps, nextProps: EditorProps) {
  if (prevProps.suggestions !== nextProps.suggestions) {
    return false;
  }
  if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex) {
    return false;
  }
  if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) {
    return false;
  }
  if (prevProps.status === "streaming" && nextProps.status === "streaming") {
    return false;
  }
  if (prevProps.content !== nextProps.content) {
    return false;
  }
  if (prevProps.language !== nextProps.language) {
    return false;
  }

  return true;
}

export const CodeEditor = memo(PureCodeEditor, areEqual);
