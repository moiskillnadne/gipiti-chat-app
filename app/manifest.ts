import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GIPITI — AI-чат с лучшими нейросетями",
    short_name: "GIPITI",
    description:
      "AI-чат с доступом к лучшим нейросетям: ChatGPT, Gemini, Claude и Grok. Генерация текста, изображений и видео, анализ документов.",
    lang: "ru",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#fafaf9",
    icons: [
      { src: "/icons/icon-128.png", sizes: "128x128", type: "image/png" },
      { src: "/icons/icon-256.png", sizes: "256x256", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
