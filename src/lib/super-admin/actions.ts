"use server";

import { redirect } from "next/navigation";

import { requireSuperiorAdminContext } from "@/lib/auth/context";
import { hasSupabaseAdminConfig } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOrganizationSchema } from "@/lib/super-admin/schemas";
import type { Json } from "@/types/database";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function redirectWith(key: "notice" | "error", value: string): never {
  redirect(`/super-admin/organizations?${key}=${encodeURIComponent(value)}`);
}

function redirectToOrganization(id: string, key: "notice" | "error", value: string): never {
  redirect(`/super-admin/organizations/${id}?${key}=${encodeURIComponent(value)}`);
}

function organizationErrorMessage(error: { code?: string; message?: string }) {
  const message = error.message ?? "";

  if (error.code === "23505" || message.includes("companies_slug_key")) {
    return "That organization slug is already in use.";
  }

  if (message.includes("CONTENTO_ORG_ADMIN_PROFILE_EXISTS")) {
    return "That admin already has an organization profile.";
  }

  if (message.includes("CONTENTO_SUPERIOR_ADMIN_REQUIRED")) {
    return "Superior admin access is required.";
  }

  return "The organization could not be created.";
}

export async function createOrganizationAction(formData: FormData) {
  await requireSuperiorAdminContext();

  if (!hasSupabaseAdminConfig()) {
    redirectWith("error", "Supabase service role is required to create organization admins.");
  }

  const parsed = createOrganizationSchema.safeParse({
    companyName: getFormString(formData, "companyName"),
    companySlug: getFormString(formData, "companySlug"),
    adminEmail: getFormString(formData, "adminEmail"),
    adminFirstName: getFormString(formData, "adminFirstName"),
    adminLastName: getFormString(formData, "adminLastName"),
    adminPassword: getFormString(formData, "adminPassword"),
  });

  if (!parsed.success) {
    redirectWith("error", parsed.error.issues[0]?.message ?? "Check organization details.");
  }

  const admin = createSupabaseAdminClient();
  const { data: authUser, error: createUserError } = await admin.auth.admin.createUser({
    email: parsed.data.adminEmail,
    password: parsed.data.adminPassword,
    email_confirm: true,
    user_metadata: {
      first_name: parsed.data.adminFirstName,
      last_name: parsed.data.adminLastName,
      contento_role: "organization_admin",
    },
  });

  if (createUserError || !authUser.user) {
    redirectWith("error", createUserError?.message ?? "The organization admin auth account could not be created.");
  }

  const supabase = await createSupabaseServerClient();
  const { error: organizationError } = await supabase.rpc("create_organization_with_admin_profile", {
    company_name: parsed.data.companyName,
    company_slug: parsed.data.companySlug,
    admin_user_id: authUser.user.id,
    admin_email: parsed.data.adminEmail,
    admin_first_name: parsed.data.adminFirstName,
    admin_last_name: parsed.data.adminLastName,
  });

  if (organizationError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    redirectWith("error", organizationErrorMessage(organizationError));
  }

  redirectWith("notice", "created");
}

function storagePath(value: string | null | undefined) {
  if (!value || value.startsWith("http://") || value.startsWith("https://")) {
    return null;
  }

  return value;
}

async function countRows(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  companyId: string,
  table:
    | "users"
    | "clients"
    | "teams"
    | "tasks"
    | "ideas"
    | "content_items"
    | "reports"
    | "calendar_events"
    | "day_off_requests"
    | "notifications"
    | "chat_messages"
    | "attachments"
) {
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);

  return count ?? 0;
}

