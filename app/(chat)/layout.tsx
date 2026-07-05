import { cookies } from "next/headers";
import Script from "next/script";
import { AppSidebar } from "@/components/app-sidebar";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ModelProvider } from "@/contexts/model-context";
import { ProjectProvider } from "@/contexts/project-context";
import { WebSearchProvider } from "@/contexts/web-search-context";
import {
  chatModelIds,
  DEFAULT_CHAT_MODEL,
  getDefaultImageGenSetting,
  getDefaultThinkingSetting,
  getDefaultVideoGenSetting,
  IMAGE_ASPECT_COOKIE_PREFIX,
  IMAGE_QUALITY_COOKIE_PREFIX,
  IMAGE_STYLE_COOKIE_PREFIX,
  isVisibleInUI,
  parseImageGenSettingFromCookie,
  parseThinkingSettingFromCookie,
  parseVideoGenSettingFromCookie,
  THINKING_COOKIE_PREFIX,
  VIDEO_ASPECT_COOKIE_PREFIX,
  VIDEO_DURATION_COOKIE_PREFIX,
  VIDEO_MODE_COOKIE_PREFIX,
  VIDEO_RESOLUTION_COOKIE_PREFIX,
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
    `${THINKING_COOKIE_PREFIX}-${validatedModelId}`
  )?.value;
  const initialThinkingSetting =
    parseThinkingSettingFromCookie(validatedModelId, thinkingCookieValue) ??
    getDefaultThinkingSetting(validatedModelId);

  const imageQualityCookie = cookieStore.get(
    `${IMAGE_QUALITY_COOKIE_PREFIX}-${validatedModelId}`
  )?.value;
  const imageAspectCookie = cookieStore.get(
    `${IMAGE_ASPECT_COOKIE_PREFIX}-${validatedModelId}`
  )?.value;
  const imageStyleCookie = cookieStore.get(
    `${IMAGE_STYLE_COOKIE_PREFIX}-${validatedModelId}`
  )?.value;
  const initialImageGenSetting =
    parseImageGenSettingFromCookie(
      validatedModelId,
      imageQualityCookie,
      imageAspectCookie,
      imageStyleCookie
    ) ?? getDefaultImageGenSetting(validatedModelId);

  const videoCookie = (prefix: string) =>
    cookieStore.get(`${prefix}-${validatedModelId}`)?.value;
  const initialVideoGenSetting =
    parseVideoGenSettingFromCookie(validatedModelId, {
      aspectRatio: videoCookie(VIDEO_ASPECT_COOKIE_PREFIX),
      duration: videoCookie(VIDEO_DURATION_COOKIE_PREFIX),
      resolution: videoCookie(VIDEO_RESOLUTION_COOKIE_PREFIX),
      mode: videoCookie(VIDEO_MODE_COOKIE_PREFIX),
    }) ?? getDefaultVideoGenSetting(validatedModelId);

  const userType = session?.user?.type ?? "regular";
  const projectId = cookieStore.get("chat-project")?.value ?? null;
  const webSearchCookie = cookieStore.get("web-search-enabled")?.value;
  const initialWebSearchEnabled =
    webSearchCookie === undefined ? true : webSearchCookie === "1";

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <DataStreamProvider>
        <ModelProvider
          initialImageGenSetting={initialImageGenSetting}
          initialModelId={validatedModelId}
          initialThinkingSetting={initialThinkingSetting}
          initialVideoGenSetting={initialVideoGenSetting}
          userType={userType}
        >
          <ProjectProvider initialProjectId={projectId}>
            <WebSearchProvider initialEnabled={initialWebSearchEnabled}>
              <SidebarProvider defaultOpen={!isCollapsed}>
                <AppSidebar user={session?.user} />
                <SidebarInset>{children}</SidebarInset>
              </SidebarProvider>
            </WebSearchProvider>
          </ProjectProvider>
        </ModelProvider>
      </DataStreamProvider>
    </>
  );
}
