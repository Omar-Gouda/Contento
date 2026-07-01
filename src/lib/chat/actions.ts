"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/context";
import type { AuthContext } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function safeRedirect(pathname: string | null | undefined, key: "notice" | "error", value: string): never {
  const destination = pathname?.startsWith("/") && !pathname.startsWith("//") ? pathname : "/tasks";
  const separator = destination.includes("?") ? "&" : "?";
  redirect(`${destination}${separator}${key}=${encodeURIComponent(value)}`);
}

async function resolveSharedClientId(context: AuthContext, recipientId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: recipient, error: recipientError } = await supabase
    .from("users")
    .select("id")
    .eq("id", recipientId)
    .eq("company_id", context.companyId)
    .eq("status", "active")
    .maybeSingle();

  if (recipientError || !recipient) {
    throw new Error("Recipient is outside your organization chat scope.");
  }

  const { data: clients } = await supabase
    .from("clients")
    .select("id, assigned_account_manager_id")
    .eq("company_id", context.companyId);
  const clientRows = (clients as Array<{ id: string; assigned_account_manager_id: string | null }> | null) ?? [];
  const clientIds = clientRows.map((client) => client.id);

  if (!clientIds.length) {
    return null;
  }

  const { data: assignments } = await supabase
    .from("client_assignments")
    .select("client_id, user_id")
    .in("client_id", clientIds)
    .in("user_id", [context.userId, recipientId]);
  const assignmentRows = (assignments as Array<{ client_id: string; user_id: string }> | null) ?? [];

  const sharedClient = clientRows.find((client) => {
    const currentUserBelongs =
      client.assigned_account_manager_id === context.userId ||
      assignmentRows.some((assignment) => assignment.client_id === client.id && assignment.user_id === context.userId);
    const recipientBelongs =
      client.assigned_account_manager_id === recipientId ||
      assignmentRows.some((assignment) => assignment.client_id === client.id && assignment.user_id === recipientId);

    return currentUserBelongs && recipientBelongs;
  });

  return sharedClient?.id ?? null;
}

async function findOrCreateConversation(context: AuthContext, recipientId: string) {
  if (!recipientId || recipientId === context.userId) {
    throw new Error("Choose a valid chat recipient.");
  }

  const supabase = await createSupabaseServerClient();
  const sharedClientId = await resolveSharedClientId(context, recipientId);
  let conversationQuery = supabase
    .from("chat_conversations")
    .select("id")
    .eq("company_id", context.companyId)
    .or(`and(participant_one_id.eq.${context.userId},participant_two_id.eq.${recipientId}),and(participant_one_id.eq.${recipientId},participant_two_id.eq.${context.userId})`)
    .limit(1);

  conversationQuery = sharedClientId
    ? conversationQuery.eq("client_id", sharedClientId)
    : conversationQuery.is("client_id", null);

  const { data: existingConversations } = await conversationQuery;
  const existingConversation = existingConversations?.[0];

  if (existingConversation) {
    return existingConversation.id;
  }

  const conversationId = randomUUID();
  const { error } = await supabase.from("chat_conversations").insert({
    id: conversationId,
    company_id: context.companyId,
    client_id: sharedClientId,
    participant_one_id: context.userId,
    participant_two_id: recipientId,
    created_by: context.userId,
  });

  if (error) {
    throw new Error("You can only start chats inside your organization or assigned client scope.");
  }

  return conversationId;
}

export async function sendChatMessageAction(formData: FormData) {
  const context = await requireAuthContext();
  const redirectTo = formString(formData, "redirectTo") || "/tasks";
  const body = formString(formData, "body");
  const conversationIdInput = formString(formData, "conversationId");
  const recipientId = formString(formData, "recipientId");

  if (!body) {
    safeRedirect(redirectTo, "error", "Message is required.");
  }

  if (body.length > 2000) {
    safeRedirect(redirectTo, "error", "Message must be 2,000 characters or fewer.");
  }

  try {
    const supabase = await createSupabaseServerClient();
    const conversationId = conversationIdInput || await findOrCreateConversation(context, recipientId);

    if (conversationIdInput) {
      const { data: conversation, error: conversationError } = await supabase
        .from("chat_conversations")
        .select("id")
        .eq("id", conversationIdInput)
        .eq("company_id", context.companyId)
        .maybeSingle();

      if (conversationError || !conversation) {
        throw new Error("Conversation is outside your chat scope.");
      }
    }

    const { error: messageError } = await supabase.from("chat_messages").insert({
      id: randomUUID(),
      company_id: context.companyId,
      conversation_id: conversationId,
      sender_id: context.userId,
      body,
    });

    if (messageError) {
      throw new Error("Message could not be sent.");
    }

    await supabase
      .from("chat_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .eq("company_id", context.companyId);
  } catch (error) {
    safeRedirect(redirectTo, "error", error instanceof Error ? error.message : "Chat message could not be sent.");
  }

  safeRedirect(redirectTo, "notice", "Message sent.");
}
