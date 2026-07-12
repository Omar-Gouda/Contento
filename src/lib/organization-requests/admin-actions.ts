"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";

import { requireSuperiorAdminContext } from "@/lib/auth/context";
import { createTrialPendingSubscription } from "@/lib/billing/service";
import { hasSupabaseAdminConfig } from "@/lib/env";
import {
  organizationRequestRejectSchema,
  organizationRequestReviewSchema,
} from "@/lib/organization-requests/schemas";
import {
  encodeOrganizationTemporaryPasswordFlash,
  ORGANIZATION_TEMP_PASSWORD_FLASH_COOKIE,
  type OrganizationTemporaryPasswordFlash,
} from "@/lib/organization-requests/temp-password-flash";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function redirectRequests(key: "notice" | "error", value: string): never {
  redirect(`/super-admin/organization-requests?${key}=${encodeURIComponent(value)}`);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 52);
}

function randomToken(length = 6) {
  return randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length);
}

async function uniqueOrganizationSlug(admin: ReturnType<typeof createSupabaseAdminClient>, baseValue: string) {
  const base = slugify(baseValue) || `contento-${randomToken(6)}`;
  let candidate = base;

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const { data } = await admin
      .from("companies")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (!data?.id) {
      return candidate;
    }

    candidate = `${base.slice(0, 56)}-${attempt + 1}`;
  }

  return `${base.slice(0, 55)}-${randomToken(4)}`;
}

function splitOwnerName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts.shift() ?? "Organization";
  const lastName = parts.join(" ") || "Owner";

  return { firstName, lastName };
}

function generateTemporaryPassword() {
  const randomPart = randomToken(8);
  const symbolPart = randomToken(4).toUpperCase();

  return `Contento_${symbolPart}_${randomPart}9`;
}

function isExistingAuthUserError(error: { message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("already") || message.includes("registered") || message.includes("exists");
}

async function findAuthUserByEmail(admin: ReturnType<typeof createSupabaseAdminClient>, email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      return { user: null, error };
    }

    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === normalizedEmail);

    if (user) {
      return { user, error: null };
    }

    if (data.users.length < 1000) {
      break;
    }
  }

  return { user: null, error: null };
}

