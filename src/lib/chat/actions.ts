"use server";

import type { OrganizationChatData } from "@/lib/chat/queries";

const maintenanceMessage =
  "Chat is under maintenance while we rebuild the messaging experience.";

export type ChatActionResult = {
  success: boolean;
  message: string;
  conversationId?: string;
  chatMessage?: {
    id: string;
    conversationId: string;
    senderId: string;
    body: string;
    createdAt: string;
  };
};

export type ChatRefreshResult = {
  success: boolean;
  message: string;
  data?: OrganizationChatData;
};

export async function sendChatMessageAction(): Promise<ChatActionResult> {
  return {
    success: false,
    message: maintenanceMessage,
  };
}

export async function refreshOrganizationChatAction(): Promise<ChatRefreshResult> {
  return {
    success: false,
    message: maintenanceMessage,
  };
}
