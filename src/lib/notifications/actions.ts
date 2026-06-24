"use server";

import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function markNotificationReadAction(formData: FormData) {
  const context = await requireAuthContext();
  const notificationId = formString(formData, "notificationId");

  if (!notificationId) {
    redirect("/notifications?error=Invalid notification.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("company_id", context.companyId)
    .eq("user_id", context.userId);

  if (error) {
    redirect("/notifications?error=Notification could not be updated.");
  }

  redirect("/notifications?notice=read");
}

export async function markAllNotificationsReadAction() {
  const context = await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("company_id", context.companyId)
    .eq("user_id", context.userId)
    .eq("read", false);

  if (error) {
    redirect("/notifications?error=Notifications could not be updated.");
  }

  redirect("/notifications?notice=all-read");
}
