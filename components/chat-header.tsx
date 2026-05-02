"use client";

import { memo } from "react";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { ModelSelector } from "@/components/ui/model-selector";

type PureChatHeaderProps = {
  chatId: string;
  isReadonly: boolean;
};

function PureChatHeader(_props: PureChatHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-rule border-b bg-paper/85 px-4 py-3 backdrop-blur-md md:px-6">
      <SidebarToggle />
      <ModelSelector />
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});
