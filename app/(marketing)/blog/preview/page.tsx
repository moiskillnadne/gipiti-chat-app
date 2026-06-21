import type { Metadata } from "next";
import { BlogPreviewTool } from "@/components/blog/preview/blog-preview-tool";

export const metadata: Metadata = {
  title: { absolute: "Превью статьи — Блог GIPITI" },
  // Author tool: never index, and proxy.ts additionally gates it behind a secret.
  robots: { index: false, follow: false },
};

export default function BlogPreviewPage() {
  return <BlogPreviewTool />;
}
