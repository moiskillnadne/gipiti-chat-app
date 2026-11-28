"use client";

import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useMemo, useState } from "react";
import { getApiErrorMessageKey } from "@/client/shared/api/errors";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import { useTranslations } from "@/lib/i18n/translate";
import { LoaderIcon } from "./icons";
import { CHAT_GROUPS, groupChatsByDate } from "./sidebar-history-groups";
import { ChatItem } from "./sidebar-history-item";
import { useChatHistory } from "./use-chat-history";

const SKELETON_WIDTHS = [44, 32, 28, 64, 52];

const MESSAGE_CLASS =
  "flex w-full flex-row items-center justify-center gap-2 px-2 text-ink-3 text-sm";

export function SidebarHistory({ user }: { user: User | undefined }) {
  const t = useTranslations("chat.sidebar");
  const tCommon = useTranslations("common.buttons");
  const tErrors = useTranslations("errors");
  const { setOpenMobile } = useSidebar();
  const { id } = useParams();
  const router = useRouter();
  const stableNow = useMemo(() => new Date(), []);
  const { pages, loadError, isLoading, hasReachedEnd, loadMore, deleteChat } =
    useChatHistory();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Empty only when nothing is left to load: with a next cursor the list
  // stays, so its sentinel can load the older pages.
  const hasEmptyChatHistory =
    pages.every((page) => page.items.length === 0) && hasReachedEnd;

  const groupedChats = useMemo(
    () =>
      groupChatsByDate(
        pages.flatMap((page) => page.items),
        stableNow
      ),
    [pages, stableNow]
  );

  const handleDelete = () => {
    if (deleteId) {
      deleteChat(deleteId);
    }

    setShowDeleteDialog(false);

    if (deleteId === id) {
      router.push("/");
    }
  };

  if (!user) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className={MESSAGE_CLASS}>{t("loginToSaveChats")}</div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (isLoading) {
    return (
      <SidebarGroup>
        <div className="px-2 py-1 text-ink-3 text-xs">{t("today")}</div>
        <SidebarGroupContent>
          <div className="flex flex-col">
            {SKELETON_WIDTHS.map((item) => (
              <div
                className="flex h-8 items-center gap-2 rounded-md px-2"
                key={item}
              >
                <div
                  className="h-4 max-w-(--skeleton-width) flex-1 rounded-md bg-sidebar-accent-foreground/10"
                  style={
                    {
                      "--skeleton-width": `${item}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (loadError) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className={MESSAGE_CLASS} role="alert">
            {tErrors(getApiErrorMessageKey(loadError) ?? "api.unknown")}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (hasEmptyChatHistory) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className={MESSAGE_CLASS}>{t("emptyChats")}</div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <div className="flex flex-col gap-6">
              {CHAT_GROUPS.map(({ key, labelKey, headingClassName }) =>
                groupedChats[key].length > 0 ? (
                  <div key={key}>
                    <div className={headingClassName}>{t(labelKey)}</div>
                    {groupedChats[key].map((chat) => (
                      <ChatItem
                        chat={chat}
                        isActive={chat.id === id}
                        key={chat.id}
                        onDelete={(chatId) => {
                          setDeleteId(chatId);
                          setShowDeleteDialog(true);
                        }}
                        setOpenMobile={setOpenMobile}
                      />
                    ))}
                  </div>
                ) : null
              )}
            </div>
          </SidebarMenu>

          <motion.div onViewportEnter={loadMore} />

          {hasReachedEnd ? (
            <div className={`mt-8 ${MESSAGE_CLASS}`}>{t("endOfHistory")}</div>
          ) : (
            <div className="mt-8 flex flex-row items-center gap-2 p-2 text-ink-3">
              <div className="animate-spin">
                <LoaderIcon />
              </div>
              <div>{t("loadingChats")}</div>
            </div>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteChatDialogTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteChatDialogDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {tCommon("continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
