"use server";

import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/context";
import { assertWorkspaceWritable } from "@/lib/billing/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function safeRedirect(pathname: string, key: "notice" | "error", value: string): never {
  const destination = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/tasks";
  const separator = destination.includes("?") ? "&" : "?";
  redirect(`${destination}${separator}${key}=${encodeURIComponent(value)}`);
}

async function requireWritableSavedViews(redirectTo: string) {
  const context = await requirePermission("saved_views.manage", "limited");

  try {
    await assertWorkspaceWritable(context);
  } catch (error) {
    safeRedirect(redirectTo, "error", error instanceof Error ? error.message : "Workspace is read-only.");
  }

  return context;
}

export async function saveViewAction(formData: FormData) {
  const name = formString(formData, "name").trim();
  const moduleName = formString(formData, "module").trim();
  const redirectTo = formString(formData, "redirectTo") || "/tasks";
  const filtersRaw = formString(formData, "filtersJson") || "{}";
  const context = await requireWritableSavedViews(redirectTo);

  if (!name || !moduleName) {
    safeRedirect(redirectTo, "error", "Saved view name is required.");
  }

  let filtersJson: Json;

  try {
    filtersJson = JSON.parse(filtersRaw) as Json;
  } catch {
    safeRedirect(redirectTo, "error", "Current filters could not be saved.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("saved_views").upsert({
    company_id: context.companyId,
    user_id: context.userId,
    name,
    module: moduleName,
    filters_json: filtersJson,
    is_default: false,
  }, {
    onConflict: "user_id,module,name",
  });

  if (error) {
    safeRedirect(redirectTo, "error", "Saved view could not be stored.");
  }

  safeRedirect(redirectTo, "notice", "Saved view stored.");
}

export async function deleteViewAction(formData: FormData) {
  const viewId = formString(formData, "viewId");
  const redirectTo = formString(formData, "redirectTo") || "/tasks";
  const context = await requireWritableSavedViews(redirectTo);

  if (!viewId) {
    safeRedirect(redirectTo, "error", "Saved view is invalid.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("saved_views")
    .delete()
    .eq("id", viewId)
    .eq("company_id", context.companyId)
    .eq("user_id", context.userId);

  if (error) {
    safeRedirect(redirectTo, "error", "Saved view could not be removed.");
  }

  safeRedirect(redirectTo, "notice", "Saved view removed.");
}
