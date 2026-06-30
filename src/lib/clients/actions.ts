"use server";

import { redirect } from "next/navigation";

import { clientProfileSchema } from "@/lib/clients/schemas";
import { requirePermission } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth/permissions";
import type { Database, Json } from "@/types/database";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formStringArray(formData: FormData, key: string) {
  return formData.getAll(key).filter((value): value is string => typeof value === "string");
}

function safeRedirect(pathname: string, key: "notice" | "error", value: string): never {
  const destination = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/clients";
  const separator = destination.includes("?") ? "&" : "?";

  redirect(`${destination}${separator}${key}=${encodeURIComponent(value)}`);
}

function clientSlug(name: string, explicitSlug: string) {
  const source = explicitSlug || name;

  return source
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}

async function assertUserInCompany(userId: string | null, companyId: string) {
  if (!userId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("User does not belong to this company.");
  }
}

async function assertClientInScope(clientId: string | null, companyId: string) {
  if (!clientId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Client does not belong to your accessible company scope.");
  }
}

async function logActivity(
  context: AuthContext,
  action: string,
  entityId: string | null,
  metadata: Json = {}
) {
  const supabase = await createSupabaseServerClient();
  await supabase.from("activity_logs").insert({
    company_id: context.companyId,
    user_id: context.userId,
    action,
    entity_type: "client",
    entity_id: entityId,
    metadata,
  });
}

function assignmentRoleForUserRole(roleName: string | null | undefined) {
  const normalized = (roleName ?? "").trim().toLowerCase();

  if (normalized === "supervisor" || normalized === "account manager") {
    return "account_manager";
  }

  if (normalized === "creator" || normalized === "content creator") {
    return "content_creator";
  }

  if (normalized === "graphic designer") {
    return "graphic_designer";
  }

  if (normalized === "video editor") {
    return "video_editor";
  }

  if (normalized === "client") {
    return "client_contact";
  }

  return "member";
}

export async function saveClientAction(formData: FormData) {
  const context = await requirePermission("clients.manage", "limited");
  const parsed = clientProfileSchema.safeParse({
    clientId: formString(formData, "clientId"),
    name: formString(formData, "name"),
    slug: formString(formData, "slug"),
    logoUrl: formString(formData, "logoUrl"),
    primaryColor: formString(formData, "primaryColor"),
    secondaryColor: formString(formData, "secondaryColor"),
    accentColor: formString(formData, "accentColor"),
    contactPerson: formString(formData, "contactPerson"),
    contactEmail: formString(formData, "contactEmail"),
    contactPhone: formString(formData, "contactPhone"),
    briefDriveLink: formString(formData, "briefDriveLink"),
    notes: formString(formData, "notes"),
    requirements: formString(formData, "requirements"),
    assignedAccountManagerId: formString(formData, "assignedAccountManagerId"),
    assignedUserIds: formStringArray(formData, "assignedUserIds"),
    status: formString(formData, "status") || "active",
  });

  if (!parsed.success) {
    safeRedirect("/clients", "error", parsed.error.issues[0]?.message ?? "Invalid client profile.");
  }

  const redirectTo = parsed.data.clientId ? `/clients/${parsed.data.clientId}` : "/clients";
  const assignedUserIds = Array.from(new Set([
    ...parsed.data.assignedUserIds,
    parsed.data.assignedAccountManagerId,
  ].filter(Boolean) as string[]));

  try {
    await assertClientInScope(parsed.data.clientId, context.companyId);
    await assertUserInCompany(parsed.data.assignedAccountManagerId, context.companyId);
    await Promise.all(assignedUserIds.map((userId) => assertUserInCompany(userId, context.companyId)));
  } catch {
    safeRedirect(redirectTo, "error", "Client assignments must stay inside this organization.");
  }

  const supabase = await createSupabaseServerClient();
  const slug = clientSlug(parsed.data.name, parsed.data.slug);
  const payload: Database["public"]["Tables"]["clients"]["Update"] = {
    company_id: context.companyId,
    name: parsed.data.name,
    slug: slug || null,
    logo_url: parsed.data.logoUrl,
    primary_color: parsed.data.primaryColor,
    secondary_color: parsed.data.secondaryColor,
    accent_color: parsed.data.accentColor,
    contact_person: parsed.data.contactPerson || null,
    contact_email: parsed.data.contactEmail,
    contact_phone: parsed.data.contactPhone || null,
    brief_drive_link: parsed.data.briefDriveLink,
    notes: parsed.data.notes,
    requirements: parsed.data.requirements,
    assigned_account_manager_id: parsed.data.assignedAccountManagerId,
    status: parsed.data.status,
  };

  const result = parsed.data.clientId
    ? await supabase
      .from("clients")
      .update(payload)
      .eq("id", parsed.data.clientId)
      .eq("company_id", context.companyId)
      .select("id")
      .single()
    : await supabase
      .from("clients")
      .insert({ ...payload, created_by: context.userId })
      .select("id")
      .single();

  if (result.error || !result.data) {
    safeRedirect(redirectTo, "error", "Client profile could not be saved. Check for a duplicate slug.");
  }

  const clientId = result.data.id;
  const { data: assignedUsers, error: assignedUsersError } = assignedUserIds.length
    ? await supabase
      .from("users")
      .select("id, role_id, roles(name)")
      .eq("company_id", context.companyId)
      .in("id", assignedUserIds)
    : { data: [], error: null };

  if (assignedUsersError) {
    safeRedirect(`/clients/${clientId}`, "error", "Client profile saved, but assignments could not be resolved.");
  }

  const assignmentRows = ((assignedUsers as Array<{
    id: string;
    roles: { name: string } | null;
  }> | null) ?? []).map((user) => ({
    client_id: clientId,
    user_id: user.id,
    assignment_role: user.id === parsed.data.assignedAccountManagerId
      ? "account_manager"
      : assignmentRoleForUserRole(user.roles?.name),
  }));

  await supabase.from("client_assignments").delete().eq("client_id", clientId);

  if (assignmentRows.length) {
    const { error: assignmentError } = await supabase.from("client_assignments").insert(assignmentRows);

    if (assignmentError) {
      safeRedirect(`/clients/${clientId}`, "error", "Client profile saved, but assignments could not be updated.");
    }
  }

  await logActivity(context, parsed.data.clientId ? "clients.updated" : "clients.created", clientId, {
    name: parsed.data.name,
    status: parsed.data.status,
    assigned_user_count: assignmentRows.length,
  });
  safeRedirect(`/clients/${clientId}`, "notice", parsed.data.clientId ? "Client updated." : "Client created.");
}
