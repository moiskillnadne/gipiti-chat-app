"use client";

import { ChevronUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { signOut, useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useTransition } from "react";
import { setUserLocale } from "@/app/actions/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { type Locale, localeFlags, localeNames, locales } from "@/i18n/config";
import { LoaderIcon } from "./icons";
import { toast } from "./toast";

export function SidebarUserNav({ user }: { user: User }) {
  const t = useTranslations("common");
  const tSettings = useTranslations("settings.theme");
  const tSupport = useTranslations("legal.support");
  const { status } = useSession();
  const { setTheme, resolvedTheme } = useTheme();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const currentLocale = useLocale() as Locale;

  const handleLocaleChange = (newLocale: string) => {
    const locale = newLocale as Locale;

    startTransition(async () => {
      try {
        const result = await setUserLocale(locale);

        if (!result.success) {
          toast({
            type: "error",
            description: result.error || "Failed to change language",
          });
          return;
        }

        router.refresh();
      } catch (error) {
        console.error("Failed to change locale:", error);
        toast({
          type: "error",
          description: "Failed to change language",
        });
      }
    });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {status === "loading" ? (
              <SidebarMenuButton className="h-10 justify-between bg-background data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                <div className="flex flex-row gap-2">
                  <div className="size-6 animate-pulse rounded-full bg-zinc-500/30" />
                  <span className="animate-pulse rounded-md bg-zinc-500/30 text-transparent">
                    {t("navigation.loadingAuthStatus")}
                  </span>
                </div>
                <div className="animate-spin text-zinc-500">
                  <LoaderIcon />
                </div>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                className="h-10 bg-background data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                data-testid="user-nav-button"
              >
                <Image
                  alt={user.email ?? "User Avatar"}
                  className="rounded-full"
                  height={24}
                  src={`https://avatar.vercel.sh/${user.email}`}
                  width={24}
                />
                <span className="truncate" data-testid="user-email">
                  {user?.email ?? t("navigation.account")}
                </span>
                <ChevronUp className="ml-auto" />
              </SidebarMenuButton>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-popper-anchor-width)"
            data-testid="user-nav-menu"
            side="top"
          >
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={isPending}>
                <span className="flex items-center gap-2">
                  <span>{localeFlags[currentLocale]}</span>
                  <span>{localeNames[currentLocale]}</span>
                </span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  onValueChange={handleLocaleChange}
                  value={currentLocale}
                >
                  {locales.map((locale) => (
                    <DropdownMenuRadioItem key={locale} value={locale}>
                      <span className="flex items-center gap-2">
                        <span>{localeFlags[locale]}</span>
                        <span>{localeNames[locale]}</span>
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer"
              data-testid="user-nav-item-theme"
              onSelect={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              {resolvedTheme === "light"
                ? tSettings("toggleDark")
                : tSettings("toggleLight")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-testid="user-nav-item-subscription">
              <Link href="/subscription">{t("navigation.subscription")}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild data-testid="user-nav-item-support">
              <Link href="/legal/support">{tSupport("linkText")}</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-testid="user-nav-item-auth">
              <button
                className="w-full cursor-pointer"
                onClick={() => {
                  if (status === "loading") {
                    toast({
                      type: "error",
                      description: t("navigation.checkingAuthStatus"),
                    });

                    return;
                  }
                  signOut({
                    redirectTo: "/login",
                  });
                }}
                type="button"
              >
                {t("navigation.signOut")}
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
