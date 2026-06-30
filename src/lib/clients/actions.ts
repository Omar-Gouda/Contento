"use server";

import { randomUUID } from "crypto";
import { redirect } from "next/navigation";

import { clientProfileSchema } from "@/lib/clients/schemas";
import { requireAuthContext } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth/permissions";
import type { Database, Json } from "@/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type DatabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

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

function normalizeClientSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}

function clientSlugSource(name: string, explicitSlug: string) {
  const source = explicitSlug || name;
  const slug = normalizeClientSlug(source);

  return slug || "client";
}

function slugWithSuffix(baseSlug: string, suffix: string) {
  const prefix = baseSlug
    .slice(0, Math.max(1, 120 - suffix.length))
    .replace(/-+$/g, "") || "client";

  return `${prefix}${suffix}`.slice(0, 120);
}

function isClientSlugUniqueError(error: DatabaseError | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  const details = error?.details?.toLowerCase() ?? "";

  return error?.code === "23505" && (
    message.includes("clients_slug_company_unique") ||
    details.includes("clients_slug_company_unique") ||
    message.includes("slug") ||
    details.includes("slug")
  );
}

function safeDatabaseMessage(message: string | undefined) {
  return message?.replace(/\s+/g, " ").trim().slice(0, 180);
}

function clientSaveErrorMessage(
  error: DatabaseError | null | undefined,
  slug: string,
  {
    hasFullClientManagement,
    isAccountManager,
  }: {
    hasFullClientManagement: boolean;
    isAccountManager: boolean;
  }
) {
  const safeMessage = safeDatabaseMessage(error?.message);
  const lowerMessage = safeMessage?.toLowerCase() ?? "";

  if (isClientSlugUniqueError(error)) {
    return `Slug "${slug}" is already used by another client in this organization. Choose a different slug.`;
  }

  if (error?.code === "42501" || lowerMessage.includes("row-level security")) {
    if (hasFullClientManagement) {
      return "Marketing Manager permission could not be resolved. Please check clients.manage/clients.create permissions.";
    }

    if (isAccountManager) {
      return "Account Managers can only save clients assigned to themselves.";
    }

    return "You do not have permission to save client profiles.";
  }

  if (error?.code === "CLIENT_UPDATE_NOT_ALLOWED") {
    return isAccountManager
      ? "Account Managers can only save clients assigned to themselves."
      : "Client was not found or is outside your workspace.";
  }

  if (error?.code === "23503") {
    return "One selected client relationship no longer exists or is outside this organization.";
  }

  if (error?.code === "23514") {
    return "Client profile failed a database validation rule. Check required fields, status, and slug format.";
  }

  return safeMessage
    ? `Client profile could not be saved: ${safeMessage}`
    : "Client profile could not be saved. Please try again.";
}

