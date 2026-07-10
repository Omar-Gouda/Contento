"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { loadAuthProfile } from "@/lib/auth/context";
import {
  forgotPasswordSchema,
  onboardingSchema,
  resetPasswordSchema,
  signInSchema,
  type ForgotPasswordInput,
  type OnboardingInput,
  type ResetPasswordInput,
  type SignInInput,
} from "@/lib/auth/schemas";
import { hasSupabaseAdminConfig, hasSupabaseRuntimeConfig } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createDemoSessionForCurrentUser, cleanupCurrentDemoSession, ensurePublicDemoAccount } from "@/lib/demo/server";
import { isDemoCredential } from "@/lib/demo/config";
import { createTrialPendingSubscription, startTrialIfPending } from "@/lib/billing/service";
import {
  recordSignOutForSupabaseClient,
} from "@/lib/work-hours/actions";
import { getDefaultDashboardPath } from "@/types/roles";

export type AuthActionResult = {
  success: boolean;
  message: string;
  redirectTo?: string;
};

async function getRequestOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

function configurationError(): AuthActionResult {
  return {
    success: false,
    message: "Authentication is not configured. Set the Supabase environment variables.",
  };
}

function onboardingDatabaseErrorMessage(error: { code?: string; message?: string }) {
  const message = error.message ?? "";

  if (error.code === "23505" && (message.includes("users_pkey") || message.includes("users_email_key"))) {
    return "Your account already has a Contento profile.";
  }

  if (error.code === "23505" || message.includes("companies_slug_key")) {
    return "That company slug is already in use. Choose another workspace slug.";
  }

  if (message.includes("CONTENTO_PROFILE_EXISTS")) {
    return "Your account already has a Contento profile.";
  }

  if (message.includes("CONTENTO_INVALID_COMPANY_SLUG")) {
    return "Use lowercase letters, numbers, and single hyphens for the company slug.";
  }

  if (message.includes("CONTENTO_AUTH_REQUIRED")) {
    return "Sign in before creating a company workspace.";
  }

  if (message.includes("CONTENTO_PROFILE_NAME_REQUIRED")) {
    return "Enter your first and last name.";
  }

  return "We could not create your workspace right now. Please try again.";
}

async function acceptPendingInvitation(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { error } = await supabase.rpc("accept_pending_invitation_for_current_user", {});

  if (error) {
    console.warn("Contento invitation acceptance failed", error.message);
  }
}

async function recordSuccessfulLogin(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { error } = await supabase.rpc("record_current_user_login", {});

  if (error) {
    console.warn("Contento login timestamp update failed", error.message);
  }
}

type PasswordRecoveryUser = {
  id: string;
  company_id: string;
  email: string;
  first_name: string;
  last_name: string;
  recovery_email: string | null;
  recovery_email_verified_at: string | null;
  is_demo: boolean | null;
};

