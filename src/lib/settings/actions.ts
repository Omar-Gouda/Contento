"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthContext, requirePermission } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CONTENTO_TIME_ZONE, DAILY_BREAK_ALLOWANCE_MINUTES, DEFAULT_WORK_DAY_TARGET_MINUTES } from "@/lib/time";
import type { Json } from "@/types/database";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function safeRedirect(pathname: string, key: "notice" | "error", value: string): never {
  const separator = pathname.includes("?") ? "&" : "?";
  redirect(`${pathname}${separator}${key}=${encodeURIComponent(value)}`);
}

function colorOrNull(value: string) {
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : null;
}

const imageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export async function updateProfileAction(formData: FormData) {
  await requireAuthContext();
  const firstName = formString(formData, "firstName").trim();
  const lastName = formString(formData, "lastName").trim();
  const phone = formString(formData, "phone").trim();
  const jobTitle = formString(formData, "jobTitle").trim();
  const bio = formString(formData, "bio").trim();
  const timezone = formString(formData, "timezone").trim() || CONTENTO_TIME_ZONE;
  const notificationPreferences = {
    sound: formData.get("notificationSound") === "on",
    toast: formData.get("notificationToast") === "on",
    desktop: formData.get("notificationDesktop") === "on",
  } satisfies Json;

  if (!firstName || !lastName) {
    safeRedirect("/profile", "error", "First and last name are required.");
  }

  if (timezone !== CONTENTO_TIME_ZONE) {
    safeRedirect("/profile", "error", "Contento currently supports Africa/Cairo as the profile timezone.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: updated, error } = await supabase.rpc("update_current_user_profile", {
    profile_first_name: firstName,
    profile_last_name: lastName,
    profile_phone: phone,
    profile_job_title: jobTitle,
    profile_bio: bio,
    profile_timezone: timezone,
    profile_notification_preferences: notificationPreferences,
  });

  if (error || !updated) {
    safeRedirect("/profile", "error", "Profile could not be updated.");
  }

  revalidatePath("/", "layout");
  revalidatePath("/profile");
  safeRedirect("/profile", "notice", "Profile updated.");
}

export async function uploadAvatarAction(formData: FormData) {
  const context = await requireAuthContext();

  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    safeRedirect("/profile", "error", "Choose an avatar image.");
  }

  if (file.size > 5 * 1024 * 1024) {
    safeRedirect("/profile", "error", "Avatar image must be 5 MB or smaller.");
  }

  const extension = imageTypes.get(file.type);

  if (!extension) {
    safeRedirect("/profile", "error", "Avatar must be a JPG, PNG, WebP, or GIF image.");
  }

  const path = `${context.companyId}/${context.userId}/avatar-${randomUUID()}.${extension}`;
  const supabase = await createSupabaseServerClient();
  const { data: currentProfile } = await supabase
    .from("users")
    .select("avatar_url")
    .eq("id", context.userId)
    .eq("company_id", context.companyId)
    .maybeSingle();

  const { error: uploadError } = await supabase.storage
    .from("contento-avatars")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    safeRedirect("/profile", "error", "Avatar could not be uploaded. Try a smaller image or a different file.");
  }

  const { data: updated, error } = await supabase.rpc("update_current_user_avatar", {
    avatar_path: path,
  });

  if (error || !updated) {
    await supabase.storage.from("contento-avatars").remove([path]);
    safeRedirect("/profile", "error", "Avatar could not be saved.");
  }

  if (currentProfile?.avatar_url && !currentProfile.avatar_url.startsWith("http")) {
    await supabase.storage.from("contento-avatars").remove([currentProfile.avatar_url]);
  }

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  safeRedirect("/profile", "notice", "Avatar updated.");
}

export async function removeAvatarAction() {
  const context = await requireAuthContext();
  const supabase = await createSupabaseServerClient();
  const { data: currentProfile, error: loadError } = await supabase
    .from("users")
    .select("avatar_url")
    .eq("id", context.userId)
    .eq("company_id", context.companyId)
    .maybeSingle();

  if (loadError || !currentProfile) {
    safeRedirect("/profile", "error", "Avatar could not be loaded.");
  }

  const { data: updated, error } = await supabase.rpc("update_current_user_avatar", {
    avatar_path: null,
  });

  if (error || !updated) {
    safeRedirect("/profile", "error", "Avatar could not be removed.");
  }

  if (currentProfile.avatar_url && !currentProfile.avatar_url.startsWith("http")) {
    await supabase.storage.from("contento-avatars").remove([currentProfile.avatar_url]);
  }

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  safeRedirect("/profile", "notice", "Avatar removed.");
}

