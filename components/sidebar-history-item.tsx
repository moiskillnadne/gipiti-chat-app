import Link from "next/link";
import { memo } from "react";
import type { Chat } from "@/lib/db/schema";
import { useTranslations } from "@/lib/i18n/translate";
import { MoreHorizontalIcon, TrashIcon } from "./icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar";

const PureChatItem = ({
  chat,
  isActive,
  onDelete,
  setOpenMobile,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
}) => {
  const tCommon = useTranslations("common.buttons");

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        className="data-[active=true]:bg-card data-[active=true]:shadow-sm"
        isActive={isActive}
      >
        <Link href={`/chat/${chat.id}`} onClick={() => setOpenMobile(false)}>
          <span>{chat.title}</span>
        </Link>
      </SidebarMenuButton>

      <DropdownMenu modal={true}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            className="mr-0.5 size-[22px] rounded-sm text-ink-3 hover:bg-paper hover:text-ink data-[state=open]:bg-paper data-[state=open]:text-ink"
            showOnHover={!isActive}
          >
            <MoreHorizontalIcon />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="min-w-[160px] rounded-md border-rule p-1 shadow-md"
          side="bottom"
        >
          <DropdownMenuItem
            className="cursor-pointer gap-2 rounded-sm px-2.5 py-1.5 text-[13px] text-destructive focus:bg-danger-soft focus:text-destructive"
            onSelect={() => onDelete(chat.id)}
          >
            <TrashIcon />
            <span>{tCommon("delete")}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};

export const ChatItem = memo(PureChatItem, (prevProps, nextProps) => {
  if (prevProps.isActive !== nextProps.isActive) {
    return false;
  }
  return true;
});
