"use server";

import { revalidatePath } from "next/cache";

import { requireAuthContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type NotificationActionResult = {
  success: boolean;
  message: string;
};

function formString(formData: FormData | undefined, key: string) {
  if (!formData) {
    return "";
  }

  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function revalidateNotificationPaths(pathname: string) {
  revalidatePath("/", "layout");
  revalidatePath("/notifications");
  void pathname;
}

export async function markNotificationReadAction(formData: FormData): Promise<NotificationActionResult> {
  const context = await requireAuthContext();
  const notificationId = formString(formData, "notificationId");

  if (!notificationId) {
    return { success: false, message: "Notification could not be resolved." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("company_id", context.companyId)
    .eq("user_id", context.userId);

  if (error) {
    return { success: false, message: "Notification could not be marked read." };
  }

  revalidateNotificationPaths(formString(formData, "redirectTo"));

  return { success: true, message: "Notification marked read." };
}

export async function markAllNotificationsReadAction(formData?: FormData): Promise<NotificationActionResult> {
  const context = await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("company_id", context.companyId)
    .eq("user_id", context.userId)
    .eq("read", false);

  if (error) {
    return { success: false, message: "Notifications could not be marked read." };
  }

  revalidateNotificationPaths(formString(formData, "redirectTo"));

  return { success: true, message: "All notifications marked read." };
}

export async function updateNotificationSoundPreferenceAction(
  enabled: boolean
): Promise<NotificationActionResult> {
  await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const preferences = { sound: enabled } satisfies Json;
  const { data: updated, error } = await supabase.rpc("update_current_user_notification_preferences", {
    preferences_input: preferences,
  });

  if (error || !updated) {
    return { success: false, message: "Notification preference could not be saved." };
  }

  revalidatePath("/", "layout");

  return { success: true, message: "Notification preference saved." };
}
