"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  IMAGE_ASPECT_COOKIE_PREFIX,
  IMAGE_QUALITY_COOKIE_PREFIX,
  IMAGE_STYLE_COOKIE_PREFIX,
  THINKING_COOKIE_PREFIX,
  VIDEO_ASPECT_COOKIE_PREFIX,
  VIDEO_DURATION_COOKIE_PREFIX,
  VIDEO_MODE_COOKIE_PREFIX,
  VIDEO_RESOLUTION_COOKIE_PREFIX,
} from "@/lib/ai/models";
import { deleteTrailingMessagesForUser } from "@/lib/chat/delete-trailing-messages";
import { ChatSDKError } from "@/lib/errors";

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function saveThinkingSettingAsCookie(
  modelId: string,
  value: string
) {
  const cookieStore = await cookies();
  cookieStore.set(`${THINKING_COOKIE_PREFIX}-${modelId}`, value);
}

export async function saveImageQualityAsCookie(modelId: string, value: string) {
  const cookieStore = await cookies();
  cookieStore.set(`${IMAGE_QUALITY_COOKIE_PREFIX}-${modelId}`, value);
}

export async function saveImageAspectAsCookie(modelId: string, value: string) {
  const cookieStore = await cookies();
  cookieStore.set(`${IMAGE_ASPECT_COOKIE_PREFIX}-${modelId}`, value);
}

export async function saveImageStyleAsCookie(modelId: string, value: string) {
  const cookieStore = await cookies();
  cookieStore.set(`${IMAGE_STYLE_COOKIE_PREFIX}-${modelId}`, value);
}

export async function saveVideoAspectAsCookie(modelId: string, value: string) {
  const cookieStore = await cookies();
  cookieStore.set(`${VIDEO_ASPECT_COOKIE_PREFIX}-${modelId}`, value);
}

export async function saveVideoDurationAsCookie(
  modelId: string,
  value: string
) {
  const cookieStore = await cookies();
  cookieStore.set(`${VIDEO_DURATION_COOKIE_PREFIX}-${modelId}`, value);
}

export async function saveVideoResolutionAsCookie(
  modelId: string,
  value: string
) {
  const cookieStore = await cookies();
  cookieStore.set(`${VIDEO_RESOLUTION_COOKIE_PREFIX}-${modelId}`, value);
}

export async function saveVideoModeAsCookie(modelId: string, value: string) {
  const cookieStore = await cookies();
  cookieStore.set(`${VIDEO_MODE_COOKIE_PREFIX}-${modelId}`, value);
}

export async function saveWebSearchEnabledAsCookie(enabled: boolean) {
  const cookieStore = await cookies();
  cookieStore.set("web-search-enabled", enabled ? "1" : "0");
}

export async function saveProjectAsCookie(projectId: string | null) {
  const cookieStore = await cookies();
  if (projectId) {
    cookieStore.set("chat-project", projectId);
  } else {
    cookieStore.delete("chat-project");
  }
}

// Server actions are public endpoints: check the session and ownership here,
// never trust the caller.
export async function deleteTrailingMessages({ id }: { id: string }) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new ChatSDKError("unauthorized:chat");
  }

  const messageId = z.string().uuid().safeParse(id);

  if (!messageId.success) {
    throw new ChatSDKError("bad_request:chat");
  }

  await deleteTrailingMessagesForUser({
    messageId: messageId.data,
    userId: session.user.id,
  });
}
