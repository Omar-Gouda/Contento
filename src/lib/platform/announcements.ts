import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type ActivePlatformAnnouncement = Pick<
  Database["public"]["Tables"]["platform_announcements"]["Row"],
  "id" | "title" | "message" | "severity" | "starts_at" | "ends_at"
>;

export async function getActivePlatformAnnouncements() {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("platform_announcements")
    .select("id, title, message, severity, starts_at, ends_at")
    .eq("status", "active")
    .lte("starts_at", now)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order("severity", { ascending: true })
    .order("starts_at", { ascending: false })
    .limit(3);

  if (error) {
    return [];
  }

  return (data as ActivePlatformAnnouncement[] | null) ?? [];
}
