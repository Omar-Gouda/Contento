"use server";

import { redirect } from "next/navigation";

import { requireSuperiorAdminContext } from "@/lib/auth/context";
import { hasSupabaseAdminConfig } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createOrganizationSchema } from "@/lib/super-admin/schemas";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function redirectWith(key: "notice" | "error", value: string): never {
  redirect(`/super-admin/organizations?${key}=${encodeURIComponent(value)}`);
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