async function findPasswordRecoveryUser(email: string): Promise<PasswordRecoveryUser | null> {
  if (!hasSupabaseAdminConfig()) {
    return null;
  }

  try {
    const admin = createSupabaseAdminClient();

    const { data: directUser } = await admin
      .from("users")
      .select("id, company_id, email, first_name, last_name, recovery_email, recovery_email_verified_at, is_demo")
      .eq("email", email)
      .maybeSingle();

    if (directUser) {
      return directUser as PasswordRecoveryUser;
    }

    const { data: recoveryUser } = await admin
      .from("users")
      .select("id, company_id, email, first_name, last_name, recovery_email, recovery_email_verified_at, is_demo")
      .eq("recovery_email", email)
      .maybeSingle();

    return (recoveryUser as PasswordRecoveryUser | null) ?? null;
  } catch (error) {
    console.warn(
      "Contento password recovery lookup failed",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

async function notifyMarketingManagersOfPasswordResetRequest(email: string, requestedUser: PasswordRecoveryUser | null) {
  if (!hasSupabaseAdminConfig()) {
    return;
  }

  try {
    const admin = createSupabaseAdminClient();

    if (!requestedUser) {
      return;
    }

    const { data: marketingManagerRoles } = await admin
      .from("roles")
      .select("id")
      .eq("company_id", requestedUser.company_id)
      .in("name", ["Admin", "Marketing Manager"]);
    const roleIds = ((marketingManagerRoles as Array<{ id: string }> | null) ?? []).map((role) => role.id);

    if (!roleIds.length) {
      return;
    }

    const { data: marketingManagers } = await admin
      .from("users")
      .select("id")
      .eq("company_id", requestedUser.company_id)
      .eq("status", "active")
      .in("role_id", roleIds);
    const managerIds = ((marketingManagers as Array<{ id: string }> | null) ?? [])
      .map((user) => user.id)
      .filter((userId) => userId !== requestedUser.id);

    if (managerIds.length) {
      const displayName = [requestedUser.first_name, requestedUser.last_name].filter(Boolean).join(" ").trim();
      const usedRecoveryEmail = requestedUser.recovery_email?.toLowerCase() === email.toLowerCase();
      const recoveryNote = usedRecoveryEmail
        ? " using a recovery email. Supabase reset links still go to the sign-in email, so issue a temporary password if needed."
        : ".";

      await admin.from("notifications").insert(
        managerIds.map((userId) => ({
          company_id: requestedUser.company_id,
          user_id: userId,
          title: "Password reset requested",
          message: `${displayName || requestedUser.email} requested an internal password reset${recoveryNote}`,
          entity_type: "user",
          entity_id: requestedUser.id,
          link_href: "/admin/users",
          read: false,
        }))
      );
    }

    await admin.from("activity_logs").insert({
      company_id: requestedUser.company_id,
      user_id: requestedUser.id,
      action: "users.password_reset_requested",
      entity_type: "user",
      entity_id: requestedUser.id,
      metadata: {
        source: "forgot_password",
        requested_with_recovery_email: requestedUser.recovery_email?.toLowerCase() === email.toLowerCase(),
        recovery_email_verified: Boolean(requestedUser.recovery_email_verified_at),
        notified_marketing_manager_count: managerIds.length,
      },
    });
  } catch (error) {
    console.warn(
      "Contento internal password reset notification failed",
      error instanceof Error ? error.message : error
    );
  }
}

export async function signInAction(input: SignInInput): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid sign in details." };
  }

  if (!hasSupabaseRuntimeConfig()) {
    return configurationError();
  }

  const isDemoSignIn = isDemoCredential(parsed.data.email, parsed.data.password);

  if (isDemoSignIn) {
    if (!hasSupabaseAdminConfig()) {
      return {
        success: false,
        message: "The public demo is not configured on this deployment.",
      };
    }

    try {
      await ensurePublicDemoAccount();
    } catch (error) {
      console.error("public demo preparation failed", {
        message: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        message: "The public demo could not be prepared. Please try again shortly. The deployment team can check the demo migration and Supabase logs.",
      };
    }
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { success: false, message: "Invalid email or password." };
  }

  if (isDemoSignIn) {
    const demoSessionId = await createDemoSessionForCurrentUser(supabase);

    if (!demoSessionId) {
      console.error("public demo session creation failed after successful auth");

      return {
        success: false,
        message: "The public demo session could not be created. Please try again shortly.",
      };
    }

    return {
      success: true,
      message: "Choose a role to explore the Contento demo.",
      redirectTo: "/demo/choose-role",
    };
  }

  const resolution = await loadAuthProfile(supabase);

  if (resolution.state === "superior_admin") {
    return {
      success: true,
      message: "Signed in successfully.",
      redirectTo: "/super-admin",
    };
  }

  if (resolution.state === "missing_profile") {
    await acceptPendingInvitation(supabase);
    const acceptedResolution = await loadAuthProfile(supabase);

    if (acceptedResolution.state === "active") {
      await recordSuccessfulLogin(supabase);
      await startTrialIfPending(acceptedResolution.context);

      return {
        success: true,
        message: "Signed in successfully.",
        redirectTo: acceptedResolution.context.mustChangePassword
          ? "/change-password"
          : getDefaultDashboardPath(acceptedResolution.context.role),
      };
    }

    return {
      success: true,
      message: "Finish setting up your Contento workspace.",
      redirectTo: "/onboarding",
    };
  }

  if (resolution.state === "inactive" || resolution.state === "incomplete_profile") {
    return {
      success: true,
      message: "Your workspace access needs attention.",
      redirectTo: "/account-inactive",
    };
  }

  if (resolution.state === "organization_disabled") {
    return {
      success: true,
      message: "This organization is currently disabled.",
      redirectTo: "/organization-disabled",
    };
  }

  if (resolution.state === "organization_unavailable") {
    return {
      success: true,
      message: "This organization is no longer available.",
      redirectTo: "/organization-unavailable",
    };
  }

  if (resolution.state !== "active") {
    return {
      success: false,
      message: "We could not resolve your workspace access. Please try again.",
    };
  }

  await recordSuccessfulLogin(supabase);
  await startTrialIfPending(resolution.context);

  return {
    success: true,
    message: "Signed in successfully.",
    redirectTo: resolution.context.mustChangePassword
      ? "/change-password"
      : getDefaultDashboardPath(resolution.context.role),
  };
}

export async function forgotPasswordAction(input: ForgotPasswordInput): Promise<AuthActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Enter a valid email address." };
  }

  if (!hasSupabaseRuntimeConfig()) {
    return configurationError();
  }

  const supabase = await createSupabaseServerClient();
  const origin = await getRequestOrigin();
  const recoveryUser = await findPasswordRecoveryUser(parsed.data.email);

  if (recoveryUser?.is_demo) {
    return {
      success: true,
      message: "Demo password recovery is disabled. Use the public demo credentials to start a new sandbox session.",
    };
  }

  const shouldSendSupabaseEmail =
    !recoveryUser ||
    recoveryUser.email.toLowerCase() === parsed.data.email.toLowerCase();
  const { error } = shouldSendSupabaseEmail
    ? await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    })
    : { error: null };

  await notifyMarketingManagersOfPasswordResetRequest(parsed.data.email, recoveryUser);

  if (error) {
    console.warn("Contento password reset email failed", error.message);

    return {
      success: true,
      message: "If an account exists, recovery instructions have been sent. If your email cannot receive recovery links, contact your Marketing Manager.",
    };
  }

  return {
    success: true,
    message: "If an account exists, recovery instructions have been sent. If your email cannot receive recovery links, contact your Marketing Manager.",
  };
}

