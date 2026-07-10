import "server-only";

import { requireAuthContext, requireSuperiorAdminContext } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import { BILLING_RECEIPTS_BUCKET, calculatePlanAmount, type BillingDurationYears, type BillingEvent, type OrganizationSubscription, type PaymentReceipt, type SubscriptionPlan } from "@/lib/billing/constants";
import { getSubscriptionSummary } from "@/lib/billing/service";
import { hasSupabaseAdminConfig } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth/permissions";

export type BillingPlanOption = SubscriptionPlan & {
  amounts: Record<BillingDurationYears, number | null>;
};

export type BillingOverview = {
  subscription: OrganizationSubscription | null;
  plans: BillingPlanOption[];
  receipts: PaymentReceipt[];
  events: BillingEvent[];
  instapay: {
    name: string;
    handle: string;
    phone: string;
  };
};

export type SuperAdminBillingSubscription = OrganizationSubscription & {
  companyName: string;
  companySlug: string;
  ownerEmail: string | null;
  planName: string | null;
};

export type SuperAdminBillingReceipt = PaymentReceipt & {
  companyName: string;
  planName: string | null;
  submittedByEmail: string | null;
  signedUrl: string | null;
};

function withAmounts(plan: SubscriptionPlan): BillingPlanOption {
  return {
    ...plan,
    amounts: {
      1: calculatePlanAmount(plan, 1),
      5: calculatePlanAmount(plan, 5),
      7: calculatePlanAmount(plan, 7),
    },
  };
}

function requireBillingManager(context: AuthContext) {
  return context.role === "admin" && hasPermission(context, "settings.company", "limited");
}

export async function getBillingOverview(context: AuthContext): Promise<BillingOverview> {
  if (!requireBillingManager(context)) {
    throw new Error("Billing is available to Marketing Managers only.");
  }

  const subscription = await getSubscriptionSummary(context.companyId);
  const supabase = await createSupabaseServerClient();
  const [{ data: plans }, { data: receipts }, { data: events }] = await Promise.all([
    supabase
      .from("subscription_plans")
      .select("id, code, name, user_limit, yearly_price_egp, is_custom, is_active, created_at")
      .eq("is_active", true)
      .order("yearly_price_egp", { ascending: true, nullsFirst: false }),
    supabase
      .from("payment_receipts")
      .select("*")
      .eq("company_id", context.companyId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("billing_events")
      .select("*")
      .eq("company_id", context.companyId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  return {
    subscription,
    plans: ((plans as SubscriptionPlan[] | null) ?? []).map(withAmounts),
    receipts: (receipts as PaymentReceipt[] | null) ?? [],
    events: (events as BillingEvent[] | null) ?? [],
    instapay: {
      name: process.env.CONTENTO_INSTAPAY_NAME ?? "Configured in deployment",
      handle: process.env.CONTENTO_INSTAPAY_HANDLE ?? "Configured in deployment",
      phone: process.env.CONTENTO_INSTAPAY_PHONE ?? "Configured in deployment",
    },
  };
}

export async function getCurrentBillingOverview() {
  const context = await requireAuthContext();
  return getBillingOverview(context);
}

export async function getSuperAdminBillingOverview() {
  await requireSuperiorAdminContext();

  if (!hasSupabaseAdminConfig()) {
    throw new Error("Supabase service role is required for billing administration.");
  }

  const admin = createSupabaseAdminClient();
  const [{ data: subscriptions }, { data: receipts }] = await Promise.all([
    admin
      .from("organization_subscriptions")
      .select("*")
      .order("updated_at", { ascending: false }),
    admin
      .from("payment_receipts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const subscriptionRows = (subscriptions as OrganizationSubscription[] | null) ?? [];
  const receiptRows = (receipts as PaymentReceipt[] | null) ?? [];
  const companyIds = Array.from(new Set([
    ...subscriptionRows.map((row) => row.company_id),
    ...receiptRows.map((row) => row.company_id),
  ]));
  const planIds = Array.from(new Set([
    ...subscriptionRows.map((row) => row.plan_id).filter(Boolean),
    ...receiptRows.map((row) => row.plan_id).filter(Boolean),
  ] as string[]));
  const userIds = Array.from(new Set(receiptRows.map((row) => row.submitted_by).filter(Boolean) as string[]));
  const [{ data: companies }, { data: plans }, { data: users }] = await Promise.all([
    companyIds.length
      ? admin.from("companies").select("id, name, slug, owner_user_id").in("id", companyIds)
      : Promise.resolve({ data: [] }),
    planIds.length
      ? admin.from("subscription_plans").select("id, name").in("id", planIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? admin.from("users").select("id, email").in("id", userIds)
      : Promise.resolve({ data: [] }),
  ]);
  const ownerIds = ((companies as Array<{ owner_user_id: string | null }> | null) ?? [])
    .map((company) => company.owner_user_id)
    .filter(Boolean) as string[];
  const { data: owners } = ownerIds.length
    ? await admin.from("users").select("id, email").in("id", ownerIds)
    : { data: [] };
  const companyById = new Map(((companies as Array<{ id: string; name: string; slug: string; owner_user_id: string | null }> | null) ?? []).map((company) => [company.id, company]));
  const planById = new Map(((plans as Array<{ id: string; name: string }> | null) ?? []).map((plan) => [plan.id, plan.name]));
  const userEmailById = new Map(((users as Array<{ id: string; email: string }> | null) ?? []).map((user) => [user.id, user.email]));
  const ownerEmailById = new Map(((owners as Array<{ id: string; email: string }> | null) ?? []).map((owner) => [owner.id, owner.email]));

  const signedUrlByPath = new Map<string, string | null>();
  for (const receipt of receiptRows) {
    const { data: signed } = await admin.storage
      .from(BILLING_RECEIPTS_BUCKET)
      .createSignedUrl(receipt.receipt_file_path, 60 * 15);
    signedUrlByPath.set(receipt.receipt_file_path, signed?.signedUrl ?? null);
  }

  return {
    subscriptions: subscriptionRows.map((subscription): SuperAdminBillingSubscription => {
      const company = companyById.get(subscription.company_id);

      return {
        ...subscription,
        companyName: company?.name ?? "Unknown organization",
        companySlug: company?.slug ?? "unknown",
        ownerEmail: company?.owner_user_id ? ownerEmailById.get(company.owner_user_id) ?? null : null,
        planName: subscription.plan_id ? planById.get(subscription.plan_id) ?? null : null,
      };
    }),
    receipts: receiptRows.map((receipt): SuperAdminBillingReceipt => ({
      ...receipt,
      companyName: companyById.get(receipt.company_id)?.name ?? "Unknown organization",
      planName: receipt.plan_id ? planById.get(receipt.plan_id) ?? null : null,
      submittedByEmail: receipt.submitted_by ? userEmailById.get(receipt.submitted_by) ?? null : null,
      signedUrl: signedUrlByPath.get(receipt.receipt_file_path) ?? null,
    })),
  };
}
