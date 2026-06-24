"use server";

import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { contentTemplateArchiveSchema, contentTemplateSchema } from "@/lib/workflows/schemas";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function safeRedirect(pathname: string, key: "notice" | "error", value: string): never {
  const destination = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/content/templates";
  const separator = destination.includes("?") ? "&" : "?";
  redirect(`${destination}${separator}${key}=${encodeURIComponent(value)}`);
}

export async function createContentTemplateAction(formData: FormData) {
  const context = await requirePermission("content.templates.manage", "limited");
  const parsed = contentTemplateSchema.safeParse({
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    body: formString(formData, "body"),
    category: formString(formData, "category"),
    redirectTo: formString(formData, "redirectTo") || "/content/templates",
  });

  if (!parsed.success) {
    safeRedirect("/content/templates", "error", parsed.error.issues[0]?.message ?? "Invalid template.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("content_templates").insert({
    company_id: context.companyId,
    title: parsed.data.title,
    description: parsed.data.description,
    body: parsed.data.body,
    category: parsed.data.category,
    status: "active",
    created_by: context.userId,
  });

  if (error) {
    safeRedirect(parsed.data.redirectTo, "error", "Template could not be created.");
  }

  safeRedirect(parsed.data.redirectTo, "notice", "Template created.");
}

export async function updateContentTemplateAction(formData: FormData) {
  const context = await requirePermission("content.templates.manage", "limited");
  const parsed = contentTemplateSchema.safeParse({
    templateId: formString(formData, "templateId"),
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    body: formString(formData, "body"),
    category: formString(formData, "category"),
    redirectTo: formString(formData, "redirectTo") || "/content/templates",
  });

  if (!parsed.success || !parsed.data.templateId) {
    safeRedirect("/content/templates", "error", parsed.error?.issues[0]?.message ?? "Invalid template update.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("content_templates")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      body: parsed.data.body,
      category: parsed.data.category,
    })
    .eq("id", parsed.data.templateId)
    .eq("company_id", context.companyId);

  if (error) {
    safeRedirect(parsed.data.redirectTo, "error", "Template could not be updated.");
  }

  safeRedirect(parsed.data.redirectTo, "notice", "Template updated.");
}

export async function archiveContentTemplateAction(formData: FormData) {
  const context = await requirePermission("content.templates.manage", "limited");
  const parsed = contentTemplateArchiveSchema.safeParse({
    templateId: formString(formData, "templateId"),
    redirectTo: formString(formData, "redirectTo") || "/content/templates",
  });

  if (!parsed.success) {
    safeRedirect("/content/templates", "error", "Invalid template.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("content_templates")
    .update({ status: "archived" })
    .eq("id", parsed.data.templateId)
    .eq("company_id", context.companyId);

  if (error) {
    safeRedirect(parsed.data.redirectTo, "error", "Template could not be archived.");
  }

  safeRedirect(parsed.data.redirectTo, "notice", "Template archived.");
}
