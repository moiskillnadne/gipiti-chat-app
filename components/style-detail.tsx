"use client";

import type { TextStyle } from "@/lib/db/schema";

import { EditorV1 } from "./styles-projects/editor-v1";

export function StyleDetail({ initialStyle }: { initialStyle: TextStyle }) {
  return <EditorV1 initialEntity={initialStyle} kind="style" />;
}
