import type { ComponentProps } from "react";
import { type SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslations } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { SidebarLeftIcon } from "./icons";
import { Button } from "./ui/button";

export function SidebarToggle({
  className,
}: ComponentProps<typeof SidebarTrigger>) {
  const { isMobile, open, openMobile, toggleSidebar } = useSidebar();
  const t = useTranslations("common.accessibility");
  const isSidebarOpen = isMobile ? openMobile : open;
  const label = t(isSidebarOpen ? "closeSidebar" : "openSidebar");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* The tooltip repeats the name, so it must not also become the description */}
        <Button
          aria-describedby={undefined}
          aria-label={label}
          className={cn(
            "size-7 rounded-sm p-0 text-ink-3 hover:bg-paper-2 hover:text-ink",
            className
          )}
          data-testid="sidebar-toggle-button"
          onClick={toggleSidebar}
          variant="ghost"
        >
          <SidebarLeftIcon size={18} />
        </Button>
      </TooltipTrigger>
      <TooltipContent align="start" className="hidden md:block">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
