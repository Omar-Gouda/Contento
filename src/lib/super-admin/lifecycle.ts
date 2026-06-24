"use server";

import { redirect } from "next/navigation";

import { requireSuperiorAdminContext } from "@/lib/auth/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminConfig } from "@/lib/env";
import type { Database } from "@/types/database";

function redirectToOrganization(id: string, key: "notice" | "error", value: string): never {
  redirect(`/super-admin/organizations/${id}?${key}=${encodeURIComponent(value)}`);
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function updateOrganizationLifecycleAction(formData: FormData) {
  const context = await requireSuperiorAdminContext();
  const organizationId = formString(formData, "organizationId");
  const status = formString(formData, "status");

  if (!organizationId || !["active", "disabled", "deleted"].includes(status)) {
    redirect("/super-admin/organizations?error=Invalid organization lifecycle update.");
  }

  if (!hasSupabaseAdminConfig()) {
    redirectToOrganization(organizationId, "error", "Supabase service role is required for lifecycle changes.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: organization } = await supabase
    .from("companies")
    .select("name, owner_user_id")
    .eq("id", organizationId)
    .maybeSingle();
  const { error } = await supabase
    .from("companies")
    .update({ status: status as Database["public"]["Enums"]["company_status"] })
    .eq("id", organizationId);

  if (error) {
    redirectToOrganization(organizationId, "error", "Organization status could not be updated.");
  }

  await supabase.from("platform_activity_logs").insert({
    platform_admin_id: context.id,
    action: `organizations.${status === "active" ? "reactivated" : status}`,
    entity_type: "organization",
    entity_id: organizationId,
    metadata: { status },
  });

  if (organization?.owner_user_id) {
    await supabase.from("notifications").insert({
      company_id: organizationId,
      user_id: organization.owner_user_id,
      title: status === "active" ? "Organization reactivated" : "Organization lifecycle changed",
      message: `${organization.name ?? "Your organization"} is now ${status}.`,
      entity_type: "organization",
      entity_id: organizationId,
      link_href: status === "active" ? "/admin" : null,
      read: false,
    });
  }

  redirectToOrganization(organizationId, "notice", "updated");
}
