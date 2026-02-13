"use client";

import { ImageIcon, MessageSquareIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import useSWR from "swr";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/utils";

type UsageLimitItem = {
  used: number;
  limit: number | null;
};

type UsageLimitsResponse = {
  messages: UsageLimitItem;
  webSearch: UsageLimitItem;
  imageGeneration: UsageLimitItem;
};

type LimitRowProps = {
  icon: ReactNode;
  label: string;
  item: UsageLimitItem;
  usedText: string;
  unlimitedText: string;
};

function LimitRow({
  icon,
  label,
  item,
  usedText,
  unlimitedText,
}: LimitRowProps) {
  const { limit } = item;
  const isLimited = limit !== null;
  const percentUsed =
    limit !== null && limit > 0 ? Math.min((item.used / limit) * 100, 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{label}</span>
        </div>
        <span className="text-muted-foreground text-sm">
          {isLimited ? usedText : unlimitedText}
        </span>
      </div>
      {isLimited && <Progress className="h-2" value={percentUsed} />}
    </div>
  );
}

export function UsageLimitsWidget() {
  const t = useTranslations("auth.subscription.limits");
  const { data, isLoading, error } = useSWR<UsageLimitsResponse>(
    "/api/usage-limits",
    fetcher,
    { revalidateOnFocus: false }
  );

  if (isLoading) {
    return <UsageLimitsWidgetSkeleton />;
  }

  if (error || !data) {
    return null;
  }

  const rows: Array<{
    key: string;
    icon: ReactNode;
    label: string;
    item: UsageLimitItem;
  }> = [
    {
      key: "messages",
      icon: <MessageSquareIcon className="h-4 w-4 text-muted-foreground" />,
      label: t("messages"),
      item: data.messages,
    },
    {
      key: "webSearch",
      icon: <SearchIcon className="h-4 w-4 text-muted-foreground" />,
      label: t("webSearch"),
      item: data.webSearch,
    },
    {
      key: "imageGeneration",
      icon: <ImageIcon className="h-4 w-4 text-muted-foreground" />,
      label: t("imageGeneration"),
      item: data.imageGeneration,
    },
  ];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map(({ key, icon, label, item }) => (
          <LimitRow
            icon={icon}
            item={item}
            key={key}
            label={label}
            unlimitedText={t("usedUnlimited", { used: item.used })}
            usedText={t("used", { used: item.used, limit: item.limit ?? 0 })}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function UsageLimitsWidgetSkeleton() {
  return (
    <Card className="mt-6">
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div className="space-y-2" key={i}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
