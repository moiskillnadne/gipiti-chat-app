import Link from "next/link";
import { memo, useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n/translate";
import { isTextTruncated } from "@/lib/utils/is-text-truncated";
import type { Chat } from "@/server/db/schema";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const TITLE_TOOLTIP_DELAY_MS = 400;

// Touch screens get no hover tooltip, so there the title wraps to its full length.
const TOUCH_WRAP_CLASSES =
  "[@media(hover:none)]:h-auto [@media(hover:none)]:min-h-8 [@media(hover:none)]:[&>span:last-child]:!overflow-visible [@media(hover:none)]:[&>span:last-child]:!whitespace-normal";

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
  const titleRef = useRef<HTMLSpanElement>(null);
  const [isTitleTooltipOpen, setIsTitleTooltipOpen] = useState(false);

  return (
    <SidebarMenuItem>
      {/* The full title shows on hover and keyboard focus, only when the ellipsis hides part of it. */}
      <Tooltip
        delayDuration={TITLE_TOOLTIP_DELAY_MS}
        onOpenChange={(isOpen) =>
          setIsTitleTooltipOpen(isOpen && isTextTruncated(titleRef.current))
        }
        open={isTitleTooltipOpen}
      >
        <TooltipTrigger asChild>
          <SidebarMenuButton
            asChild
            className={`data-[active=true]:bg-card data-[active=true]:shadow-sm ${TOUCH_WRAP_CLASSES}`}
            isActive={isActive}
          >
            <Link
              href={`/chat/${chat.id}`}
              onClick={() => setOpenMobile(false)}
            >
              <span className="break-words" ref={titleRef}>
                {chat.title}
              </span>
            </Link>
          </SidebarMenuButton>
        </TooltipTrigger>
        <TooltipContent
          align="start"
          className="max-w-80 text-pretty break-words text-[13px]"
          side="right"
        >
          {chat.title}
        </TooltipContent>
      </Tooltip>

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
            className="cursor-pointer gap-2 rounded-sm px-2.5 py-1.5 text-[13px] text-danger-ink focus:bg-danger-soft focus:text-danger-ink"
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
