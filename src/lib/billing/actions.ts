"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthContext, requireSuperiorAdminContext } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import {
  BILLING_RECEIPTS_BUCKET,
  calculatePlanAmount,
  isBillingDuration,
  type BillingDurationYears,
  type PaymentReceipt,
  type SubscriptionPlan,
} from "@/lib/billing/constants";
import {
  activateSubscriptionFromReceipt,
  blacklistTrialEmail,
  logBillingEvent,
} from "@/lib/billing/service";
import { hasSupabaseAdminConfig } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const receiptMimeTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["application/pdf", "pdf"],
]);

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

async function requireBillingManager() {
  const context = await requireAuthContext();

  if (context.role !== "admin" || !hasPermission(context, "settings.company", "limited")) {
    redirectWith("/settings", "error", "Billing management is available to Marketing Managers only.");
  }

  if (context.isDemo) {
    redirectWith("/settings", "error", "Billing is disabled in demo mode.");
  }

  return context;
}

async function currentPlatformAdminId(authUserId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("platform_admins")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  return data?.id ?? null;
}

async function loadPlan(planId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("subscription_plans")
    .select("id, code, name, user_limit, yearly_price_egp, is_custom, is_active, created_at")
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as SubscriptionPlan;
}

async function loadStarterPlanId(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await admin
    .from("subscription_plans")
    .select("id")
    .eq("code", "starter")
    .maybeSingle();

  return data?.id ?? null;
}

export async function backfillMissingSubscriptionsAction() {
  const context = await requireSuperiorAdminContext();

  if (!hasSupabaseAdminConfig()) {
    redirectWith("/super-admin/billing", "error", "Billing service role is not configured.");
  }

  const admin = createSupabaseAdminClient();
  const platformAdminId = await currentPlatformAdminId(context.authUserId);
  const [{ data: companies }, { data: subscriptions }, starterPlanId] = await Promise.all([
    admin
      .from("companies")
      .select("id, name"),
    admin
      .from("organization_subscriptions")
      .select("company_id"),
    loadStarterPlanId(admin),
  ]);
  const subscribedCompanyIds = new Set(
    ((subscriptions as Array<{ company_id: string }> | null) ?? []).map((subscription) => subscription.company_id)
  );
  const missingCompanies = ((companies as Array<{ id: string; name: string }> | null) ?? [])
    .filter((company) => !subscribedCompanyIds.has(company.id));

  if (!missingCompanies.length) {
    redirectWith("/super-admin/billing", "notice", "All active organizations already have subscriptions.");
  }

  const { data: inserted, error } = await admin
    .from("organization_subscriptions")
    .insert(missingCompanies.map((company) => ({
      company_id: company.id,
      plan_id: starterPlanId,
      status: "trial_pending",
      trial_started_at: null,
      trial_ends_at: null,
      grace_ends_at: null,
      payment_method: "instapay_manual",
    })))
    .select("company_id");

  if (error) {
    redirectWith("/super-admin/billing", "error", "Missing subscriptions could not be backfilled.");
  }

  const insertedRows = (inserted as Array<{ company_id: string }> | null) ?? [];

  await Promise.all(insertedRows.map((row) => logBillingEvent(admin, row.company_id, "billing.subscription_backfilled", {
    status: "trial_pending",
    trial_started_at: null,
    trial_ends_at: null,
    grace_ends_at: null,
    plan_code: "starter",
    backfilled_by: platformAdminId,
  })));

  revalidatePath("/super-admin/billing");
  redirectWith("/super-admin/billing", "notice", `${insertedRows.length} missing subscription${insertedRows.length === 1 ? "" : "s"} backfilled.`);
}

export async function updateAutoRenewAction(formData: FormData) {
  const context = await requireBillingManager();

  if (!hasSupabaseAdminConfig()) {
    redirectWith("/settings/billing", "error", "Billing service role is not configured.");
  }

  const enabled = formData.get("autoRenew") === "on";
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("organization_subscriptions")
    .update({ auto_renew_enabled: enabled })
    .eq("company_id", context.companyId);

  if (error) {
    redirectWith("/settings/billing", "error", "Auto-renewal preference could not be saved.");
  }

  await logBillingEvent(admin, context.companyId, "billing.auto_renew_updated", {
    auto_renew_enabled: enabled,
  }, context.userId);
  revalidatePath("/settings/billing");
  redirectWith("/settings/billing", "notice", enabled ? "Auto-renewal reminders enabled." : "Auto-renewal reminders disabled.");
}