async function setTemporaryPasswordFlash(flash: OrganizationTemporaryPasswordFlash) {
  const cookieStore = await cookies();

  cookieStore.set(ORGANIZATION_TEMP_PASSWORD_FLASH_COOKIE, encodeOrganizationTemporaryPasswordFlash(flash), {
    httpOnly: true,
    maxAge: 300,
    path: "/super-admin/organization-requests",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

function organizationErrorMessage(error: { code?: string; message?: string }) {
  const message = error.message ?? "";

  if (error.code === "23505" || message.includes("companies_slug_key")) {
    return "That organization slug is already in use.";
  }

  if (message.includes("CONTENTO_ORG_ADMIN_PROFILE_EXISTS")) {
    return "The owner email already belongs to an organization profile.";
  }

  if (message.includes("CONTENTO_SUPERIOR_ADMIN_REQUIRED")) {
    return "Super Admin access could not be verified for organization approval.";
  }

  return "The organization could not be prepared from this request.";
}

async function currentPlatformAdminId(admin: ReturnType<typeof createSupabaseAdminClient>, authUserId: string) {
  const { data } = await admin
    .from("platform_admins")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  return data?.id ?? null;
}

async function logRequestActivity(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  platformAdminId: string | null,
  action: string,
  requestId: string,
  metadata: Json
) {
  await admin.from("platform_activity_logs").insert({
    platform_admin_id: platformAdminId,
    action,
    entity_type: "organization_request",
    entity_id: requestId,
    metadata,
  });
}

export async function clearOrganizationTemporaryPasswordFlashAction() {
  await requireSuperiorAdminContext();
  const cookieStore = await cookies();
  cookieStore.delete(ORGANIZATION_TEMP_PASSWORD_FLASH_COOKIE);

  return { success: true };
}

export async function approveOrganizationRequestAction(formData: FormData) {
  const context = await requireSuperiorAdminContext();

  if (!hasSupabaseAdminConfig()) {
    redirectRequests("error", "Supabase service role is required to approve organization requests.");
  }

  const parsed = organizationRequestReviewSchema.safeParse({
    requestId: formString(formData, "requestId"),
  });

  if (!parsed.success) {
    redirectRequests("error", parsed.error.issues[0]?.message ?? "Organization request could not be resolved.");
  }

  const admin = createSupabaseAdminClient();
  const platformAdminId = await currentPlatformAdminId(admin, context.authUserId);
  const { data: request, error: requestError } = await admin
    .from("organization_requests")
    .select("*")
    .eq("id", parsed.data.requestId)
    .maybeSingle();

  if (requestError || !request) {
    redirectRequests("error", "Organization request was not found.");
  }

  if (!["pending", "rejected"].includes(request.status)) {
    redirectRequests("error", "Only pending or rejected requests can be approved.");
  }

  const temporaryPassword = generateTemporaryPassword();
  const { firstName, lastName } = splitOwnerName(request.owner_full_name);
  const [
    { data: existingProfile, error: existingProfileError },
    { data: existingPlatformAdmin, error: existingPlatformAdminError },
  ] = await Promise.all([
    admin
      .from("users")
      .select("id, company_id")
      .eq("email", request.business_email)
      .maybeSingle(),
    admin
      .from("platform_admins")
      .select("id")
      .eq("email", request.business_email)
      .maybeSingle(),
  ]);

  if (existingProfileError || existingProfile?.id) {
    redirectRequests("error", "The owner email already belongs to another Contento workspace.");
  }

  if (existingPlatformAdminError || existingPlatformAdmin?.id) {
    redirectRequests("error", "The owner email already belongs to a Super Admin account.");
  }

  const { data: createdAuthUser, error: createUserError } = await admin.auth.admin.createUser({
    email: request.business_email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      contento_role: "organization_admin",
      organization_request_id: request.id,
    },
  });

  let ownerAuthUserId = createdAuthUser.user?.id ?? null;
  let createdNewAuthUser = Boolean(createdAuthUser.user);

  if (createUserError) {
    if (!isExistingAuthUserError(createUserError)) {
      redirectRequests("error", createUserError.message ?? "The owner auth account could not be created.");
    }

    const { user: existingAuthUser, error: findAuthError } = await findAuthUserByEmail(admin, request.business_email);

    if (findAuthError || !existingAuthUser) {
      redirectRequests("error", "The owner auth account already exists but could not be safely resolved.");
    }

    const { error: updateExistingAuthError } = await admin.auth.admin.updateUserById(existingAuthUser.id, {
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        ...existingAuthUser.user_metadata,
        first_name: firstName,
        last_name: lastName,
        contento_role: "organization_admin",
        organization_request_id: request.id,
      },
    });

    if (updateExistingAuthError) {
      redirectRequests("error", "The existing owner auth account password could not be updated.");
    }

    ownerAuthUserId = existingAuthUser.id;
    createdNewAuthUser = false;
  }

  if (!ownerAuthUserId) {
    redirectRequests("error", createUserError?.message ?? "The owner auth account could not be created.");
  }

  const slug = await uniqueOrganizationSlug(admin, request.organization_name || request.agency_name);
  const server = await createSupabaseServerClient();
  const { data: companyId, error: organizationError } = await server.rpc("create_organization_with_admin_profile", {
    company_name: request.organization_name,
    company_slug: slug,
    admin_user_id: ownerAuthUserId,
    admin_email: request.business_email,
    admin_first_name: firstName,
    admin_last_name: lastName,
  });

  if (organizationError || !companyId) {
    if (createdNewAuthUser) {
      await admin.auth.admin.deleteUser(ownerAuthUserId);
    }
    redirectRequests("error", organizationError ? organizationErrorMessage(organizationError) : "The organization could not be created.");
  }

  const { error: profileUpdateError } = await admin
    .from("users")
    .update({
      must_change_password: true,
      profile_completed_at: null,
      phone: request.phone,
      job_title: "Organization Owner",
    })
    .eq("id", ownerAuthUserId);

  if (profileUpdateError) {
    redirectRequests("error", "The owner profile was created but could not be marked for password change.");
  }

  const { error: requestUpdateError } = await admin
    .from("organization_requests")
    .update({
      status: "ready_for_onboarding",
      reviewed_by: platformAdminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
      archived_at: null,
      approved_company_id: companyId,
      approved_owner_user_id: ownerAuthUserId,
      temporary_password_generated: true,
      activation_email_placeholder: {
        to: request.business_email,
        subject: "Your Contento organization is ready",
        status: "prepared_not_sent",
        delivery: "manual_secure_channel",
        temporary_password_generated: true,
        online_purchase: "coming_soon",
        plan_code: request.plan_code,
        duration_years: request.duration_years,
        calculated_amount_egp: request.calculated_amount_egp,
      },
    })
    .eq("id", request.id);

  if (requestUpdateError) {
    redirectRequests("error", "Organization was prepared but the request status could not be updated.");
  }

  await createTrialPendingSubscription(companyId, {
    planCode: request.plan_code,
    durationYears: request.duration_years,
  });

  await logRequestActivity(admin, platformAdminId, "organization_requests.approved", request.id, {
    company_id: companyId,
    company_slug: slug,
    owner_user_id: ownerAuthUserId,
    temporary_password_generated: true,
    requested_plan_code: request.plan_code,
    requested_duration_years: request.duration_years,
    requested_amount_egp: request.calculated_amount_egp,
    online_purchase: "coming_soon",
  });

  await setTemporaryPasswordFlash({
    requestId: request.id,
    email: request.business_email,
    password: temporaryPassword,
    createdAt: new Date().toISOString(),
  });

  redirectRequests("notice", "Organization request approved. Copy the temporary owner password now.");
}

export async function rejectOrganizationRequestAction(formData: FormData) {
  const context = await requireSuperiorAdminContext();

  if (!hasSupabaseAdminConfig()) {
    redirectRequests("error", "Supabase service role is required to reject organization requests.");
  }

  const parsed = organizationRequestRejectSchema.safeParse({
    requestId: formString(formData, "requestId"),
    rejectionReason: formString(formData, "rejectionReason"),
  });

  if (!parsed.success) {
    redirectRequests("error", parsed.error.issues[0]?.message ?? "Enter a rejection reason.");
  }

  const admin = createSupabaseAdminClient();
  const platformAdminId = await currentPlatformAdminId(admin, context.authUserId);
  const { error } = await admin
    .from("organization_requests")
    .update({
      status: "rejected",
      reviewed_by: platformAdminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: parsed.data.rejectionReason,
      archived_at: null,
    })
    .eq("id", parsed.data.requestId);

  if (error) {
    redirectRequests("error", "Organization request could not be rejected.");
  }

  await logRequestActivity(admin, platformAdminId, "organization_requests.rejected", parsed.data.requestId, {
    reason: parsed.data.rejectionReason,
  });

  redirectRequests("notice", "Organization request rejected.");
}

export async function archiveOrganizationRequestAction(formData: FormData) {
  const context = await requireSuperiorAdminContext();

  if (!hasSupabaseAdminConfig()) {
    redirectRequests("error", "Supabase service role is required to archive organization requests.");
  }

  const parsed = organizationRequestReviewSchema.safeParse({
    requestId: formString(formData, "requestId"),
  });

  if (!parsed.success) {
    redirectRequests("error", parsed.error.issues[0]?.message ?? "Organization request could not be resolved.");
  }

  const admin = createSupabaseAdminClient();
  const platformAdminId = await currentPlatformAdminId(admin, context.authUserId);
  const { error } = await admin
    .from("organization_requests")
    .update({
      status: "archived",
      reviewed_by: platformAdminId,
      reviewed_at: new Date().toISOString(),
      archived_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.requestId);

  if (error) {
    redirectRequests("error", "Organization request could not be archived.");
  }

  await logRequestActivity(admin, platformAdminId, "organization_requests.archived", parsed.data.requestId, {});
  redirectRequests("notice", "Organization request archived.");
}

export async function deleteOrganizationRequestAction(formData: FormData) {
  const context = await requireSuperiorAdminContext();

  if (!hasSupabaseAdminConfig()) {
    redirectRequests("error", "Supabase service role is required to delete organization requests.");
  }

  const parsed = organizationRequestReviewSchema.safeParse({
    requestId: formString(formData, "requestId"),
  });

  if (!parsed.success) {
    redirectRequests("error", parsed.error.issues[0]?.message ?? "Organization request could not be resolved.");
  }

  const admin = createSupabaseAdminClient();
  const platformAdminId = await currentPlatformAdminId(admin, context.authUserId);
  await logRequestActivity(admin, platformAdminId, "organization_requests.deleted", parsed.data.requestId, {});
  const { error } = await admin
    .from("organization_requests")
    .delete()
    .eq("id", parsed.data.requestId);

  if (error) {
    redirectRequests("error", "Organization request could not be deleted.");
  }

  redirectRequests("notice", "Organization request permanently deleted.");
}
