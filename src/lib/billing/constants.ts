import type { Database } from "@/types/database";

export type SubscriptionPlan = Database["public"]["Tables"]["subscription_plans"]["Row"];
export type OrganizationSubscription = Database["public"]["Tables"]["organization_subscriptions"]["Row"];
export type PaymentReceipt = Database["public"]["Tables"]["payment_receipts"]["Row"];
export type BillingEvent = Database["public"]["Tables"]["billing_events"]["Row"];
export type SubscriptionStatus = OrganizationSubscription["status"];
export type BillingDurationYears = 1 | 5 | 7;

export const TRIAL_DAYS = 30;
export const GRACE_BUSINESS_DAYS = 10;
export const BILLING_RECEIPTS_BUCKET = "contento-billing-receipts";
export const BILLING_READ_ONLY_STATUSES: SubscriptionStatus[] = [
  "grace_period",
  "expired",
  "scheduled_deletion",
];

export const durationDiscounts: Record<BillingDurationYears, number> = {
  1: 0,
  5: 0.2,
  7: 0.3,
};

export function isBillingDuration(value: number): value is BillingDurationYears {
  return value === 1 || value === 5 || value === 7;
}

export function isSubscriptionReadOnly(status: SubscriptionStatus | null | undefined) {
  return Boolean(status && BILLING_READ_ONLY_STATUSES.includes(status));
}

export function normalizeBillingEmail(email: string) {
  return email.trim().toLowerCase();
}

export function calculatePlanAmount(plan: Pick<SubscriptionPlan, "yearly_price_egp" | "is_custom">, durationYears: BillingDurationYears) {
  if (plan.is_custom || plan.yearly_price_egp === null) {
    return null;
  }

  const discount = durationDiscounts[durationYears];
  return Math.round(plan.yearly_price_egp * durationYears * (1 - discount));
}

export function addBusinessDaysEgypt(startDate: Date, businessDays: number) {
  const next = new Date(startDate);
  let remaining = businessDays;

  while (remaining > 0) {
    next.setUTCDate(next.getUTCDate() + 1);
    const day = next.getUTCDay();

    if (day !== 5 && day !== 6) {
      remaining -= 1;
    }
  }

  return next;
}

export function formatEgp(amount: number | null | undefined) {
  if (amount === null || amount === undefined) {
    return "Custom";
  }

  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function addYears(date: Date, years: BillingDurationYears) {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}