export async function resetPasswordAction(input: ResetPasswordInput): Promise<AuthActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check your password details." };
  }

  if (!hasSupabaseRuntimeConfig()) {
    return configurationError();
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      success: false,
      message: "Your reset link is invalid or expired. Request a new password reset link.",
    };
  }

  const resolution = await loadAuthProfile(supabase);

  if (resolution.state === "superior_admin") {
    return {
      success: true,
      message: "Your password was updated.",
      redirectTo: "/super-admin",
    };
  }

  if (resolution.state === "active") {
    return {
      success: true,
      message: "Your password was updated.",
      redirectTo: resolution.context.mustChangePassword
        ? "/change-password"
        : getDefaultDashboardPath(resolution.context.role),
    };
  }

  if (resolution.state === "inactive" || resolution.state === "incomplete_profile") {
    return {
      success: true,
      message: "Your password was updated.",
      redirectTo: "/account-inactive",
    };
  }

  if (resolution.state === "organization_disabled") {
    return {
      success: true,
      message: "Your password was updated.",
      redirectTo: "/organization-disabled",
    };
  }

  if (resolution.state === "organization_unavailable") {
    return {
      success: true,
      message: "Your password was updated.",
      redirectTo: "/organization-unavailable",
    };
  }

  if (resolution.state === "missing_profile") {
    return {
      success: true,
      message: "Your password was updated.",
      redirectTo: "/onboarding",
    };
  }

  if (resolution.state === "demo_needs_role") {
    return {
      success: true,
      message: "Choose a role to explore the Contento demo.",
      redirectTo: "/demo/choose-role",
    };
  }

  await supabase.auth.signOut();

  return {
    success: true,
    message: "Your password was updated. Sign in with your new password.",
    redirectTo: "/sign-in?reset=success",
  };
}

