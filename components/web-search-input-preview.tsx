import { GlobeIcon } from "lucide-react";
import { useTranslations } from "next-intl";

type Props = {
  query: string;
};

export const WebSearchInputPreview = ({ query }: Props) => {
  const t = useTranslations("chat.tools.webSearch");

  return (
    <div className="flex items-center gap-2 py-1 text-muted-foreground text-sm">
      <GlobeIcon className="size-4" />
      <span>{t("searching", { query })}</span>
    </div>
  );
};
