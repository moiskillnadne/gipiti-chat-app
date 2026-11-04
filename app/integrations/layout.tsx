import type { Metadata } from "next";
import { getTranslations } from "@/lib/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("integrations.page");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
