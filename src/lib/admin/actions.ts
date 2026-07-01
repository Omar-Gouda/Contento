"use server";

import { randomBytes, createHash, randomUUID } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/context";
import {
  createCompanyUserSchema,
  inviteUserSchema,
  terminateUserSchema,
  updateInvitationStatusSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  updateUserTeamSchema,
} from "@/lib/admin/schemas";
import { hasSupabaseAdminConfig } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import { normalizeRoleName, type UserRole } from "@/types/roles";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function redirectWith(pathname: string, key: "notice" | "error", value: string): never {
  redirect(`${pathname}?${key}=${encodeURIComponent(value)}`);
}

async function getRequestOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  return process.env.NEXT_PUBLIC_SITE_URL ?? (host ? `${protocol}://${host}` : "http://localhost:3000");
}

async function assertRoleInCompany(roleId: string, companyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("roles")
    .select("id, name")
    .eq("id", roleId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Role does not belong to this company.");
  }

  return data.name;
}

async function assertTeamInCompany(teamId: string | null, companyId: string) {
  if (!teamId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Team does not belong to this company.");
  }
}

async function assertUserInCompany(userId: string, companyId: string) {
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

async function assertClientsInCompany(clientIds: string[], companyId: string) {
  if (!clientIds.length) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("company_id", companyId)
    .in("id", clientIds);

  if (error || (data?.length ?? 0) !== clientIds.length) {
    throw new Error("One or more clients do not belong to this company.");
  }
}

function clientAssignmentRoleForRole(
  role: UserRole
): Database["public"]["Tables"]["client_assignments"]["Row"]["assignment_role"] {
  if (role === "supervisor") {
    return "account_manager";
  }

  if (role === "creator") {
    return "content_creator";
  }

  if (role === "graphic-designer") {
    return "graphic_designer";
  }

  if (role === "video-editor") {
    return "video_editor";
  }

  if (role === "client") {
    return "client_contact";
  }

  return "member";
}

function normalizeClientSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120) || "client";
}

function slugWithSuffix(baseSlug: string, suffix: string) {
  const prefix = baseSlug
    .slice(0, Math.max(1, 120 - suffix.length))
    .replace(/-+$/g, "") || "client";

  return `${prefix}${suffix}`.slice(0, 120);
}

async function clientSlugExists(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  companyId: string,
  slug: string
) {
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("company_id", companyId)
    .eq("slug", slug)
    .limit(1);

  if (error) {
    throw new Error("Unable to validate client slug.");
  }

  return Boolean(data?.length);
}

async function uniqueClientSlug(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  companyId: string,
  clientName: string
) {
  const baseSlug = normalizeClientSlug(clientName);
  let candidate = baseSlug;

  for (let suffixNumber = 2; suffixNumber <= 20; suffixNumber += 1) {
    if (!(await clientSlugExists(supabase, companyId, candidate))) {
      return candidate;
    }

    candidate = slugWithSuffix(baseSlug, `-${suffixNumber}`);
  }

  return slugWithSuffix(baseSlug, `-${randomBytes(2).toString("hex")}`);
}

