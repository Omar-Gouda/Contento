"use server";

import { redirect } from "next/navigation";

import { requireAuthContext } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDefaultDashboardPath } from "@/types/roles";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function safeRedirect(formData: FormData, fallback = "/notifications"): never {
  const redirectTo = formString(formData, "redirectTo");
  redirect(redirectTo.startsWith("/") ? redirectTo : fallback);
}

export async function markNotificationReadAction(formData: FormData) {
  const context = await requireAuthContext();
  const fallbackPath = getDefaultDashboardPath(context.role);
  const notificationId = formString(formData, "notificationId");

  if (!notificationId) {
    redirect(fallbackPath);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("company_id", context.companyId)
    .eq("user_id", context.userId);

  if (error) {
    redirect(fallbackPath);
  }

  safeRedirect(formData, fallbackPath);
}

export async function markAllNotificationsReadAction(formData?: FormData) {
  const context = await requireAuthContext();
  const fallbackPath = getDefaultDashboardPath(context.role);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true, read_at: new Date().toISOString() })
    .eq("company_id", context.companyId)
    .eq("user_id", context.userId)
    .eq("read", false);

  if (error) {
    redirect(fallbackPath);
  }

  if (formData) {
    safeRedirect(formData, fallbackPath);
  }

  redirect(fallbackPath);
}
