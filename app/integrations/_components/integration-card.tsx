"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/translate";
import {
  connectBuiltinNoAuth,
  disconnectIntegration,
  refreshIntegrationTools,
} from "../actions";

export type IntegrationCardConnection = {
  id: string;
  status: "active" | "needs_reauth" | "needs_review" | "error";
  toolCount: number;
  toolTokenEstimate: number;
};

type IntegrationCardProps = {
  catalogId: string;
  connection?: IntegrationCardConnection;
};

export function IntegrationCard({
  catalogId,
  connection,
}: IntegrationCardProps) {
  const t = useTranslations("integrations.page");
  const tCatalog = useTranslations("integrations.catalog");
  const [isPending, startTransition] = useTransition();

  const run = (
    action: () => Promise<{ ok: true } | { ok: false; error: string }>
  ) => {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(t(`errors.${result.error}`));
      }
    });
  };

  return (
    <article className="flex h-full flex-col gap-3 rounded-lg border border-rule bg-card p-5">
      <header className="flex items-start justify-between gap-3">
        <h2 className="font-medium text-ink">
          {tCatalog(`${catalogId}.name`)}
        </h2>
        {connection ? (
          <Badge
            variant={connection.status === "active" ? "success" : "destructive"}
          >
            {t(`status.${connection.status}`)}
          </Badge>
        ) : null}
      </header>
      <p className="flex-1 text-ink-3 text-sm">
        {tCatalog(`${catalogId}.description`)}
      </p>
      {connection ? (
        <p className="text-ink-3 text-xs">
          {t("tools", { count: connection.toolCount })} ·{" "}
          {t("tokens", { count: connection.toolTokenEstimate })}
        </p>
      ) : null}
      <footer className="flex flex-wrap gap-2">
        {connection ? (
          <>
            <Button
              disabled={isPending}
              onClick={() => run(() => refreshIntegrationTools(connection.id))}
              size="sm"
              variant="outline"
            >
              {t("refresh")}
            </Button>
            <Button
              disabled={isPending}
              onClick={() => run(() => disconnectIntegration(connection.id))}
              size="sm"
              variant="ghost"
            >
              {t("disconnect")}
            </Button>
          </>
        ) : (
          <Button
            disabled={isPending}
            onClick={() => run(() => connectBuiltinNoAuth(catalogId))}
            size="sm"
            variant="secondary"
          >
            {t("connect")}
          </Button>
        )}
      </footer>
    </article>
  );
}