async function clientSlugExists(
  supabase: SupabaseServerClient,
  companyId: string,
  slug: string,
  clientId: string | null
) {
  let query = supabase
    .from("clients")
    .select("id")
    .eq("company_id", companyId)
    .eq("slug", slug);

  if (clientId) {
    query = query.neq("id", clientId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw new Error("Unable to validate client slug.");
  }

  return Boolean(data?.length);
}

async function uniqueGeneratedClientSlug(
  supabase: SupabaseServerClient,
  companyId: string,
  baseSlug: string,
  clientId: string | null
) {
  let candidate = baseSlug;

  for (let suffixNumber = 2; suffixNumber <= 20; suffixNumber += 1) {
    if (!(await clientSlugExists(supabase, companyId, candidate, clientId))) {
      return candidate;
    }

    candidate = slugWithSuffix(baseSlug, `-${suffixNumber}`);
  }

  return slugWithSuffix(baseSlug, `-${Math.random().toString(36).slice(2, 6).padEnd(4, "0")}`);
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
  const context = await requireAuthContext();
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
  const isCreate = !parsed.data.clientId;
  const canCreateClient =
    hasPermission(context, "clients.create", "limited") ||
    hasPermission(context, "clients.manage", "limited");
  const canUpdateClient =
    hasPermission(context, "clients.update", "limited") ||
    hasPermission(context, "clients.manage", "limited");
  const canAssignClients =
    hasPermission(context, "clients.assign", "full") ||
    hasPermission(context, "clients.assign_account_manager", "full");
  const hasFullClientManagement =
    hasPermission(context, "clients.create", "full") ||
    hasPermission(context, "clients.manage", "full");
  const isAccountManager = context.role === "supervisor";

  if (isCreate && !canCreateClient) {
    safeRedirect("/clients", "error", "Only Marketing Managers and Account Managers can create clients.");
  }

  if (!isCreate && !canUpdateClient) {
    safeRedirect(redirectTo, "error", "You do not have permission to update client profiles.");
  }

  const assignedAccountManagerId = isAccountManager
    ? context.userId
    : parsed.data.assignedAccountManagerId;
  const submittedAssignedUserIds = canAssignClients ? parsed.data.assignedUserIds : [];
  const assignedUserIds = Array.from(new Set([
    ...submittedAssignedUserIds,
    assignedAccountManagerId,
  ].filter(Boolean) as string[]));
  const shouldUpdateAssignments = canAssignClients || (isCreate && isAccountManager);

  try {
    await assertClientInScope(parsed.data.clientId, context.companyId);
    await assertUserInCompany(assignedAccountManagerId, context.companyId);
    await Promise.all(assignedUserIds.map((userId) => assertUserInCompany(userId, context.companyId)));
  } catch {
    safeRedirect(redirectTo, "error", "Client assignments must stay inside this organization.");
  }

  const supabase = await createSupabaseServerClient();
  const manualSlug = parsed.data.slug.trim().length > 0;
  const normalizedManualSlug = normalizeClientSlug(parsed.data.slug);

  if (manualSlug && !normalizedManualSlug) {
    safeRedirect(redirectTo, "error", "Slug must include at least one letter or number.");
  }

  const baseSlug = manualSlug ? normalizedManualSlug : clientSlugSource(parsed.data.name, "");
  let slug = baseSlug;
  let duplicateManualSlug = false;

  try {
    if (manualSlug) {
      duplicateManualSlug = await clientSlugExists(supabase, context.companyId, slug, parsed.data.clientId);
    } else {
      slug = await uniqueGeneratedClientSlug(supabase, context.companyId, baseSlug, parsed.data.clientId);
    }
  } catch {
    safeRedirect(redirectTo, "error", "Client slug could not be validated. Please try again.");
  }

  if (duplicateManualSlug) {
    safeRedirect(redirectTo, "error", `Slug "${slug}" is already used by another client in this organization. Choose a different slug.`);
  }

  const payload: Database["public"]["Tables"]["clients"]["Update"] = {
    company_id: context.companyId,
    name: parsed.data.name,
    slug,
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
    assigned_account_manager_id: assignedAccountManagerId,
    status: parsed.data.status,
  };

  let result: { data: { id: string } | null; error: DatabaseError | null } = { data: null, error: null };
  const maxSaveAttempts = manualSlug ? 1 : 8;
  let attemptedSlug = slug;
  const newClientId = parsed.data.clientId ?? randomUUID();

  for (let attempt = 0; attempt < maxSaveAttempts; attempt += 1) {
    const savePayload = { ...payload, slug };
    attemptedSlug = slug;
    if (parsed.data.clientId) {
      const updateResult = await supabase
        .from("clients")
        .update(savePayload, { count: "exact" })
        .eq("id", parsed.data.clientId)
        .eq("company_id", context.companyId);

      result = updateResult.error
        ? { data: null, error: updateResult.error }
        : updateResult.count === 1
          ? { data: { id: parsed.data.clientId }, error: null }
          : {
            data: null,
            error: {
              code: "CLIENT_UPDATE_NOT_ALLOWED",
              message: "Client update affected no rows.",
            },
          };
    } else {
      const insertResult = await supabase
        .from("clients")
        .insert({ ...savePayload, id: newClientId, created_by: context.userId });

      result = insertResult.error
        ? { data: null, error: insertResult.error }
        : { data: { id: newClientId }, error: null };
    }

    if (!result.error && result.data) {
      break;
    }

    if (manualSlug || !isClientSlugUniqueError(result.error)) {
      break;
    }

    slug = slugWithSuffix(baseSlug, `-${attempt + 2}`);
  }

  if (result.error || !result.data) {
    safeRedirect(redirectTo, "error", clientSaveErrorMessage(result.error, attemptedSlug, {
      hasFullClientManagement,
      isAccountManager,
    }));
  }

  const clientId = result.data.id;
  if (!shouldUpdateAssignments) {
    await logActivity(context, parsed.data.clientId ? "clients.updated" : "clients.created", clientId, {
      name: parsed.data.name,
      status: parsed.data.status,
      assigned_user_count: null,
    });
    safeRedirect(`/clients/${clientId}`, "notice", parsed.data.clientId ? "Client updated." : "Client created.");
  }

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
