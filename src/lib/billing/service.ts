import "server-only";

import type { AuthContext } from "@/lib/auth/permissions";
import { hasSupabaseAdminConfig } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  addBusinessDaysEgypt,
  addYears,
  GRACE_BUSINESS_DAYS,
  isSubscriptionReadOnly,
  normalizeBillingEmail,
  TRIAL_DAYS,
  type BillingDurationYears,
  type OrganizationSubscription,
  type SubscriptionPlan,
} from "@/lib/billing/constants";
import type { Json } from "@/types/database";

export class WorkspaceReadOnlyError extends Error {
  constructor(message = "Subscription inactive. Workspace is read-only until billing is renewed.") {
    super(message);
    this.name = "WorkspaceReadOnlyError";
  }
}

type BillingClient = ReturnType<typeof createSupabaseAdminClient>;

function canUseBillingAdmin() {
  return hasSupabaseAdminConfig();
}

async function getStarterPlan(admin: BillingClient) {
  const { data } = await admin
    .from("subscription_plans")
    .select("id, code, name, user_limit, yearly_price_egp, is_custom, is_active, created_at")
    .eq("code", "starter")
    .maybeSingle();

  return data as SubscriptionPlan | null;
}

async function getPlanByCode(admin: BillingClient, code: string) {
  const { data } = await admin
    .from("subscription_plans")
    .select("id, code, name, user_limit, yearly_price_egp, is_custom, is_active, created_at")
    .eq("code", code)
    .maybeSingle();

  return data as SubscriptionPlan | null;
}

export async function logBillingEvent(
  admin: BillingClient,
  companyId: string | null,
  action: string,
  metadata: Json = {},
  actorUserId: string | null = null
) {
  if (!companyId) {
    return;
  }

  await admin.from("billing_events").insert({
    company_id: companyId,
    actor_user_id: actorUserId,
    action,
    metadata,
  });
}

async function notifyMarketingManagers(
  admin: BillingClient,
  companyId: string,
  title: string,
  message: string,
  linkHref = "/settings/billing"
) {
  const { data: roles } = await admin
    .from("roles")
    .select("id")
    .eq("company_id", companyId)
    .in("name", ["Admin", "Marketing Manager"]);
  const roleIds = ((roles as Array<{ id: string }> | null) ?? []).map((role) => role.id);

  if (!roleIds.length) {
    return;
  }

  const { data: users } = await admin
    .from("users")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "active")
    .in("role_id", roleIds);
  const userIds = ((users as Array<{ id: string }> | null) ?? []).map((user) => user.id);

  if (!userIds.length) {
    return;
  }

  await admin.from("notifications").insert(
    userIds.map((userId) => ({
      company_id: companyId,
      user_id: userId,
      title,
      message,
      entity_type: "billing",
      entity_id: companyId,
      link_href: linkHref,
      read: false,
    }))
  );
}

export async function createTrialPendingSubscription(
  companyId: string,
  options: { planCode?: string | null; durationYears?: BillingDurationYears | null } = {}
) {
  if (!canUseBillingAdmin()) {
    return;
  }

  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("organization_subscriptions")
    .select("id")
    .eq("company_id", companyId)
    .maybeSingle();

  if (existing?.id) {
    return;
  }

  const selectedPlan = options.planCode
    ? await getPlanByCode(admin, options.planCode)
    : null;
  const starterPlan = selectedPlan ?? (await getStarterPlan(admin));
  const durationYears = options.durationYears ?? 1;
  const { error } = await admin.from("organization_subscriptions").insert({
    company_id: companyId,
    plan_id: starterPlan?.id ?? null,
    status: "trial_pending",
    duration_years: durationYears,
    payment_method: "instapay_manual",
  });

  if (!error) {
    await logBillingEvent(admin, companyId, "billing.trial_pending_created", {
      plan_code: starterPlan?.code ?? "starter",
      duration_years: durationYears,
    });
  }
}

