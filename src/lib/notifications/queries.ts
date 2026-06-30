import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth/permissions";
import type { Database } from "@/types/database";

export type NotificationFilter = "all" | "unread" | "read";
export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export async function getNotifications(
  context: AuthContext,
  filter: NotificationFilter = "all",
  options: { limit?: number } = {}
) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("notifications")
    .select("id, company_id, user_id, title, message, read, entity_type, entity_id, link_href, read_at, created_at, updated_at")
    .eq("company_id", context.companyId)
    .eq("user_id", context.userId)
    .order("created_at", { ascending: false });

  if (filter === "unread") {
    query = query.eq("read", false);
  }

  if (filter === "read") {
    query = query.eq("read", true);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("Unable to load notifications.");
  }

  return (data as NotificationRow[] | null) ?? [];
}

export async function getRecentNotifications(context: AuthContext, limit = 5) {
  return getNotifications(context, "all", { limit });
}

export async function getUnreadNotificationCount(context: AuthContext) {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("company_id", context.companyId)
    .eq("user_id", context.userId)
    .eq("read", false);

  if (error) {
    return 0;
  }

  return count ?? 0;
}
