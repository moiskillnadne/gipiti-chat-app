"use client";

import { memo } from "react";
import { ModelSelectorHeader } from "@/components/model-selector-header";
import { SidebarToggle } from "@/components/sidebar-toggle";

type PureChatHeaderProps = {
  chatId: string;
  isReadonly: boolean;
};

function PureChatHeader(_props: PureChatHeaderProps) {
  return (
    <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      <SidebarToggle />

      <ModelSelectorHeader />
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});