export async function submitPaymentReceiptAction(formData: FormData) {
  const context = await requireBillingManager();

  if (!hasSupabaseAdminConfig()) {
    redirectWith("/settings/billing", "error", "Billing service role is not configured.");
  }

  const planId = formString(formData, "planId");
  const durationYears = parseDuration(formString(formData, "durationYears"));
  const file = formData.get("receipt");

  if (!planId || !durationYears) {
    redirectWith("/settings/billing", "error", "Choose a plan and billing duration.");
  }

  if (!(file instanceof File) || file.size === 0) {
    redirectWith("/settings/billing", "error", "Upload your InstaPay receipt.");
  }

  if (file.size > 10 * 1024 * 1024) {
    redirectWith("/settings/billing", "error", "Receipt file must be 10 MB or smaller.");
  }

  const extension = receiptMimeTypes.get(file.type);

  if (!extension) {
    redirectWith("/settings/billing", "error", "Receipt must be a JPG, PNG, WebP, or PDF file.");
  }

  const admin = createSupabaseAdminClient();
  const [{ data: subscription }, plan] = await Promise.all([
    admin
      .from("organization_subscriptions")
      .select("id, company_id")
      .eq("company_id", context.companyId)
      .maybeSingle(),
    loadPlan(planId),
  ]);

  if (!subscription?.id) {
    redirectWith("/settings/billing", "error", "Subscription record could not be resolved.");
  }

  if (!plan) {
    redirectWith("/settings/billing", "error", "Selected plan is not available.");
  }

  const amountEgp = calculatePlanAmount(plan, durationYears);

  if (amountEgp === null) {
    redirectWith("/settings/billing", "error", "Enterprise billing requires Super Admin contact before receipt upload.");
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || `receipt.${extension}`;
  const receiptPath = `${context.companyId}/${subscription.id}/${randomUUID()}-${safeFileName}`;
  const uploadBody = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from(BILLING_RECEIPTS_BUCKET)
    .upload(receiptPath, uploadBody, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    redirectWith("/settings/billing", "error", "Receipt could not be uploaded. Please try again.");
  }

  const { error } = await admin.from("payment_receipts").insert({
    company_id: context.companyId,
    subscription_id: subscription.id,
    amount_egp: amountEgp,
    duration_years: durationYears,
    plan_id: plan.id,
    receipt_file_path: receiptPath,
    status: "pending",
    submitted_by: context.userId,
  });

  if (error) {
    await admin.storage.from(BILLING_RECEIPTS_BUCKET).remove([receiptPath]);
    redirectWith("/settings/billing", "error", "Receipt metadata could not be saved.");
  }

  await logBillingEvent(admin, context.companyId, "billing.receipt_submitted", {
    plan_code: plan.code,
    duration_years: durationYears,
    amount_egp: amountEgp,
  }, context.userId);
  revalidatePath("/settings/billing");
  revalidatePath("/super-admin/billing");
  redirectWith("/settings/billing", "notice", "Receipt submitted for Super Admin verification.");
}

export async function approvePaymentReceiptAction(formData: FormData) {
  const context = await requireSuperiorAdminContext();

  if (!hasSupabaseAdminConfig()) {
    redirectWith("/super-admin/billing", "error", "Billing service role is not configured.");
  }

  const receiptId = formString(formData, "receiptId");

  if (!receiptId) {
    redirectWith("/super-admin/billing", "error", "Receipt could not be resolved.");
  }

  const admin = createSupabaseAdminClient();
  const platformAdminId = await currentPlatformAdminId(context.authUserId);
  const { data, error: loadError } = await admin
    .from("payment_receipts")
    .select("*")
    .eq("id", receiptId)
    .maybeSingle();
  const receipt = data as PaymentReceipt | null;

  if (loadError || !receipt) {
    redirectWith("/super-admin/billing", "error", "Receipt was not found.");
  }

  if (receipt.status !== "pending") {
    redirectWith("/super-admin/billing", "error", "Only pending receipts can be approved.");
  }

  const { error } = await admin
    .from("payment_receipts")
    .update({
      status: "approved",
      reviewed_by: platformAdminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", receipt.id);

  if (error) {
    redirectWith("/super-admin/billing", "error", "Receipt could not be approved.");
  }

  await activateSubscriptionFromReceipt({
    companyId: receipt.company_id,
    subscriptionId: receipt.subscription_id,
    planId: receipt.plan_id,
    durationYears: receipt.duration_years,
    platformAdminId,
  });

  revalidatePath("/super-admin/billing");
  revalidatePath("/settings/billing");
  revalidatePath("/", "layout");
  redirectWith("/super-admin/billing", "notice", "Receipt approved and subscription activated.");
}

export async function rejectPaymentReceiptAction(formData: FormData) {
  const context = await requireSuperiorAdminContext();

  if (!hasSupabaseAdminConfig()) {
    redirectWith("/super-admin/billing", "error", "Billing service role is not configured.");
  }

  const receiptId = formString(formData, "receiptId");
  const rejectionReason = formString(formData, "rejectionReason").trim();

  if (!receiptId || rejectionReason.length < 3) {
    redirectWith("/super-admin/billing", "error", "Enter a receipt and rejection reason.");
  }

  const admin = createSupabaseAdminClient();
  const platformAdminId = await currentPlatformAdminId(context.authUserId);
  const { data } = await admin
    .from("payment_receipts")
    .select("*")
    .eq("id", receiptId)
    .maybeSingle();
  const receipt = data as PaymentReceipt | null;

  if (!receipt) {
    redirectWith("/super-admin/billing", "error", "Receipt was not found.");
  }

  const { error } = await admin
    .from("payment_receipts")
    .update({
      status: "rejected",
      reviewed_by: platformAdminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectionReason,
    })
    .eq("id", receipt.id);

  if (error) {
    redirectWith("/super-admin/billing", "error", "Receipt could not be rejected.");
  }

  await logBillingEvent(admin, receipt.company_id, "billing.receipt_rejected", {
    reason: rejectionReason,
    receipt_id: receipt.id,
  });
  revalidatePath("/super-admin/billing");
  revalidatePath("/settings/billing");
  redirectWith("/super-admin/billing", "notice", "Receipt rejected.");
}

export async function processExpiredSubscriptionsAction() {
  const context = await requireSuperiorAdminContext();

  if (!hasSupabaseAdminConfig()) {
    redirectWith("/super-admin/billing", "error", "Billing service role is not configured.");
  }

  const admin = createSupabaseAdminClient();
  const platformAdminId = await currentPlatformAdminId(context.authUserId);
  const now = new Date().toISOString();
  const { data: expired } = await admin
    .from("organization_subscriptions")
    .select("id, company_id, status, grace_ends_at")
    .eq("status", "grace_period")
    .lte("grace_ends_at", now);
  const rows = (expired as Array<{ id: string; company_id: string; status: string; grace_ends_at: string | null }> | null) ?? [];

  for (const subscription of rows) {
    await admin
      .from("organization_subscriptions")
      .update({ status: "scheduled_deletion" })
      .eq("id", subscription.id);

    const [{ data: company }, { data: request }] = await Promise.all([
      admin
        .from("companies")
        .select("id, owner_user_id")
        .eq("id", subscription.company_id)
        .maybeSingle(),
      admin
        .from("organization_requests")
        .select("business_email")
        .eq("approved_company_id", subscription.company_id)
        .maybeSingle(),
    ]);
    const { data: owner } = company?.owner_user_id
      ? await admin.from("users").select("email").eq("id", company.owner_user_id).maybeSingle()
      : { data: null };
    const email = owner?.email ?? request?.business_email ?? null;

    if (email) {
      await blacklistTrialEmail({
        email,
        companyId: subscription.company_id,
        reason: "Trial grace period expired.",
        platformAdminId,
      });
    }

    await logBillingEvent(admin, subscription.company_id, "billing.expired_processed", {
      grace_ends_at: subscription.grace_ends_at,
      action: "scheduled_deletion_blacklisted",
      hard_delete: "Use the organization detail danger-zone hard delete after final review.",
    });
  }

  revalidatePath("/super-admin/billing");
  redirectWith("/super-admin/billing", "notice", `${rows.length} expired subscription${rows.length === 1 ? "" : "s"} processed.`);
}