async function logAdminActivity(
  companyId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Json = {}
) {
  const supabase = await createSupabaseServerClient();
  await supabase.from("activity_logs").insert({
    company_id: companyId,
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
}

export async function inviteUserAction(formData: FormData) {
  const context = await requirePermission("users.invite", "full");
  const parsed = inviteUserSchema.safeParse({
    email: getFormString(formData, "email"),
    roleId: getFormString(formData, "roleId"),
    teamId: getFormString(formData, "teamId"),
    message: getFormString(formData, "message"),
  });

  if (!parsed.success) {
    redirectWith("/admin/invitations", "error", parsed.error.issues[0]?.message ?? "Invalid invitation.");
  }

  if (!hasSupabaseAdminConfig()) {
    redirectWith("/admin/invitations", "error", "Supabase service role is required to send invitations.");
  }

  try {
    await assertRoleInCompany(parsed.data.roleId, context.companyId);
    await assertTeamInCompany(parsed.data.teamId, context.companyId);
  } catch {
    redirectWith("/admin/invitations", "error", "Choose a valid company role and team.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("company_id", context.companyId)
    .eq("email", parsed.data.email)
    .maybeSingle();

  if (existingUser) {
    redirectWith("/admin/invitations", "error", "That email already belongs to a company user.");
  }

  const { data: pendingInvitation } = await supabase
    .from("user_invitations")
    .select("id")
    .eq("company_id", context.companyId)
    .eq("email", parsed.data.email)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingInvitation) {
    redirectWith("/admin/invitations", "error", "A pending invitation already exists for that email.");
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  const { data: invitation, error: invitationError } = await supabase
    .from("user_invitations")
    .insert({
      company_id: context.companyId,
      email: parsed.data.email,
      role_id: parsed.data.roleId,
      team_id: parsed.data.teamId,
      token_hash: tokenHash,
      status: "pending",
      message: parsed.data.message,
      invited_by: context.userId,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (invitationError || !invitation) {
    redirectWith("/admin/invitations", "error", "We could not create the invitation.");
  }

  const admin = createSupabaseAdminClient();
  const origin = await getRequestOrigin();
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/sign-in`,
    data: {
      contento_invitation_id: invitation.id,
      contento_company_id: context.companyId,
    },
  });

  if (inviteError) {
    await supabase.from("user_invitations").update({ status: "cancelled" }).eq("id", invitation.id);
    redirectWith("/admin/invitations", "error", "Invitation email could not be sent.");
  }

  await logAdminActivity(context.companyId, context.userId, "users.invited", "invitation", invitation.id, {
    email: parsed.data.email,
    role_id: parsed.data.roleId,
    team_id: parsed.data.teamId,
  });
  redirectWith("/admin/invitations", "notice", "invited");
}

export async function createCompanyUserAction(formData: FormData) {
  const context = await requirePermission("users.invite", "full");
  const parsed = createCompanyUserSchema.safeParse({
    email: getFormString(formData, "email"),
    firstName: getFormString(formData, "firstName"),
    lastName: getFormString(formData, "lastName"),
    roleId: getFormString(formData, "roleId"),
    teamId: getFormString(formData, "teamId"),
    clientIds: Array.from(
      new Set(formData.getAll("clientIds").filter((value): value is string => typeof value === "string" && Boolean(value)))
    ),
    clientName: getFormString(formData, "clientName"),
    clientLogoUrl: getFormString(formData, "clientLogoUrl"),
    clientPrimaryColor: getFormString(formData, "clientPrimaryColor"),
    clientSecondaryColor: getFormString(formData, "clientSecondaryColor"),
    clientContactPhone: getFormString(formData, "clientContactPhone"),
    clientBriefDriveLink: getFormString(formData, "clientBriefDriveLink"),
    clientNotes: getFormString(formData, "clientNotes"),
    assignedAccountManagerId: getFormString(formData, "assignedAccountManagerId"),
    status: getFormString(formData, "status") || "active",
    temporaryPassword: getFormString(formData, "temporaryPassword"),
    confirmTemporaryPassword: getFormString(formData, "confirmTemporaryPassword"),
  });

  if (!parsed.success) {
    redirectWith("/admin/users", "error", parsed.error.issues[0]?.message ?? "Invalid user.");
  }

  if (!hasSupabaseAdminConfig()) {
    redirectWith("/admin/users", "error", "Supabase service role is required to create users.");
  }

  let roleName = "";
  try {
    roleName = await assertRoleInCompany(parsed.data.roleId, context.companyId);
    await assertTeamInCompany(parsed.data.teamId, context.companyId);
    await assertClientsInCompany(parsed.data.clientIds, context.companyId);
    if (parsed.data.assignedAccountManagerId) {
      await assertUserInCompany(parsed.data.assignedAccountManagerId, context.companyId);
    }
  } catch {
    redirectWith("/admin/users", "error", "Choose valid company role, team, client, and account manager values.");
  }

  const normalizedRole = normalizeRoleName(roleName);

  if (!normalizedRole) {
    redirectWith("/admin/users", "error", "Selected role could not be resolved.");
  }

  if (normalizedRole === "client" && !parsed.data.clientName.trim()) {
    redirectWith("/admin/users", "error", "Client/company name is required for Client users.");
  }

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const { data: existingCompanyUser } = await admin
    .from("users")
    .select("id")
    .eq("email", parsed.data.email)
    .maybeSingle();

  if (existingCompanyUser) {
    redirectWith("/admin/users", "error", "That email already belongs to a Contento user.");
  }

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.temporaryPassword,
    email_confirm: true,
    user_metadata: {
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      contento_company_id: context.companyId,
    },
  });

  if (authError || !authUser.user) {
    redirectWith("/admin/users", "error", "Supabase Auth could not create this user.");
  }

  const createdAuthUserId = authUser.user.id;
  const { error: profileError } = await supabase.from("users").insert({
    id: createdAuthUserId,
    company_id: context.companyId,
    email: parsed.data.email,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    role_id: parsed.data.roleId,
    status: parsed.data.status,
    must_change_password: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(createdAuthUserId);
    redirectWith("/admin/users", "error", "Contento profile could not be created.");
  }

  if (parsed.data.teamId) {
    const { error: teamError } = await supabase
      .from("team_members")
      .insert({ team_id: parsed.data.teamId, user_id: createdAuthUserId });

    if (teamError) {
      await admin.from("team_members").delete().eq("user_id", createdAuthUserId);
      await admin.from("users").delete().eq("id", createdAuthUserId);
      await admin.auth.admin.deleteUser(createdAuthUserId);
      redirectWith("/admin/users", "error", "User team could not be assigned.");
    }
  }

  let createdClientId: string | null = null;

  if (normalizedRole === "client") {
    createdClientId = randomUUID();
    let clientSlug = "";

    try {
      clientSlug = await uniqueClientSlug(supabase, context.companyId, parsed.data.clientName);
    } catch {
      await admin.from("team_members").delete().eq("user_id", createdAuthUserId);
      await admin.from("users").delete().eq("id", createdAuthUserId);
      await admin.auth.admin.deleteUser(createdAuthUserId);
      redirectWith("/admin/users", "error", "Client slug could not be generated.");
    }

    const contactPerson = [parsed.data.firstName, parsed.data.lastName].filter(Boolean).join(" ").trim();
    const { error: clientError } = await supabase.from("clients").insert({
      id: createdClientId,
      company_id: context.companyId,
      name: parsed.data.clientName,
      slug: clientSlug,
      logo_url: parsed.data.clientLogoUrl,
      primary_color: parsed.data.clientPrimaryColor,
      secondary_color: parsed.data.clientSecondaryColor,
      accent_color: null,
      contact_person: contactPerson || null,
      contact_email: parsed.data.email,
      contact_phone: parsed.data.clientContactPhone || null,
      brief_drive_link: parsed.data.clientBriefDriveLink,
      notes: parsed.data.clientNotes,
      requirements: "",
      assigned_account_manager_id: parsed.data.assignedAccountManagerId,
      status: "active",
      created_by: context.userId,
    });

    if (clientError) {
      await admin.from("team_members").delete().eq("user_id", createdAuthUserId);
      await admin.from("users").delete().eq("id", createdAuthUserId);
      await admin.auth.admin.deleteUser(createdAuthUserId);
      redirectWith("/admin/users", "error", "Client profile could not be created for this Client user.");
    }

    const clientAssignmentRows: Database["public"]["Tables"]["client_assignments"]["Insert"][] = [
      {
        client_id: createdClientId,
        user_id: createdAuthUserId,
        assignment_role: "client_contact",
      },
    ];

    if (parsed.data.assignedAccountManagerId) {
      clientAssignmentRows.push({
        client_id: createdClientId,
        user_id: parsed.data.assignedAccountManagerId,
        assignment_role: "account_manager",
      });
    }

    const { error: assignmentError } = await supabase.from("client_assignments").insert(clientAssignmentRows);

    if (assignmentError) {
      await admin.from("client_assignments").delete().eq("client_id", createdClientId);
      await admin.from("clients").delete().eq("id", createdClientId);
      await admin.from("team_members").delete().eq("user_id", createdAuthUserId);
      await admin.from("users").delete().eq("id", createdAuthUserId);
      await admin.auth.admin.deleteUser(createdAuthUserId);
      redirectWith("/admin/users", "error", "Client login was created, but client access could not be linked.");
    }
  }

  const assignableRole = ["supervisor", "creator", "graphic-designer", "video-editor", "client"].includes(normalizedRole);
  if (normalizedRole !== "client" && assignableRole && parsed.data.clientIds.length > 0) {
    if (normalizedRole === "supervisor") {
      const { error: accountManagerError } = await supabase
        .from("clients")
        .update({ assigned_account_manager_id: createdAuthUserId })
        .eq("company_id", context.companyId)
        .in("id", parsed.data.clientIds);

      if (accountManagerError) {
        await admin.from("team_members").delete().eq("user_id", createdAuthUserId);
        await admin.from("users").delete().eq("id", createdAuthUserId);
        await admin.auth.admin.deleteUser(createdAuthUserId);
        redirectWith("/admin/users", "error", "Account Manager clients could not be assigned.");
      }
    }

    const { error: clientAssignmentError } = await supabase.from("client_assignments").insert(
      parsed.data.clientIds.map((clientId) => ({
        client_id: clientId,
        user_id: createdAuthUserId,
        assignment_role: clientAssignmentRoleForRole(normalizedRole),
      }))
    );

    if (clientAssignmentError) {
      await admin.from("client_assignments").delete().eq("user_id", createdAuthUserId);
      if (normalizedRole === "supervisor") {
        await admin
          .from("clients")
          .update({ assigned_account_manager_id: null })
          .eq("assigned_account_manager_id", createdAuthUserId);
      }
      await admin.from("team_members").delete().eq("user_id", createdAuthUserId);
      await admin.from("users").delete().eq("id", createdAuthUserId);
      await admin.auth.admin.deleteUser(createdAuthUserId);
      redirectWith("/admin/users", "error", "User client access could not be assigned.");
    }
  }

  await logAdminActivity(context.companyId, context.userId, "users.created", "user", createdAuthUserId, {
    email: parsed.data.email,
    role_id: parsed.data.roleId,
    team_id: parsed.data.teamId,
    client_ids: parsed.data.clientIds,
    created_client_id: createdClientId,
    status: parsed.data.status,
  });
  redirectWith("/admin/users", "notice", "created");
}

export async function updateInvitationStatusAction(formData: FormData) {
  const context = await requirePermission("users.invite", "full");
  const parsed = updateInvitationStatusSchema.safeParse({
    invitationId: getFormString(formData, "invitationId"),
    status: getFormString(formData, "status"),
  });

  if (!parsed.success) {
    redirectWith("/admin/invitations", "error", "Invalid invitation update.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("user_invitations")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.invitationId)
    .eq("company_id", context.companyId);

  if (error) {
    redirectWith("/admin/invitations", "error", "Invitation could not be updated.");
  }

  await logAdminActivity(context.companyId, context.userId, "users.invitation_status_updated", "invitation", parsed.data.invitationId, {
    status: parsed.data.status,
  });
  redirectWith("/admin/invitations", "notice", "updated");
}

export async function updateUserStatusAction(formData: FormData) {
  const context = await requirePermission("users.disable", "full");
  const parsed = updateUserStatusSchema.safeParse({
    userId: getFormString(formData, "userId"),
    status: getFormString(formData, "status"),
  });

  if (!parsed.success) {
    redirectWith("/admin/users", "error", "Invalid user status update.");
  }

  if (parsed.data.userId === context.userId) {
    redirectWith("/admin/users", "error", "You cannot change your own account status.");
  }

  try {
    await assertUserInCompany(parsed.data.userId, context.companyId);
  } catch {
    redirectWith("/admin/users", "error", "User does not belong to your company.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("users")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.userId)
    .eq("company_id", context.companyId);

  if (error) {
    redirectWith("/admin/users", "error", "User status could not be updated.");
  }

  await logAdminActivity(context.companyId, context.userId, "users.status_updated", "user", parsed.data.userId, {
    status: parsed.data.status,
  });
  redirectWith("/admin/users", "notice", "updated");
}

export async function updateUserRoleAction(formData: FormData) {
  const context = await requirePermission("users.assign_role", "full");
  const parsed = updateUserRoleSchema.safeParse({
    userId: getFormString(formData, "userId"),
    roleId: getFormString(formData, "roleId"),
  });

  if (!parsed.success) {
    redirectWith("/admin/users", "error", "Invalid role update.");
  }

  if (parsed.data.userId === context.userId) {
    redirectWith("/admin/users", "error", "You cannot change your own role.");
  }

  try {
    await assertUserInCompany(parsed.data.userId, context.companyId);
    await assertRoleInCompany(parsed.data.roleId, context.companyId);
  } catch {
    redirectWith("/admin/users", "error", "Choose a valid company user and role.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("users")
    .update({ role_id: parsed.data.roleId })
    .eq("id", parsed.data.userId)
    .eq("company_id", context.companyId);

  if (error) {
    redirectWith("/admin/users", "error", "User role could not be updated.");
  }

  await logAdminActivity(context.companyId, context.userId, "users.role_updated", "user", parsed.data.userId, {
    role_id: parsed.data.roleId,
  });
  redirectWith("/admin/users", "notice", "updated");
}

export async function updateUserTeamAction(formData: FormData) {
  const context = await requirePermission("teams.assign_members", "full");
  const parsed = updateUserTeamSchema.safeParse({
    userId: getFormString(formData, "userId"),
    teamId: getFormString(formData, "teamId"),
  });

  if (!parsed.success) {
    redirectWith("/admin/users", "error", "Invalid team update.");
  }

  try {
    await assertUserInCompany(parsed.data.userId, context.companyId);
    await assertTeamInCompany(parsed.data.teamId, context.companyId);
  } catch {
    redirectWith("/admin/users", "error", "Choose a valid company user and team.");
  }

  const supabase = await createSupabaseServerClient();
  const { error: deleteError } = await supabase
    .from("team_members")
    .delete()
    .eq("user_id", parsed.data.userId);

  if (deleteError) {
    redirectWith("/admin/users", "error", "User team could not be updated.");
  }

  if (parsed.data.teamId) {
    const { error: insertError } = await supabase
      .from("team_members")
      .insert({ team_id: parsed.data.teamId, user_id: parsed.data.userId });

    if (insertError) {
      redirectWith("/admin/users", "error", "User team could not be assigned.");
    }
  }

  await logAdminActivity(context.companyId, context.userId, "users.team_updated", "user", parsed.data.userId, {
    team_id: parsed.data.teamId,
  });
  redirectWith("/admin/users", "notice", "updated");
}

export async function terminateUserAction(formData: FormData) {
  const context = await requirePermission("users.disable", "full");
  const parsed = terminateUserSchema.safeParse({
    userId: getFormString(formData, "userId"),
    mode: getFormString(formData, "mode"),
    confirmation: getFormString(formData, "confirmation"),
  });

  if (!parsed.success) {
    redirectWith("/admin/users", "error", parsed.error.issues[0]?.message ?? "Invalid termination request.");
  }

  if (context.role !== "admin") {
    redirectWith("/admin/users", "error", "Only Marketing Managers can delete company users.");
  }

  if (parsed.data.userId === context.userId) {
    redirectWith("/admin/users", "error", "You cannot delete your own account through this flow.");
  }

  if (!hasSupabaseAdminConfig()) {
    redirectWith("/admin/users", "error", "Supabase service role is required to delete users.");
  }

  try {
    await assertUserInCompany(parsed.data.userId, context.companyId);
  } catch {
    redirectWith("/admin/users", "error", "User does not belong to your company.");
  }

  const admin = createSupabaseAdminClient();

  if (parsed.data.mode === "remove_content") {
    const deleteSteps = [
      admin
        .from("reports")
        .delete()
        .eq("company_id", context.companyId)
        .eq("user_id", parsed.data.userId),
      admin
        .from("content_items")
        .delete()
        .eq("company_id", context.companyId)
        .or(`creator_id.eq.${parsed.data.userId},final_output_submitted_by.eq.${parsed.data.userId}`),
      admin
        .from("ideas")
        .delete()
        .eq("company_id", context.companyId)
        .or(`created_by.eq.${parsed.data.userId},assigned_to.eq.${parsed.data.userId}`),
      admin
        .from("tasks")
        .delete()
        .eq("company_id", context.companyId)
        .or(`assigned_to.eq.${parsed.data.userId},assigned_by.eq.${parsed.data.userId},created_by.eq.${parsed.data.userId},final_output_submitted_by.eq.${parsed.data.userId}`),
    ];

    const deleteResults = await Promise.all(deleteSteps);
    const deleteError = deleteResults.find((result) => result.error)?.error;

    if (deleteError) {
      redirectWith("/admin/users", "error", "Owned work could not be removed safely.");
    }
  }

  await logAdminActivity(context.companyId, context.userId, "users.terminated", "user", parsed.data.userId, {
    mode: parsed.data.mode,
  });

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(parsed.data.userId);

  if (authDeleteError) {
    redirectWith("/admin/users", "error", "Supabase Auth user could not be deleted.");
  }

  redirectWith(
    "/admin/users",
    "notice",
    parsed.data.mode === "remove_content" ? "deleted-with-content" : "deleted-keep-content"
  );
}
