"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireSuperiorAdminContext } from "@/lib/auth/context";
import { addYears, isBillingDuration, type BillingDurationYears } from "@/lib/billing/constants";
import { logBillingEvent } from "@/lib/billing/service";
import { hasSupabaseAdminConfig } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function redirectWith(pathname: string, key: "notice" | "error", value: string): never {
  redirect(`${pathname}?${key}=${encodeURIComponent(value)}`);
}

function parseDuration(value: string): BillingDurationYears | null {
  const parsed = Number.parseInt(value, 10);
  return isBillingDuration(parsed) ? parsed : null;
}

function parseDateInput(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function requirePlatformAdminAction() {
  const context = await requireSuperiorAdminContext();

  if (!hasSupabaseAdminConfig()) {
    redirectWith("/super-admin", "error", "Supabase service role is required for platform control.");
  }

  return context;
}

export async function extendOrganizationSubscriptionAction(formData: FormData) {
  const context = await requirePlatformAdminAction();
  const organizationId = formString(formData, "organizationId");
  const subscriptionId = formString(formData, "subscriptionId");
  const days = Number.parseInt(formString(formData, "days"), 10);
  const path = `/super-admin/organizations/${organizationId}`;

  if (!organizationId || !subscriptionId || !Number.isFinite(days) || days < 1 || days > 730) {
    redirectWith(path, "error", "Enter an extension between 1 and 730 days.");
  }

  const admin = createSupabaseAdminClient();
  const { data: subscription } = await admin
    .from("organization_subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .eq("company_id", organizationId)
    .maybeSingle();

  if (!subscription) {
    redirectWith(path, "error", "Subscription could not be resolved.");
  }

  const now = new Date();
  const base = new Date(
    subscription.status === "trial_active"
      ? subscription.trial_ends_at ?? now.toISOString()
      : subscription.status === "grace_period"
        ? subscription.grace_ends_at ?? now.toISOString()
        : subscription.current_period_end ?? now.toISOString()
  );
  const next = new Date(Math.max(base.getTime(), now.getTime()));
  next.setUTCDate(next.getUTCDate() + days);
  const updates = subscription.status === "trial_active"
    ? { trial_ends_at: next.toISOString() }
    : subscription.status === "grace_period"
      ? { grace_ends_at: next.toISOString() }
      : { current_period_end: next.toISOString(), status: "active" as const };

  const { error } = await admin
    .from("organization_subscriptions")
    .update(updates)
    .eq("id", subscription.id);

  if (error) {
    redirectWith(path, "error", "Subscription could not be extended.");
  }

  await logBillingEvent(admin, organizationId, "billing.subscription_extended", {
    days,
    new_end_at: next.toISOString(),
    extended_by: context.id,
  });
  revalidatePath(path);
  revalidatePath("/super-admin/billing");
  redirectWith(path, "notice", "Subscription extended.");
}

export async function changeOrganizationPlanAction(formData: FormData) {
  const context = await requirePlatformAdminAction();
  const organizationId = formString(formData, "organizationId");
  const subscriptionId = formString(formData, "subscriptionId");
  const planId = formString(formData, "planId");
  const durationYears = parseDuration(formString(formData, "durationYears"));
  const path = `/super-admin/organizations/${organizationId}`;

  if (!organizationId || !subscriptionId || !planId || !durationYears) {
    redirectWith(path, "error", "Choose a valid plan and duration.");
  }

  const admin = createSupabaseAdminClient();
  const [{ data: plan }, { error }] = await Promise.all([
    admin.from("subscription_plans").select("id, code").eq("id", planId).eq("is_active", true).maybeSingle(),
    admin
      .from("organization_subscriptions")
      .update({ plan_id: planId, duration_years: durationYears })
      .eq("id", subscriptionId)
      .eq("company_id", organizationId),
  ]);

  if (!plan || error) {
    redirectWith(path, "error", "Subscription plan could not be changed.");
  }

  await logBillingEvent(admin, organizationId, "billing.plan_changed", {
    plan_id: planId,
    plan_code: plan.code,
    duration_years: durationYears,
    changed_by: context.id,
  });
  revalidatePath(path);
  revalidatePath("/super-admin/billing");
  redirectWith(path, "notice", "Subscription plan changed.");
}

export async function manuallyActivateSubscriptionAction(formData: FormData) {
  const context = await requirePlatformAdminAction();
  const organizationId = formString(formData, "organizationId");
  const subscriptionId = formString(formData, "subscriptionId");
  const planId = formString(formData, "planId");
  const durationYears = parseDuration(formString(formData, "durationYears"));
  const redirectTo = formString(formData, "redirectTo") || "/super-admin/billing";

  if (!organizationId || !subscriptionId || !planId || !durationYears) {
    redirectWith(redirectTo, "error", "Choose a valid organization, plan, and duration.");
  }

  const admin = createSupabaseAdminClient();
  const now = new Date();
  const currentPeriodEnd = addYears(now, durationYears).toISOString();
  const { error } = await admin
    .from("organization_subscriptions")
    .update({
      plan_id: planId,
      status: "active",
      duration_years: durationYears,
      current_period_start: now.toISOString(),
      current_period_end: currentPeriodEnd,
      trial_started_at: null,
      trial_ends_at: null,
      grace_ends_at: null,
      payment_method: "instapay_manual",
    })
    .eq("id", subscriptionId)
    .eq("company_id", organizationId);

  if (error) {
    redirectWith(redirectTo, "error", "Subscription could not be manually activated.");
  }

  await admin.from("companies").update({ status: "active" }).eq("id", organizationId);
  await logBillingEvent(admin, organizationId, "billing.subscription_manually_activated", {
    plan_id: planId,
    duration_years: durationYears,
    current_period_end: currentPeriodEnd,
    activated_by: context.id,
  });
  revalidatePath(redirectTo);
  revalidatePath("/super-admin/billing");
  redirectWith(redirectTo, "notice", "Subscription manually activated.");
}

export async function markOrganizationReadOnlyAction(formData: FormData) {
  const context = await requirePlatformAdminAction();
  const organizationId = formString(formData, "organizationId");
  const subscriptionId = formString(formData, "subscriptionId");
  const path = `/super-admin/organizations/${organizationId}`;

  if (!organizationId || !subscriptionId) {
    redirectWith(path, "error", "Subscription could not be resolved.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("organization_subscriptions")
    .update({ status: "expired" })
    .eq("id", subscriptionId)
    .eq("company_id", organizationId);

  if (error) {
    redirectWith(path, "error", "Organization could not be marked read-only.");
  }

  await logBillingEvent(admin, organizationId, "billing.organization_marked_read_only", {
    marked_by: context.id,
  });
  revalidatePath(path);
  redirectWith(path, "notice", "Organization marked read-only through subscription status.");
}

export async function processScheduledDeletionAction(formData: FormData) {
  const context = await requirePlatformAdminAction();
  const organizationId = formString(formData, "organizationId");
  const path = `/super-admin/organizations/${organizationId}`;

  if (!organizationId) {
    redirectWith("/super-admin/organizations", "error", "Organization could not be resolved.");
  }

  const admin = createSupabaseAdminClient();
  const { data: subscription } = await admin
    .from("organization_subscriptions")
    .select("id, status")
    .eq("company_id", organizationId)
    .maybeSingle();

  if (subscription?.status !== "scheduled_deletion") {
    redirectWith(path, "error", "Only scheduled-deletion organizations can be processed here.");
  }

  const { error } = await admin.from("companies").update({ status: "deleted" }).eq("id", organizationId);

  if (error) {
    redirectWith(path, "error", "Scheduled deletion could not be processed.");
  }

  await admin.from("platform_activity_logs").insert({
    platform_admin_id: context.id,
    action: "organizations.scheduled_deletion_processed",
    entity_type: "organization",
    entity_id: organizationId,
    metadata: { subscription_id: subscription.id },
  });
  revalidatePath(path);
  redirectWith(path, "notice", "Organization marked deleted. Use hard delete only after final confirmation.");
}

export async function addTrialBlacklistEmailAction(formData: FormData) {
  const context = await requirePlatformAdminAction();
  const email = formString(formData, "email").trim().toLowerCase();
  const reason = formString(formData, "reason").trim();
  const companyId = formString(formData, "companyId") || null;

  if (!email || !email.includes("@") || reason.length < 3) {
    redirectWith("/super-admin/trial-blacklist", "error", "Enter a valid email and reason.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("trial_blacklist").upsert({
    email,
    normalized_email: email,
    reason,
    company_id: companyId,
    created_by: context.id,
  }, { onConflict: "normalized_email" });

  if (error) {
    redirectWith("/super-admin/trial-blacklist", "error", "Trial blacklist entry could not be saved.");
  }

  revalidatePath("/super-admin/trial-blacklist");
  redirectWith("/super-admin/trial-blacklist", "notice", "Trial blacklist updated.");
}

export async function removeTrialBlacklistEmailAction(formData: FormData) {
  await requirePlatformAdminAction();
  const entryId = formString(formData, "entryId");

  if (!entryId) {
    redirectWith("/super-admin/trial-blacklist", "error", "Blacklist entry could not be resolved.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("trial_blacklist").delete().eq("id", entryId);

  if (error) {
    redirectWith("/super-admin/trial-blacklist", "error", "Blacklist entry could not be removed.");
  }

  revalidatePath("/super-admin/trial-blacklist");
  redirectWith("/super-admin/trial-blacklist", "notice", "Trial blacklist entry removed.");
}

export async function updateSupportItemAction(formData: FormData) {
  const context = await requirePlatformAdminAction();
  const itemId = formString(formData, "itemId");
  const status = formString(formData, "status");
  const internalNote = formString(formData, "internalNote").trim();

  if (!itemId || !["open", "in_progress", "resolved", "closed"].includes(status)) {
    redirectWith("/super-admin/support", "error", "Support item could not be updated.");
  }

  const resolved = status === "resolved" || status === "closed";
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("platform_support_items")
    .update({
      status: status as "open" | "in_progress" | "resolved" | "closed",
      internal_note: internalNote,
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by: resolved ? context.id : null,
    })
    .eq("id", itemId);

  if (error) {
    redirectWith("/super-admin/support", "error", "Support item could not be updated.");
  }

  revalidatePath("/super-admin/support");
  redirectWith("/super-admin/support", "notice", "Support item updated.");
}

export async function createPlatformAnnouncementAction(formData: FormData) {
  const context = await requirePlatformAdminAction();
  const title = formString(formData, "title").trim();
  const message = formString(formData, "message").trim();
  const targetType = formString(formData, "targetType");
  const targetCompanyId = formString(formData, "targetCompanyId") || null;
  const severity = formString(formData, "severity");
  const startsAt = parseDateInput(formString(formData, "startsAt")) ?? new Date().toISOString();
  const endsAt = parseDateInput(formString(formData, "endsAt"));

  if (
    title.length < 3 ||
    message.length < 3 ||
    !["all", "organization"].includes(targetType) ||
    !["info", "warning", "critical"].includes(severity) ||
    (targetType === "organization" && !targetCompanyId)
  ) {
    redirectWith("/super-admin/announcements", "error", "Check announcement details.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("platform_announcements").insert({
    title,
    message,
    target_type: targetType as "all" | "organization",
    target_company_id: targetType === "organization" ? targetCompanyId : null,
    severity: severity as "info" | "warning" | "critical",
    status: "active",
    starts_at: startsAt,
    ends_at: endsAt,
    created_by: context.id,
  });

  if (error) {
    redirectWith("/super-admin/announcements", "error", "Announcement could not be created.");
  }

  revalidatePath("/", "layout");
  revalidatePath("/super-admin/announcements");
  redirectWith("/super-admin/announcements", "notice", "Announcement published.");
}

export async function archivePlatformAnnouncementAction(formData: FormData) {
  await requirePlatformAdminAction();
  const announcementId = formString(formData, "announcementId");

  if (!announcementId) {
    redirectWith("/super-admin/announcements", "error", "Announcement could not be resolved.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("platform_announcements")
    .update({ status: "archived" })
    .eq("id", announcementId);

  if (error) {
    redirectWith("/super-admin/announcements", "error", "Announcement could not be archived.");
  }

  revalidatePath("/", "layout");
  revalidatePath("/super-admin/announcements");
  redirectWith("/super-admin/announcements", "notice", "Announcement archived.");
}

export async function resolvePlatformEventAction(formData: FormData) {
  const context = await requirePlatformAdminAction();
  const eventId = formString(formData, "eventId");
  const status = formString(formData, "status");
  const internalNote = formString(formData, "internalNote").trim();

  if (!eventId || !["resolved", "ignored"].includes(status)) {
    redirectWith("/super-admin/system-health", "error", "Platform event could not be updated.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("platform_events")
    .update({
      status: status as "resolved" | "ignored",
      internal_note: internalNote,
      resolved_at: new Date().toISOString(),
      resolved_by: context.id,
    })
    .eq("id", eventId);

  if (error) {
    redirectWith("/super-admin/system-health", "error", "Platform event could not be updated.");
  }

  revalidatePath("/super-admin/system-health");
  redirectWith("/super-admin/system-health", "notice", "Platform event updated.");
}
