"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/context";
import { assertWorkspaceWritable } from "@/lib/billing/service";
import { createNotificationForUser } from "@/lib/notifications/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EntityType } from "@/lib/collaboration/queries";

const allowedEntityTypes = ["task", "idea", "content", "report"];
const maxAttachmentBytes = 10 * 1024 * 1024;

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function safeRedirect(pathname: string, key: "notice" | "error", value: string): never {
  const destination = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/tasks";
  const separator = destination.includes("?") ? "&" : "?";
  redirect(`${destination}${separator}${key}=${encodeURIComponent(value)}`);
}

async function requireWritablePermission(permissionKey: string, redirectTo: string) {
  const context = await requirePermission(permissionKey, "limited");

  try {
    await assertWorkspaceWritable(context);
  } catch (error) {
    safeRedirect(redirectTo, "error", error instanceof Error ? error.message : "Workspace is read-only.");
  }

  return context;
}

function parseEntity(formData: FormData) {
  const entityType = formString(formData, "entityType");
  const entityId = formString(formData, "entityId");
  const redirectTo = formString(formData, "redirectTo") || "/tasks";

  if (!allowedEntityTypes.includes(entityType) || !entityId) {
    safeRedirect(redirectTo, "error", "Invalid collaboration target.");
  }

  return { entityType: entityType as EntityType, entityId, redirectTo };
}

export async function addCollaborationCommentAction(formData: FormData) {
  const { entityType, entityId, redirectTo } = parseEntity(formData);
  const context = await requireWritablePermission("comments.create", redirectTo);
  const body = formString(formData, "body").trim();
  const mentionUserIds = formData.getAll("mentionUserIds").filter((value): value is string => typeof value === "string");

  if (!body) {
    safeRedirect(redirectTo, "error", "Comment body is required.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: comment, error } = await supabase
    .from("comments")
    .insert({
      company_id: context.companyId,
      entity_type: entityType,
      entity_id: entityId,
      author_id: context.userId,
      body,
    })
    .select("id")
    .single();

  if (error || !comment) {
    safeRedirect(redirectTo, "error", "Comment could not be added.");
  }

  const uniqueMentionIds = Array.from(new Set(mentionUserIds)).filter((userId) => userId !== context.userId);

  if (uniqueMentionIds.length) {
    await supabase.from("mentions").insert(
      uniqueMentionIds.map((userId) => ({
        company_id: context.companyId,
        comment_id: comment.id,
        mentioned_user_id: userId,
      }))
    );

    await Promise.all(
      uniqueMentionIds.map((userId) => createNotificationForUser({
        context,
        userId,
        title: "You were mentioned",
        message: `You were mentioned in a ${entityType} comment.`,
        entityType,
        entityId,
        linkHref: redirectTo,
      }))
    );
  }

  safeRedirect(redirectTo, "notice", "Comment added.");
}

export async function deleteCollaborationCommentAction(formData: FormData) {
  const commentId = formString(formData, "commentId");
  const redirectTo = formString(formData, "redirectTo") || "/tasks";
  const context = await requireWritablePermission("comments.delete", redirectTo);

  if (!commentId) {
    safeRedirect(redirectTo, "error", "Invalid comment.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("company_id", context.companyId);

  if (error) {
    safeRedirect(redirectTo, "error", "Comment could not be deleted.");
  }

  safeRedirect(redirectTo, "notice", "Comment deleted.");
}

export async function uploadAttachmentAction(formData: FormData) {
  const { entityType, entityId, redirectTo } = parseEntity(formData);
  const context = await requireWritablePermission("attachments.manage", redirectTo);
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    safeRedirect(redirectTo, "error", "Choose a file to upload.");
  }

  if (file.size > maxAttachmentBytes) {
    safeRedirect(redirectTo, "error", "Attachments must be 10 MB or smaller.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "attachment";
  const filePath = `${context.companyId}/${entityType}/${entityId}/${randomUUID()}-${safeName}`;
  const supabase = await createSupabaseServerClient();
  const { error: uploadError } = await supabase.storage
    .from("contento-attachments")
    .upload(filePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    safeRedirect(redirectTo, "error", "File could not be uploaded.");
  }

  const { error: metadataError } = await supabase.from("attachments").insert({
    company_id: context.companyId,
    entity_type: entityType,
    entity_id: entityId,
    uploaded_by: context.userId,
    file_name: file.name,
    file_path: filePath,
    file_type: file.type || "application/octet-stream",
    file_size: file.size,
  });

  if (metadataError) {
    await supabase.storage.from("contento-attachments").remove([filePath]);
    safeRedirect(redirectTo, "error", "Attachment metadata could not be saved.");
  }

  safeRedirect(redirectTo, "notice", "Attachment uploaded.");
}

export async function deleteAttachmentAction(formData: FormData) {
  const attachmentId = formString(formData, "attachmentId");
  const redirectTo = formString(formData, "redirectTo") || "/tasks";
  const context = await requireWritablePermission("attachments.manage", redirectTo);

  if (!attachmentId) {
    safeRedirect(redirectTo, "error", "Invalid attachment.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: attachment } = await supabase
    .from("attachments")
    .select("file_path")
    .eq("id", attachmentId)
    .eq("company_id", context.companyId)
    .maybeSingle();

  if (!attachment) {
    safeRedirect(redirectTo, "error", "Attachment could not be found.");
  }

  await supabase.storage.from("contento-attachments").remove([attachment.file_path]);
  const { error } = await supabase
    .from("attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("company_id", context.companyId);

  if (error) {
    safeRedirect(redirectTo, "error", "Attachment could not be deleted.");
  }

  safeRedirect(redirectTo, "notice", "Attachment deleted.");
}
