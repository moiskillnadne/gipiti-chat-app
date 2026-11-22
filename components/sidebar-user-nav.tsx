"use client";

import { LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { User } from "next-auth";
import { signOut, useSession } from "next-auth/react";
import {
  OVERFLOW_TOOLTIP_CONTENT_CLASS,
  useOverflowTooltip,
} from "@/hooks/use-overflow-tooltip";
import { useTranslations } from "@/lib/i18n/translate";
import { HelpIcon, LoaderIcon } from "./icons";
import { toast } from "./toast";
import { useSidebar } from "./ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const EMAIL_TOOLTIP_DELAY_MS = 400;

export function SidebarUserNav({ user }: { user: User }) {
  const t = useTranslations("common");
  const tSupport = useTranslations("legal.support");
  const { status } = useSession();
  const { isMobile } = useSidebar();
  const emailTooltip = useOverflowTooltip();

  if (status === "loading") {
    return (
      <div className="-mx-2 flex items-center gap-2.5 border-rule border-t px-3 py-3">
        <div className="size-7 animate-pulse rounded-full bg-paper-3" />
        <span className="flex-1 animate-pulse rounded-md bg-paper-3 text-transparent">
          {t("navigation.loadingAuthStatus")}
        </span>
        <div className="animate-spin text-ink-3">
          <LoaderIcon />
        </div>
      </div>
    );
  }

  const planCaption = user.hasActiveSubscription
    ? t("navigation.planPro")
    : user.isTester
      ? t("navigation.planTester")
      : t("navigation.planFree");
  const displayName = user.email ?? t("navigation.account");

  const handleSignOut = () => {
    if (status !== "authenticated") {
      toast({
        type: "error",
        description: t("navigation.checkingAuthStatus"),
      });
      return;
    }
    signOut({ redirectTo: "/login" });
  };

  return (
    <div className="-mx-2 flex items-center border-rule border-t">
      {/* The full email shows on hover and keyboard focus when the ellipsis hides part of it;
          touch screens have no hover, so there it wraps instead. */}
      <Tooltip
        delayDuration={EMAIL_TOOLTIP_DELAY_MS}
        onOpenChange={emailTooltip.onOpenChange}
        open={emailTooltip.isOpen}
      >
        <TooltipTrigger asChild>
          <Link
            className="focus-visible:-outline-offset-2 flex min-w-0 flex-1 items-center gap-2.5 px-3 py-3 transition-colors duration-fast ease-canon hover:bg-paper-3"
            data-testid="user-nav-button"
            href="/subscription"
          >
            <Image
              alt={displayName}
              className="size-7 shrink-0 rounded-full"
              height={28}
              src={`https://avatar.vercel.sh/${user.email}`}
              width={28}
            />
            <span className="min-w-0 flex-1 leading-tight">
              <span
                className="block truncate font-medium text-[13px] text-ink [@media(hover:none)]:whitespace-normal [@media(hover:none)]:[overflow-wrap:anywhere]"
                data-testid="user-email"
                ref={emailTooltip.textRef}
              >
                {displayName}
              </span>
              <span className="block text-[11px] text-ink-3">
                {planCaption}
              </span>
            </span>
          </Link>
        </TooltipTrigger>
        <TooltipContent
          align="start"
          className={OVERFLOW_TOOLTIP_CONTENT_CLASS}
          side={isMobile ? "top" : "right"}
        >
          {displayName}
        </TooltipContent>
      </Tooltip>
      <div className="flex items-center gap-0.5 pr-3">
        <Link
          className="inline-flex size-7 items-center justify-center rounded-sm text-ink-3 transition-colors duration-fast ease-canon hover:bg-paper-3 hover:text-ink"
          href="/legal/support"
          title={tSupport("linkText")}
        >
          <HelpIcon size={14} />
        </Link>
        <button
          className="inline-flex size-7 items-center justify-center rounded-sm text-ink-3 transition-colors duration-fast ease-canon hover:bg-paper-3 hover:text-ink"
          data-testid="user-nav-item-auth"
          onClick={handleSignOut}
          title={t("navigation.signOut")}
          type="button"
        >
          <LogOut size={14} />
        </button>
      </div>
    </div>
  );
}
