"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useTranslations } from "next-intl";
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
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
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
        <SidebarHeader>
          <SidebarMenu>
            <div className="flex flex-row items-center justify-between">
              <Link
                className="flex flex-row items-center gap-3"
                href="/"
                onClick={() => {
                  setOpenMobile(false);
                }}
              >
                <span className="cursor-pointer rounded-md px-2 font-semibold text-lg hover:bg-muted">
                  GIPITI
                </span>
              </Link>
              {user && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="h-8 p-1 md:h-fit md:p-2"
                      onClick={() => setShowDeleteAllDialog(true)}
                      type="button"
                      variant="ghost"
                    >
                      <TrashIcon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent align="end" className="hidden md:block">
                    {t("deleteAllChats")}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </SidebarMenu>
        </SidebarHeader>
        <div className="px-2 py-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="h-10 gap-2"
                onClick={() => {
                  setOpenMobile(false);
                  router.push("/");
                  router.refresh();
                }}
              >
                <PlusIcon />
                <span>{t("newChat")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="h-10 gap-2"
                onClick={() => {
                  setOpenMobile(false);
                  router.push("/styles");
                }}
              >
                <PenIcon />
                <span>{tTextStyles("manageStyles")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="h-10 gap-2"
                onClick={() => {
                  setOpenMobile(false);
                  router.push("/projects");
                }}
              >
                <FolderIcon />
                <span>{tProjects("manageProjects")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarSeparator className="mt-2" />
        </div>
        <SidebarContent>
          <SidebarHistory user={user} />
        </SidebarContent>
        <SidebarFooter>{user && <SidebarUserNav user={user} />}</SidebarFooter>
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
