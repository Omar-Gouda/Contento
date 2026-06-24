import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth/permissions";
import type { Database } from "@/types/database";

export type EntityType = "task" | "idea" | "content" | "report";

export type CollaborationComment = Database["public"]["Tables"]["comments"]["Row"] & {
  authorName: string | null;
};

export type CollaborationAttachment = Database["public"]["Tables"]["attachments"]["Row"] & {
  uploaderName: string | null;
  signedUrl: string | null;
};

function displayName(user: { first_name: string; last_name: string; email: string } | null | undefined) {
  if (!user) {
    return null;
  }

  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email;
}

export async function getCollaborationData(context: AuthContext, entityType: EntityType, entityId: string) {
  const supabase = await createSupabaseServerClient();
  const [{ data: comments, error: commentsError }, { data: attachments, error: attachmentsError }, { data: users }] =
    await Promise.all([
      supabase
        .from("comments")
        .select("id, company_id, entity_type, entity_id, author_id, body, created_at, updated_at, deleted_at")
        .eq("company_id", context.companyId)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("attachments")
        .select("id, company_id, entity_type, entity_id, uploaded_by, file_name, file_path, file_type, file_size, created_at")
        .eq("company_id", context.companyId)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false }),
      supabase
        .from("users")
        .select("id, email, first_name, last_name, status")
        .eq("company_id", context.companyId)
        .eq("status", "active")
        .order("first_name", { ascending: true }),
    ]);

  if (commentsError || attachmentsError) {
    throw new Error("Unable to load collaboration records.");
  }

  const userRows = (users as Array<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    status: Database["public"]["Enums"]["user_status"];
  }> | null) ?? [];
  const userById = new Map(userRows.map((user) => [user.id, user]));

  const attachmentRows = (attachments as Database["public"]["Tables"]["attachments"]["Row"][] | null) ?? [];
  const signedAttachments = await Promise.all(
    attachmentRows.map(async (attachment) => {
      const { data } = await supabase.storage
        .from("contento-attachments")
        .createSignedUrl(attachment.file_path, 60 * 10);

      return {
        ...attachment,
        uploaderName: attachment.uploaded_by ? displayName(userById.get(attachment.uploaded_by)) : null,
        signedUrl: data?.signedUrl ?? null,
      };
    })
  );

  return {
    comments: ((comments as Database["public"]["Tables"]["comments"]["Row"][] | null) ?? []).map((comment) => ({
      ...comment,
      authorName: comment.author_id ? displayName(userById.get(comment.author_id)) : null,
    })),
    attachments: signedAttachments,
    mentionableUsers: userRows.map((user) => ({
      id: user.id,
      name: displayName(user) ?? user.email,
      email: user.email,
    })),
  };
}
