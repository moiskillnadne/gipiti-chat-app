import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "@/lib/i18n/translate";

type AccountPageTopNavProps = {
  backHref?: string;
  currentLabelKey: "projects";
};

export async function AccountPageTopNav({
  backHref = "/",
  currentLabelKey,
}: AccountPageTopNavProps) {
  const t = await getTranslations("accountNav");

  return (
    <nav
      className={[
        "sticky top-0 z-10 flex items-center gap-3.5",
        "border-rule border-b bg-paper/85 backdrop-blur-md",
        "px-10 py-[18px] max-md:px-5 max-md:py-3.5",
      ].join(" ")}
    >
      <Link
        className={[
          "inline-flex items-center gap-1.5",
          "font-mono text-[13px] text-ink-2 uppercase tracking-[0.06em]",
          "transition-colors duration-fast ease-canon hover:text-ink",
        ].join(" ")}
        href={backHref}
      >
        <ArrowLeft className="size-3" strokeWidth={1.8} />
        {t("back")}
      </Link>
      <span className="ml-2 text-[13px] text-ink-3">
        {t("account")}
        <span className="mx-1.5 text-ink-4">/</span>
        <span className="font-medium text-ink">{t(currentLabelKey)}</span>
      </span>
    </nav>
  );
}
