"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { FolderIcon, PenIcon, PlusIcon, TrashIcon } from "@/components/icons";
import {
  getChatHistoryPaginationKey,
  SidebarHistory,
} from "@/components/sidebar-history";
import { SidebarUserNav } from "@/components/sidebar-user-nav";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useTranslations } from "@/lib/i18n/translate";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function AppSidebar({ user }: { user: User | undefined }) {
  const t = useTranslations("chat.sidebar");
  const tCommon = useTranslations("common.buttons");
  const tTextStyles = useTranslations("textStyles");
  const tProjects = useTranslations("projects");
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { mutate } = useSWRConfig();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  const handleDeleteAll = () => {
    const deletePromise = fetch("/api/history", {
      method: "DELETE",
    });

    toast.promise(deletePromise, {
      loading: t("deletingAllChats"),
      success: () => {
        mutate(unstable_serialize(getChatHistoryPaginationKey));
        router.push("/");
        setShowDeleteAllDialog(false);
        return t("deleteAllSuccess");
      },
      error: t("deleteAllError"),
    });
  };

  return (
    <>
      <Sidebar className="group-data-[side=left]:border-r-0">
        <SidebarHeader className="px-3 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <Link
              className="flex items-center"
              href="/"
              onClick={() => {
                setOpenMobile(false);
              }}
            >
              <span className="cursor-pointer rounded-sm px-2 py-0.5 font-medium text-ink text-lg tracking-tight hover:bg-paper-3">
                GIPITI
              </span>
            </Link>
            {user && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="size-[26px] rounded-sm p-0 text-ink-3 hover:bg-paper-3 hover:text-ink"
                    onClick={() => setShowDeleteAllDialog(true)}
                    type="button"
                    variant="ghost"
                  >
                    <TrashIcon size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent align="end" className="hidden md:block">
                  {t("deleteAllChats")}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </SidebarHeader>

        <div className="px-3 pb-2">
          <SidebarMenuButton
            className="mb-3 h-10 gap-2.5 rounded-md border border-rule bg-card px-3 font-medium text-[14px] shadow-sm hover:border-rule-strong hover:bg-card"
            onClick={() => {
              setOpenMobile(false);
              router.push("/");
              router.refresh();
            }}
          >
            <PlusIcon size={16} />
            <span>{t("newChat")}</span>
            <span className="ml-auto rounded-xs border border-rule bg-paper-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
              ⌘ K
            </span>
          </SidebarMenuButton>

          <SidebarMenu className="gap-px">
            <SidebarMenuItem>
              <SidebarMenuButton
                className="h-9 gap-2.5 rounded-sm px-3 text-[13px] text-ink-2 hover:bg-paper-3 hover:text-ink"
                onClick={() => {
                  setOpenMobile(false);
                  router.push("/styles");
                }}
              >
                <PenIcon size={14} />
                <span>{tTextStyles("manageStyles")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="h-9 gap-2.5 rounded-sm px-3 text-[13px] text-ink-2 hover:bg-paper-3 hover:text-ink"
                onClick={() => {
                  setOpenMobile(false);
                  router.push("/projects");
                }}
              >
                <FolderIcon size={14} />
                <span>{tProjects("manageProjects")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>

        <SidebarContent className="px-3">
          <SidebarHistory user={user} />
        </SidebarContent>

        <SidebarFooter className="p-0">
          {user && <SidebarUserNav user={user} />}
        </SidebarFooter>
      </Sidebar>

      <AlertDialog
        onOpenChange={setShowDeleteAllDialog}
        open={showDeleteAllDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteAllDialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteAllDialogDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll}>
              {t("deleteAllButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