export async function changePasswordAction(input: ResetPasswordInput): Promise<AuthActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Check your password details." };
  }

  if (!hasSupabaseRuntimeConfig()) {
    return configurationError();
  }

  const supabase = await createSupabaseServerClient();
  const initialResolution = await loadAuthProfile(supabase);

  if (initialResolution.state !== "active") {
    return {
      success: false,
      message: "We could not resolve your workspace access. Please sign in again.",
      redirectTo: "/sign-in",
    };
  }

  const forcedPasswordChange = initialResolution.context.mustChangePassword;

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (updateError) {
    return {
      success: false,
      message: "We could not update your password right now. Please try again.",
    };
  }

  if (!forcedPasswordChange) {
    return {
      success: true,
      message: "Password updated.",
    };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return {
      success: false,
      message: "We could not resolve your account. Please sign in again.",
    };
  }

  const { data: passwordFlagCleared, error: profileError } = await supabase.rpc(
    "clear_current_user_must_change_password",
    {}
  );

  if (profileError || !passwordFlagCleared) {
    const { error: fallbackError } = await supabase
      .from("users")
      .update({ must_change_password: false })
      .eq("id", initialResolution.context.userId)
      .eq("company_id", initialResolution.context.companyId);

    if (fallbackError) {
      console.warn("Failed to update must_change_password", profileError ?? fallbackError);

      return {
        success: false,
        message: "Your password was updated, but Contento could not finish the account check. Try again or contact an Admin.",
      };
    }
  }

  const resolution = await loadAuthProfile(supabase);

  if (resolution.state === "active") {
    return {
      success: true,
      message: "Password updated.",
      redirectTo: getDefaultDashboardPath(resolution.context.role),
    };
  }

  return {
    success: true,
    message: "Password updated.",
    redirectTo: "/sign-in",
  };
}


export async function completeOnboardingAction(input: OnboardingInput): Promise<AuthActionResult> {
  const parsed = onboardingSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check your workspace setup details.",
    };
  }

  if (!hasSupabaseRuntimeConfig()) {
    return configurationError();
  }

  const supabase = await createSupabaseServerClient();
  const currentResolution = await loadAuthProfile(supabase);

  if (currentResolution.state === "unauthenticated") {
    return {
      success: false,
      message: "Sign in before creating a company workspace.",
      redirectTo: "/sign-in",
    };
  }

  if (currentResolution.state === "active") {
    return {
      success: true,
      message: "Your workspace is already ready.",
      redirectTo: getDefaultDashboardPath(currentResolution.context.role),
    };
  }

  if (currentResolution.state === "organization_disabled") {
    return {
      success: true,
      message: "This organization is currently disabled.",
      redirectTo: "/organization-disabled",
    };
  }

  if (currentResolution.state === "organization_unavailable") {
    return {
      success: true,
      message: "This organization is no longer available.",
      redirectTo: "/organization-unavailable",
    };
  }

  if (currentResolution.state !== "missing_profile") {
    return {
      success: true,
      message: "Your workspace access needs attention.",
      redirectTo: "/account-inactive",
    };
  }

  const { error } = await supabase.rpc("create_company_with_admin_profile", {
    company_name: parsed.data.companyName,
    company_slug: parsed.data.companySlug,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
  });

  if (error) {
    return {
      success: false,
      message: onboardingDatabaseErrorMessage(error),
    };
  }

  const createdResolution = await loadAuthProfile(supabase);

  if (createdResolution.state !== "active") {
    return {
      success: false,
      message: "Your workspace was created, but your profile could not be resolved yet. Sign in again to continue.",
    };
  }

  await createTrialPendingSubscription(createdResolution.context.companyId);
  await startTrialIfPending(createdResolution.context);

  return {
    success: true,
    message: "Workspace created successfully.",
    redirectTo: getDefaultDashboardPath(createdResolution.context.role),
  };
}

export async function signOutAction() {
  if (hasSupabaseRuntimeConfig()) {
    const supabase = await createSupabaseServerClient();
    await cleanupCurrentDemoSession();
    const workHoursStatus = await recordSignOutForSupabaseClient(supabase);

    if (workHoursStatus === "active_break") {
      redirect("/profile/work-hours?error=active-break");
    }

    await supabase.auth.signOut();
  }

  redirect("/sign-in");
}