export async function refreshSubscriptionLifecycle(companyId: string) {
  if (!canUseBillingAdmin()) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("organization_subscriptions")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();
  const subscription = data as OrganizationSubscription | null;

  if (!subscription) {
    return null;
  }

  const now = new Date();

  if (
    subscription.status === "active" &&
    subscription.current_period_end &&
    new Date(subscription.current_period_end) <= now
  ) {
    const graceEndsAt = addBusinessDaysEgypt(now, GRACE_BUSINESS_DAYS).toISOString();
    const { data: updated } = await admin
      .from("organization_subscriptions")
      .update({
        status: "grace_period",
        grace_ends_at: graceEndsAt,
      })
      .eq("id", subscription.id)
      .select("*")
      .single();

    await notifyMarketingManagers(
      admin,
      companyId,
      "Subscription grace period started",
      "Your Contento subscription has ended. Renew within 10 Egypt business days to avoid scheduled deletion."
    );
    await logBillingEvent(admin, companyId, "billing.grace_started", {
      previous_status: subscription.status,
      grace_ends_at: graceEndsAt,
    });

    return updated as OrganizationSubscription | null;
  }

  if (
    subscription.status === "trial_active" &&
    subscription.trial_ends_at &&
    new Date(subscription.trial_ends_at) <= now
  ) {
    const graceEndsAt = addBusinessDaysEgypt(now, GRACE_BUSINESS_DAYS).toISOString();
    const { data: updated } = await admin
      .from("organization_subscriptions")
      .update({
        status: "grace_period",
        grace_ends_at: graceEndsAt,
      })
      .eq("id", subscription.id)
      .select("*")
      .single();

    await notifyMarketingManagers(
      admin,
      companyId,
      "Free trial ended",
      "Your free trial has ended. You have 10 Egypt business days to renew before permanent deletion."
    );
    await logBillingEvent(admin, companyId, "billing.trial_ended_grace_started", {
      trial_ends_at: subscription.trial_ends_at,
      grace_ends_at: graceEndsAt,
    });

    return updated as OrganizationSubscription | null;
  }

  if (
    subscription.status === "grace_period" &&
    subscription.grace_ends_at &&
    new Date(subscription.grace_ends_at) <= now
  ) {
    const { data: updated } = await admin
      .from("organization_subscriptions")
      .update({ status: "scheduled_deletion" })
      .eq("id", subscription.id)
      .select("*")
      .single();

    await notifyMarketingManagers(
      admin,
      companyId,
      "Subscription scheduled for deletion",
      "The billing grace period has ended. A Super Admin must process or renew this organization."
    );
    await logBillingEvent(admin, companyId, "billing.scheduled_deletion", {
      grace_ends_at: subscription.grace_ends_at,
    });

    return updated as OrganizationSubscription | null;
  }

  return subscription;
}

export async function startTrialIfPending(context: AuthContext) {
  if (context.isDemo || context.role !== "admin" || !canUseBillingAdmin()) {
    return;
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("organization_subscriptions")
    .select("*")
    .eq("company_id", context.companyId)
    .maybeSingle();
  const subscription = data as OrganizationSubscription | null;

  if (!subscription || subscription.status !== "trial_pending") {
    if (subscription) {
      await refreshSubscriptionLifecycle(context.companyId);
    }
    return;
  }

  const now = new Date();
  const trialEnds = new Date(now);
  trialEnds.setUTCDate(trialEnds.getUTCDate() + TRIAL_DAYS);
  const trialEndsAt = trialEnds.toISOString();
  const { error } = await admin
    .from("organization_subscriptions")
    .update({
      status: "trial_active",
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt,
    })
    .eq("id", subscription.id);

  if (!error) {
    await notifyMarketingManagers(
      admin,
      context.companyId,
      "Contento trial started",
      "Your 30-day Contento trial has started. Billing stays manual through InstaPay until online purchase launches."
    );
    await logBillingEvent(admin, context.companyId, "billing.trial_started", {
      trial_ends_at: trialEndsAt,
    }, context.userId);
  }
}

export async function getSubscriptionSummary(companyId: string) {
  return refreshSubscriptionLifecycle(companyId);
}

export async function assertWorkspaceWritable(context: AuthContext) {
  if (context.isDemo) {
    return;
  }

  const subscription = await getSubscriptionSummary(context.companyId);

  if (isSubscriptionReadOnly(subscription?.status)) {
    throw new WorkspaceReadOnlyError();
  }
}

export async function blacklistTrialEmail({
  email,
  companyId,
  reason,
  platformAdminId,
}: {
  email: string;
  companyId: string | null;
  reason: string;
  platformAdminId: string | null;
}) {
  if (!canUseBillingAdmin()) {
    return;
  }

  const admin = createSupabaseAdminClient();
  const normalizedEmail = normalizeBillingEmail(email);

  if (!normalizedEmail) {
    return;
  }

  await admin.from("trial_blacklist").upsert({
    email,
    normalized_email: normalizedEmail,
    reason,
    company_id: companyId,
    created_by: platformAdminId,
  }, {
    onConflict: "normalized_email",
  });
}

export async function activateSubscriptionFromReceipt({
  companyId,
  subscriptionId,
  planId,
  durationYears,
  platformAdminId,
}: {
  companyId: string;
  subscriptionId: string;
  planId: string | null;
  durationYears: BillingDurationYears;
  platformAdminId: string | null;
}) {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const currentPeriodEnd = addYears(now, durationYears).toISOString();

  await admin
    .from("organization_subscriptions")
    .update({
      plan_id: planId,
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: currentPeriodEnd,
      duration_years: durationYears,
      payment_method: "instapay_manual",
      grace_ends_at: null,
    })
    .eq("id", subscriptionId)
    .eq("company_id", companyId);

  await admin
    .from("companies")
    .update({ status: "active" })
    .eq("id", companyId);

  await notifyMarketingManagers(
    admin,
    companyId,
    "Subscription activated",
    "Your manual InstaPay receipt was approved and your Contento subscription is active."
  );
  await logBillingEvent(admin, companyId, "billing.subscription_activated", {
    plan_id: planId,
    duration_years: durationYears,
    current_period_end: currentPeriodEnd,
    reviewed_by: platformAdminId,
  });
}