export async function uploadOrganizationLogoAction(formData: FormData) {
  const context = await requirePermission("settings.company", "limited");
  const file = formData.get("logo");

  if (!(file instanceof File) || file.size === 0) {
    safeRedirect("/settings", "error", "Choose an organization logo image.");
  }

  if (file.size > 5 * 1024 * 1024) {
    safeRedirect("/settings", "error", "Organization logo must be 5 MB or smaller.");
  }

  const extension = imageTypes.get(file.type);

  if (!extension) {
    safeRedirect("/settings", "error", "Organization logo must be a JPG, PNG, WebP, or GIF image.");
  }

  const path = `${context.companyId}/organization/logo-${randomUUID()}.${extension}`;
  const supabase = await createSupabaseServerClient();
  const { data: currentCompany } = await supabase
    .from("companies")
    .select("logo_url")
    .eq("id", context.companyId)
    .maybeSingle();

  const { error: uploadError } = await supabase.storage
    .from("contento-avatars")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    safeRedirect("/settings", "error", "Organization logo could not be uploaded. Try a smaller image or another file.");
  }

  const { error } = await supabase
    .from("companies")
    .update({ logo_url: path })
    .eq("id", context.companyId);

  if (error) {
    await supabase.storage.from("contento-avatars").remove([path]);
    safeRedirect("/settings", "error", "Organization logo could not be saved.");
  }

  if (currentCompany?.logo_url && !currentCompany.logo_url.startsWith("http")) {
    await supabase.storage.from("contento-avatars").remove([currentCompany.logo_url]);
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  safeRedirect("/settings", "notice", "Organization logo updated.");
}

export async function removeOrganizationLogoAction() {
  const context = await requirePermission("settings.company", "limited");
  const supabase = await createSupabaseServerClient();
  const { data: currentCompany, error: loadError } = await supabase
    .from("companies")
    .select("logo_url")
    .eq("id", context.companyId)
    .maybeSingle();

  if (loadError || !currentCompany) {
    safeRedirect("/settings", "error", "Organization logo could not be loaded.");
  }

  const { error } = await supabase
    .from("companies")
    .update({ logo_url: null })
    .eq("id", context.companyId);

  if (error) {
    safeRedirect("/settings", "error", "Organization logo could not be removed.");
  }

  if (currentCompany.logo_url && !currentCompany.logo_url.startsWith("http")) {
    await supabase.storage.from("contento-avatars").remove([currentCompany.logo_url]);
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  safeRedirect("/settings", "notice", "Organization logo removed.");
}

export async function updateCompanySettingsAction(formData: FormData) {
  const context = await requirePermission("settings.company", "limited");
  const companyName = formString(formData, "companyName").trim();
  const logoUrl = formString(formData, "logoUrl").trim();
  const primaryColor = colorOrNull(formString(formData, "primaryColor"));
  const secondaryColor = colorOrNull(formString(formData, "secondaryColor"));
  const accentColor = colorOrNull(formString(formData, "accentColor"));
  const workDayTargetMinutes = Number.parseInt(formString(formData, "workDayTargetMinutes"), 10);
  const breakAllowanceMinutes = Number.parseInt(formString(formData, "breakAllowanceMinutes"), 10);
  const timezone = formString(formData, "timezone").trim() || CONTENTO_TIME_ZONE;

  if (!companyName) {
    safeRedirect("/settings", "error", "Organization name is required.");
  }

  if (timezone !== CONTENTO_TIME_ZONE) {
    safeRedirect("/settings", "error", "Contento currently supports Africa/Cairo as the workspace timezone.");
  }

  const supabase = await createSupabaseServerClient();
  const [{ error: companyError }, { error: settingsError }] = await Promise.all([
    supabase
      .from("companies")
      .update({ name: companyName, logo_url: logoUrl || null })
      .eq("id", context.companyId),
    supabase
      .from("company_settings")
      .upsert({
        company_id: context.companyId,
        settings_json: {
          timezone,
          workDayTargetMinutes: Number.isFinite(workDayTargetMinutes)
            ? workDayTargetMinutes
            : DEFAULT_WORK_DAY_TARGET_MINUTES,
          dailyBreakAllowanceMinutes: Number.isFinite(breakAllowanceMinutes)
            ? breakAllowanceMinutes
            : DAILY_BREAK_ALLOWANCE_MINUTES,
          reviewWorkflow: {
            requireTeamLeadBeforeSupervisor: true,
          },
          branding: {
            primaryColor,
            secondaryColor,
            accentColor,
          },
        },
      }, {
        onConflict: "company_id",
      }),
  ]);

  if (companyError || settingsError) {
    safeRedirect("/settings", "error", "Organization settings could not be saved.");
  }

  safeRedirect("/settings", "notice", "Settings updated.");
}
