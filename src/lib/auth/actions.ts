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
import { hasSupabaseRuntimeConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  recordSignInForSupabaseClient,
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

export async function signInAction(input: SignInInput): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid sign in details." };
  }

  if (!hasSupabaseRuntimeConfig()) {
    return configurationError();
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { success: false, message: "Invalid email or password." };
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
      await recordSignInForSupabaseClient(supabase);

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

  await recordSignInForSupabaseClient(supabase);

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
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return {
      success: false,
      message: "We could not start a password reset right now. Please try again.",
    };
  }

  return {
    success: true,
    message: "If that email belongs to a Contento account, a reset link has been sent.",
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

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (updateError) {
    return {
      success: false,
      message: "We could not update your password right now. Please try again.",
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
    console.warn("Failed to update must_change_password", profileError);

    return {
      success: false,
      message: "Your password was updated, but Contento could not finish the account check. Try again or contact an Admin.",
    };
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

  await recordSignInForSupabaseClient(supabase);

  return {
    success: true,
    message: "Workspace created successfully.",
    redirectTo: getDefaultDashboardPath(createdResolution.context.role),
  };
}

export async function signOutAction() {
  if (hasSupabaseRuntimeConfig()) {
    const supabase = await createSupabaseServerClient();
    const workHoursStatus = await recordSignOutForSupabaseClient(supabase);

    if (workHoursStatus === "active_break") {
      redirect("/profile/work-hours?error=active-break");
    }

    await supabase.auth.signOut();
  }

  redirect("/sign-in");
}
