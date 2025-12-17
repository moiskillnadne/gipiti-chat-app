import { cookies } from "next/headers";
import Script from "next/script";
import { AppSidebar } from "@/components/app-sidebar";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ModelProvider } from "@/contexts/model-context";
import {
  chatModelIds,
  DEFAULT_CHAT_MODEL,
  getDefaultThinkingSetting,
  isVisibleInUI,
  parseThinkingSettingFromCookie,
} from "@/lib/ai/models";
import { auth } from "../(auth)/auth";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";

  // Get initial model and thinking settings from cookies
  const modelIdFromCookie = cookieStore.get("chat-model");
  const validatedModelId =
    modelIdFromCookie?.value &&
    chatModelIds.includes(modelIdFromCookie.value) &&
    isVisibleInUI(modelIdFromCookie.value)
      ? modelIdFromCookie.value
      : DEFAULT_CHAT_MODEL;

  const thinkingCookieValue = cookieStore.get(
    `thinking-${validatedModelId}`
  )?.value;
  const initialThinkingSetting =
    parseThinkingSettingFromCookie(validatedModelId, thinkingCookieValue) ??
    getDefaultThinkingSetting(validatedModelId);

  const userType = session?.user?.type ?? "regular";

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <DataStreamProvider>
        <ModelProvider
          initialModelId={validatedModelId}
          initialThinkingSetting={initialThinkingSetting}
          userType={userType}
        >
          <SidebarProvider defaultOpen={!isCollapsed}>
            <AppSidebar user={session?.user} />
            <SidebarInset>{children}</SidebarInset>
          </SidebarProvider>
        </ModelProvider>
      </DataStreamProvider>
    </>
  );
}
