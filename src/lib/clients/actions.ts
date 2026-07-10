"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clientAssignmentSchema, clientProfileSchema } from "@/lib/clients/schemas";
import { requireAuthContext } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import { demoWriteMarker } from "@/lib/demo/markers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth/permissions";
import type { Database, Json } from "@/types/database";
import { isProductionRole, normalizeRoleName } from "@/types/roles";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type DatabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};
type ClientAssignmentRole = Database["public"]["Tables"]["client_assignments"]["Row"]["assignment_role"];
type ClientAssignmentUser = {
  id: string;
  company_id: string;
  role_id: string | null;
  roleName: string | null;
};
type ClientAssignmentClient = Pick<
  Database["public"]["Tables"]["clients"]["Row"],
  "id" | "company_id" | "assigned_account_manager_id" | "name"
>;

const imageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

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

  revalidatePath("/", "layout");
  revalidatePath(destination);
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
    ...demoWriteMarker(context),
  });
}

function assignmentRoleForUserRole(roleName: string | null | undefined): ClientAssignmentRole {
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

function cleanRedirectTo(value: string | null | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/clients";
}

function revalidateClientAssignmentPaths(clientId: string, userId: string, redirectTo?: string | null) {
  revalidatePath("/", "layout");
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/admin/users");
  revalidatePath(`/users/${userId}`);
  revalidatePath("/team");
  revalidatePath("/admin/teams");

  const destination = cleanRedirectTo(redirectTo);
  if (!["/clients", `/clients/${clientId}`, "/admin/users", `/users/${userId}`, "/team", "/admin/teams"].includes(destination)) {
    revalidatePath(destination);
  }
}

async function loadClientAssignmentScope(
  supabase: SupabaseServerClient,
  context: AuthContext,
  clientId: string,
  userId: string
) {
  const [{ data: client, error: clientError }, { data: user, error: userError }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, company_id, assigned_account_manager_id, name")
      .eq("id", clientId)
      .eq("company_id", context.companyId)
      .maybeSingle(),
    supabase
      .from("users")
      .select("id, company_id, role_id")
      .eq("id", userId)
      .eq("company_id", context.companyId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  if (clientError || !client) {
    throw new Error("Client is outside your organization.");
  }

  if (userError || !user) {
    throw new Error("Choose an active user inside your organization.");
  }

  let roleName: string | null = null;
  if (user.role_id) {
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("name")
      .eq("id", user.role_id)
      .eq("company_id", context.companyId)
      .maybeSingle();

    if (roleError || !role) {
      throw new Error("User role could not be resolved.");
    }

    roleName = role.name;
  }

  return {
    client: client as ClientAssignmentClient,
    user: {
      ...user,
      roleName,
    } as ClientAssignmentUser,
  };
}

async function usersShareTeam(supabase: SupabaseServerClient, currentUserId: string, targetUserId: string) {
  const { data, error } = await supabase
    .from("team_members")
    .select("team_id, user_id")
    .in("user_id", [currentUserId, targetUserId]);

  if (error) {
    return false;
  }

  const memberships = (data as Array<{ team_id: string; user_id: string }> | null) ?? [];
  const currentTeamIds = new Set(
    memberships
      .filter((membership) => membership.user_id === currentUserId)
      .map((membership) => membership.team_id)
  );

  return memberships.some((membership) => membership.user_id === targetUserId && currentTeamIds.has(membership.team_id));
}

async function assertCanManageClientAssignment({
  supabase,
  context,
  client,
  user,
  assignmentRole,
}: {
  supabase: SupabaseServerClient;
  context: AuthContext;
  client: ClientAssignmentClient;
  user: ClientAssignmentUser;
  assignmentRole: ClientAssignmentRole;
}) {
  const hasFullAssignmentAccess =
    hasPermission(context, "clients.assign", "full") ||
    hasPermission(context, "clients.assign_account_manager", "full");

  if (hasFullAssignmentAccess) {
    return;
  }

  const hasScopedAssignmentAccess =
    context.role === "supervisor" &&
    (
      hasPermission(context, "clients.assign", "limited") ||
      hasPermission(context, "clients.assign_account_manager", "limited")
    );

  if (!hasScopedAssignmentAccess || client.assigned_account_manager_id !== context.userId) {
    throw new Error("You can manage assignments only for clients assigned to you.");
  }

  const targetRole = normalizeRoleName(user.roleName);
  const targetIsProductionUser = isProductionRole(targetRole);
  const targetSharesTeam = await usersShareTeam(supabase, context.userId, user.id);

  if (
    !targetIsProductionUser ||
    !["content_creator", "graphic_designer", "video_editor"].includes(assignmentRole) ||
    !targetSharesTeam
  ) {
    throw new Error("Account Managers can assign only same-team production users to their assigned clients.");
  }
}

async function updateClientContactUserStatus(
  supabase: SupabaseServerClient,
  companyId: string,
  clientId: string,
  status: Database["public"]["Enums"]["user_status"]
) {
  const { data: assignments } = await supabase
    .from("client_assignments")
    .select("user_id")
    .eq("client_id", clientId)
    .eq("assignment_role", "client_contact");

  const userIds = ((assignments as Array<{ user_id: string }> | null) ?? []).map((assignment) => assignment.user_id);

  if (!userIds.length) {
    return;
  }

  await supabase
    .from("users")
    .update({ status })
    .eq("company_id", companyId)
    .in("id", userIds);
}

export async function assignClientUserAction(formData: FormData) {
  const context = await requireAuthContext();
  const parsed = clientAssignmentSchema.safeParse({
    clientId: formString(formData, "clientId"),
    userId: formString(formData, "userId"),
    assignmentRole: formString(formData, "assignmentRole") || undefined,
    redirectTo: formString(formData, "redirectTo") || "/clients",
  });
  const redirectTo = cleanRedirectTo(formString(formData, "redirectTo") || "/clients");

  if (!parsed.success) {
    safeRedirect(redirectTo, "error", parsed.error.issues[0]?.message ?? "Invalid assignment.");
  }

  const supabase = await createSupabaseServerClient();

  try {
    const { client, user } = await loadClientAssignmentScope(
      supabase,
      context,
      parsed.data.clientId,
      parsed.data.userId
    );
    const targetRole = normalizeRoleName(user.roleName);
    const assignmentRole = parsed.data.assignmentRole ?? assignmentRoleForUserRole(user.roleName);

    if (assignmentRole === "account_manager" && targetRole !== "supervisor") {
      throw new Error("Choose an Account Manager for the account manager assignment.");
    }

    await assertCanManageClientAssignment({ supabase, context, client, user, assignmentRole });

    if (assignmentRole === "account_manager") {
      const { error: accountManagerError } = await supabase
        .from("clients")
        .update({ assigned_account_manager_id: user.id, ...demoWriteMarker(context) })
        .eq("id", client.id)
        .eq("company_id", context.companyId);

      if (accountManagerError) {
        throw new Error("Account Manager could not be assigned to this client.");
      }
    }

    const { error } = await supabase.from("client_assignments").insert({
      client_id: client.id,
      user_id: user.id,
      assignment_role: assignmentRole,
      ...demoWriteMarker(context),
    });

    if (error && error.code !== "23505") {
      throw new Error("Client assignment could not be saved.");
    }

    await logActivity(context, "clients.user_assigned", client.id, {
      user_id: user.id,
      assignment_role: assignmentRole,
      duplicate_ignored: error?.code === "23505",
    });
    revalidateClientAssignmentPaths(client.id, user.id, parsed.data.redirectTo);
    safeRedirect(redirectTo, "notice", error?.code === "23505" ? "User is already assigned to this client." : "Client assignment saved.");
  } catch (error) {
    safeRedirect(redirectTo, "error", error instanceof Error ? error.message : "Client assignment could not be saved.");
  }
}

export async function removeClientUserAssignmentAction(formData: FormData) {
  const context = await requireAuthContext();
  const parsed = clientAssignmentSchema.safeParse({
    clientId: formString(formData, "clientId"),
    userId: formString(formData, "userId"),
    assignmentRole: formString(formData, "assignmentRole") || undefined,
    redirectTo: formString(formData, "redirectTo") || "/clients",
  });
  const redirectTo = cleanRedirectTo(formString(formData, "redirectTo") || "/clients");

  if (!parsed.success) {
    safeRedirect(redirectTo, "error", parsed.error.issues[0]?.message ?? "Invalid assignment.");
  }

  if (!parsed.data.assignmentRole) {
    safeRedirect(redirectTo, "error", "Choose a valid assignment to remove.");
  }

  const supabase = await createSupabaseServerClient();

  try {
    const { client, user } = await loadClientAssignmentScope(
      supabase,
      context,
      parsed.data.clientId,
      parsed.data.userId
    );

    await assertCanManageClientAssignment({
      supabase,
      context,
      client,
      user,
      assignmentRole: parsed.data.assignmentRole,
    });

    const { error } = await supabase
      .from("client_assignments")
      .delete()
      .eq("client_id", client.id)
      .eq("user_id", user.id)
      .eq("assignment_role", parsed.data.assignmentRole);

    if (error) {
      throw new Error("Client assignment could not be removed.");
    }

    if (parsed.data.assignmentRole === "account_manager" && client.assigned_account_manager_id === user.id) {
      const { error: accountManagerError } = await supabase
        .from("clients")
        .update({ assigned_account_manager_id: null, ...demoWriteMarker(context) })
        .eq("id", client.id)
        .eq("company_id", context.companyId);

      if (accountManagerError) {
        throw new Error("Client assignment was removed, but account manager ownership could not be cleared.");
      }
    }

    await logActivity(context, "clients.user_unassigned", client.id, {
      user_id: user.id,
      assignment_role: parsed.data.assignmentRole,
    });
    revalidateClientAssignmentPaths(client.id, user.id, parsed.data.redirectTo);
    safeRedirect(redirectTo, "notice", "Client assignment removed.");
  } catch (error) {
    safeRedirect(redirectTo, "error", error instanceof Error ? error.message : "Client assignment could not be removed.");
  }
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
    contractStartDate: formString(formData, "contractStartDate"),
    contractEndDate: formString(formData, "contractEndDate"),
    disabledReason: formString(formData, "disabledReason"),
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

  if (isCreate && context.role !== "admin") {
    safeRedirect("/clients", "error", "Client profiles are created when Marketing Managers create Client users.");
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
    contract_start_date: parsed.data.contractStartDate,
    contract_end_date: parsed.data.contractEndDate,
    disabled_reason: parsed.data.status === "active" ? null : parsed.data.disabledReason || null,
    disabled_at: parsed.data.status === "active" ? null : new Date().toISOString(),
    status: parsed.data.status,
    ...demoWriteMarker(context),
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
  await updateClientContactUserStatus(
    supabase,
    context.companyId,
    clientId,
    parsed.data.status === "active" ? "active" : "disabled"
  );

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
    ...demoWriteMarker(context),
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

export async function updateClientLifecycleAction(formData: FormData) {
  const context = await requireAuthContext();
  const clientId = formString(formData, "clientId");
  const status = formString(formData, "status");
  const disabledReason = formString(formData, "disabledReason").trim();
  const canUpdateClient =
    hasPermission(context, "clients.update", "limited") ||
    hasPermission(context, "clients.manage", "limited");

  if (!clientId) {
    safeRedirect("/clients", "error", "Client profile could not be resolved.");
  }

  if (!canUpdateClient || context.role !== "admin") {
    safeRedirect(`/clients/${clientId}`, "error", "Only Marketing Managers can change client lifecycle status.");
  }

  if (!["active", "disabled", "expired", "archived"].includes(status)) {
    safeRedirect(`/clients/${clientId}`, "error", "Choose a valid client status.");
  }

  try {
    await assertClientInScope(clientId, context.companyId);
  } catch {
    safeRedirect("/clients", "error", "Client profile is outside your organization.");
  }

  const supabase = await createSupabaseServerClient();
  const nextStatus = status as Database["public"]["Tables"]["clients"]["Row"]["status"];
  const { error } = await supabase
    .from("clients")
    .update({
      status: nextStatus,
      disabled_at: nextStatus === "active" ? null : new Date().toISOString(),
      disabled_reason: nextStatus === "active" ? null : disabledReason || (nextStatus === "expired" ? "Contract end date has passed." : "Manually disabled."),
      ...demoWriteMarker(context),
    })
    .eq("id", clientId)
    .eq("company_id", context.companyId);

  if (error) {
    safeRedirect(`/clients/${clientId}`, "error", "Client lifecycle status could not be updated.");
  }

  await updateClientContactUserStatus(supabase, context.companyId, clientId, nextStatus === "active" ? "active" : "disabled");
  await logActivity(context, "clients.lifecycle_updated", clientId, { status: nextStatus });
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  safeRedirect(`/clients/${clientId}`, "notice", nextStatus === "active" ? "Client reactivated." : "Client disabled.");
}

export async function deleteClientAction(formData: FormData) {
  const context = await requireAuthContext();
  const clientId = formString(formData, "clientId");

  if (!clientId) {
    safeRedirect("/clients", "error", "Client profile could not be resolved.");
  }

  if (context.role !== "admin" || !hasPermission(context, "clients.manage", "limited")) {
    safeRedirect(`/clients/${clientId}`, "error", "Only Marketing Managers can delete client profiles.");
  }

  try {
    await assertClientInScope(clientId, context.companyId);
  } catch {
    safeRedirect("/clients", "error", "Client profile is outside your organization.");
  }

  const supabase = await createSupabaseServerClient();
  await updateClientContactUserStatus(supabase, context.companyId, clientId, "disabled");
  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", clientId)
    .eq("company_id", context.companyId);

  if (error) {
    safeRedirect(`/clients/${clientId}`, "error", "Client profile could not be deleted.");
  }

  await logActivity(context, "clients.deleted", clientId, {});
  revalidatePath("/clients");
  safeRedirect("/clients", "notice", "Client deleted.");
}

export async function uploadClientLogoAction(formData: FormData) {
  const context = await requireAuthContext();
  const clientId = formString(formData, "clientId");
  const file = formData.get("logo");
  const canUpdateClient =
    hasPermission(context, "clients.update", "limited") ||
    hasPermission(context, "clients.manage", "limited");

  if (!clientId) {
    safeRedirect("/clients", "error", "Client profile could not be resolved.");
  }

  if (context.isDemo) {
    safeRedirect(`/clients/${clientId}`, "error", "This action is disabled in demo mode.");
  }

  if (!canUpdateClient) {
    safeRedirect(`/clients/${clientId}`, "error", "You do not have permission to update client profiles.");
  }

  if (!(file instanceof File) || file.size === 0) {
    safeRedirect(`/clients/${clientId}`, "error", "Choose a client logo image.");
  }

  if (file.size > 5 * 1024 * 1024) {
    safeRedirect(`/clients/${clientId}`, "error", "Client logo must be 5 MB or smaller.");
  }

  const extension = imageTypes.get(file.type);

  if (!extension) {
    safeRedirect(`/clients/${clientId}`, "error", "Client logo must be a JPG, PNG, WebP, or GIF image.");
  }

  try {
    await assertClientInScope(clientId, context.companyId);
  } catch {
    safeRedirect("/clients", "error", "Client profile is outside your organization.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: currentClient, error: loadError } = await supabase
    .from("clients")
    .select("logo_url")
    .eq("id", clientId)
    .eq("company_id", context.companyId)
    .maybeSingle();

  if (loadError || !currentClient) {
    safeRedirect("/clients", "error", "Client profile could not be loaded.");
  }

  const path = `${context.companyId}/clients/${clientId}/logo-${randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("contento-avatars")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    safeRedirect(`/clients/${clientId}`, "error", "Client logo could not be uploaded. Try a smaller image or another file.");
  }

  const { error } = await supabase
    .from("clients")
    .update({ logo_url: path, ...demoWriteMarker(context) })
    .eq("id", clientId)
    .eq("company_id", context.companyId);

  if (error) {
    await supabase.storage.from("contento-avatars").remove([path]);
    safeRedirect(`/clients/${clientId}`, "error", "Client logo could not be saved.");
  }

  if (currentClient.logo_url && !currentClient.logo_url.startsWith("http")) {
    await supabase.storage.from("contento-avatars").remove([currentClient.logo_url]);
  }

  await logActivity(context, "clients.logo_updated", clientId, {});
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  safeRedirect(`/clients/${clientId}`, "notice", "Client logo updated.");
}

export async function removeClientLogoAction(formData: FormData) {
  const context = await requireAuthContext();
  const clientId = formString(formData, "clientId");
  const canUpdateClient =
    hasPermission(context, "clients.update", "limited") ||
    hasPermission(context, "clients.manage", "limited");

  if (!clientId) {
    safeRedirect("/clients", "error", "Client profile could not be resolved.");
  }

  if (!canUpdateClient) {
    safeRedirect(`/clients/${clientId}`, "error", "You do not have permission to update client profiles.");
  }

  try {
    await assertClientInScope(clientId, context.companyId);
  } catch {
    safeRedirect("/clients", "error", "Client profile is outside your organization.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: currentClient, error: loadError } = await supabase
    .from("clients")
    .select("logo_url")
    .eq("id", clientId)
    .eq("company_id", context.companyId)
    .maybeSingle();

  if (loadError || !currentClient) {
    safeRedirect("/clients", "error", "Client profile could not be loaded.");
  }

  const { error } = await supabase
    .from("clients")
    .update({ logo_url: null, ...demoWriteMarker(context) })
    .eq("id", clientId)
    .eq("company_id", context.companyId);

  if (error) {
    safeRedirect(`/clients/${clientId}`, "error", "Client logo could not be removed.");
  }

  if (currentClient.logo_url && !currentClient.logo_url.startsWith("http")) {
    await supabase.storage.from("contento-avatars").remove([currentClient.logo_url]);
  }

  await logActivity(context, "clients.logo_removed", clientId, {});
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  safeRedirect(`/clients/${clientId}`, "notice", "Client logo removed.");
}