async function getDeletionArtifacts(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  organizationId: string
) {
  const [
    { data: users },
    { data: clients },
    { data: organization },
    { data: attachments },
    usersCount,
    clientsCount,
    teams,
    tasks,
    ideas,
    content,
    reports,
    calendarEvents,
    dayOffRequests,
    notifications,
    chatMessages,
    files,
  ] = await Promise.all([
    supabase.from("users").select("id, avatar_url").eq("company_id", organizationId),
    supabase.from("clients").select("logo_url").eq("company_id", organizationId),
    supabase.from("companies").select("id, name, slug, logo_url").eq("id", organizationId).maybeSingle(),
    supabase.from("attachments").select("file_path").eq("company_id", organizationId),
    countRows(supabase, organizationId, "users"),
    countRows(supabase, organizationId, "clients"),
    countRows(supabase, organizationId, "teams"),
    countRows(supabase, organizationId, "tasks"),
    countRows(supabase, organizationId, "ideas"),
    countRows(supabase, organizationId, "content_items"),
    countRows(supabase, organizationId, "reports"),
    countRows(supabase, organizationId, "calendar_events"),
    countRows(supabase, organizationId, "day_off_requests"),
    countRows(supabase, organizationId, "notifications"),
    countRows(supabase, organizationId, "chat_messages"),
    countRows(supabase, organizationId, "attachments"),
  ]);

  return {
    organization,
    authUserIds: ((users as Array<{ id: string }> | null) ?? []).map((user) => user.id),
    avatarPaths: Array.from(new Set([
      storagePath(organization?.logo_url),
      ...((users as Array<{ avatar_url: string | null }> | null) ?? []).map((user) => storagePath(user.avatar_url)),
      ...((clients as Array<{ logo_url: string | null }> | null) ?? []).map((client) => storagePath(client.logo_url)),
    ].filter((path): path is string => Boolean(path)))),
    attachmentPaths: Array.from(new Set(
      ((attachments as Array<{ file_path: string | null }> | null) ?? [])
        .map((attachment) => storagePath(attachment.file_path))
        .filter((path): path is string => Boolean(path))
    )),
    counts: {
      users: usersCount,
      clients: clientsCount,
      teams,
      tasks,
      ideas,
      content,
      reports,
      calendarItems: calendarEvents + dayOffRequests,
      notifications,
      chatMessages,
      files,
    },
  };
}

async function logPlatformActivity(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  platformAdminId: string,
  action: string,
  organizationId: string,
  metadata: Json
) {
  await supabase.from("platform_activity_logs").insert({
    platform_admin_id: platformAdminId,
    action,
    entity_type: "organization",
    entity_id: organizationId,
    metadata,
  });
}

export async function hardDeleteOrganizationAction(formData: FormData) {
  const context = await requireSuperiorAdminContext();
  const organizationId = getFormString(formData, "organizationId");
  const confirmation = getFormString(formData, "confirmation").trim();

  if (!organizationId) {
    redirectWith("error", "Organization could not be resolved.");
  }

  if (!hasSupabaseAdminConfig()) {
    redirectToOrganization(organizationId, "error", "Supabase service role is required for permanent organization deletion.");
  }

  const admin = createSupabaseAdminClient();
  const server = await createSupabaseServerClient();
  const artifacts = await getDeletionArtifacts(admin, organizationId);
  const organization = artifacts.organization;

  if (!organization) {
    redirectWith("error", "Organization not found.");
  }

  if (confirmation !== organization.slug && confirmation !== organization.name) {
    redirectToOrganization(organizationId, "error", "Type the exact organization slug or name to permanently delete it.");
  }

  const metadata = {
    organizationName: organization.name,
    organizationSlug: organization.slug,
    counts: artifacts.counts,
  } satisfies Json;

  await logPlatformActivity(admin, context.id, "organization_hard_delete_started", organizationId, metadata);

  const { data: deleted, error } = await server.rpc("hard_delete_organization_database", {
    target_company_id: organizationId,
  });

  if (error || !deleted) {
    await logPlatformActivity(admin, context.id, "organization_hard_delete_failed", organizationId, {
      ...metadata,
      error: error?.message ?? "Unknown delete failure",
    });
    redirectToOrganization(organizationId, "error", "Organization could not be permanently deleted. No auth users or files were removed.");
  }

  const storageErrors: string[] = [];
  const authErrors: string[] = [];

  if (artifacts.avatarPaths.length) {
    const { error: removeAvatarError } = await admin.storage
      .from("contento-avatars")
      .remove(artifacts.avatarPaths);

    if (removeAvatarError) {
      storageErrors.push(removeAvatarError.message);
    }
  }

  if (artifacts.attachmentPaths.length) {
    const { error: removeAttachmentError } = await admin.storage
      .from("contento-attachments")
      .remove(artifacts.attachmentPaths);

    if (removeAttachmentError) {
      storageErrors.push(removeAttachmentError.message);
    }
  }

  for (const authUserId of artifacts.authUserIds) {
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(authUserId);

    if (authDeleteError) {
      authErrors.push(`${authUserId}: ${authDeleteError.message}`);
    }
  }

  await logPlatformActivity(admin, context.id, "organization_hard_delete_completed", organizationId, {
    ...metadata,
    storageObjectCount: artifacts.avatarPaths.length + artifacts.attachmentPaths.length,
    authUserCount: artifacts.authUserIds.length,
    storageWarnings: storageErrors,
    authWarnings: authErrors,
  });

  const warning = storageErrors.length || authErrors.length
    ? " Organization data was deleted; some auth or storage cleanup warnings were logged."
    : "";

  redirectWith("notice", `Organization permanently deleted.${warning}`);
}
