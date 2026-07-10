import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CreditCard, FileUp, ReceiptText, RefreshCw } from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAuthContext } from "@/lib/auth/context";
import { updateAutoRenewAction, submitPaymentReceiptAction } from "@/lib/billing/actions";
import { formatEgp, isSubscriptionReadOnly } from "@/lib/billing/constants";
import { getBillingOverview } from "@/lib/billing/queries";
import { formatCairoDateTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Billing",
};

function dateLabel(value: string | null) {
  return value ? formatCairoDateTime(value) : "Not set";
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [context, params] = await Promise.all([requireAuthContext(), searchParams]);

  if (context.role !== "admin") {
    redirect("/settings?error=billing-management-is-for-marketing-managers");
  }

  const overview = await getBillingOverview(context);
  const subscription = overview.subscription;
  const defaultPlanId = subscription?.plan_id ?? overview.plans[0]?.id ?? "";
  const defaultDuration = subscription?.duration_years ?? 1;
  const readOnly = isSubscriptionReadOnly(subscription?.status);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Billing</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Manage your Contento subscription, trial status, and manual InstaPay receipt verification.
        </p>
      </div>

      <PageMessage error={params.error} status={params.notice} />

      {readOnly && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle>Workspace is read-only</CardTitle>
            <CardDescription>
              Renew billing to restore create, update, upload, review, report, and user-management actions.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Status</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{subscription?.status.replaceAll("_", " ") ?? "Not configured"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Trial ends</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium">{dateLabel(subscription?.trial_ends_at ?? null)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Grace ends</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium">{dateLabel(subscription?.grace_ends_at ?? null)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Renewal date</CardTitle>
          </CardHeader>
          <CardContent className="text-sm font-medium">{dateLabel(subscription?.current_period_end ?? null)}</CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-4 text-primary" />
              Plans and durations
            </CardTitle>
            <CardDescription>Manual InstaPay billing is active. Online purchase is coming soon.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {overview.plans.map((plan) => (
                <div key={plan.id} className="rounded-xl border bg-secondary/25 p-4">
                  <p className="font-semibold">{plan.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {plan.user_limit ? `Up to ${plan.user_limit} users` : "Custom team size"}
                  </p>
                  <div className="mt-4 grid gap-1 text-sm">
                    <span>1 year: {formatEgp(plan.amounts[1])}</span>
                    <span>5 years: {formatEgp(plan.amounts[5])}</span>
                    <span>7 years: {formatEgp(plan.amounts[7])}</span>
                  </div>
                </div>
              ))}
            </div>

            <form action={submitPaymentReceiptAction} className="grid gap-4 rounded-xl border bg-background p-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="planId">Plan</Label>
                <select
                  id="planId"
                  name="planId"
                  defaultValue={defaultPlanId}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                  required
                >
                  {overview.plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="durationYears">Duration</Label>
                <select
                  id="durationYears"
                  name="durationYears"
                  defaultValue={defaultDuration}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                  required
                >
                  <option value="1">1 year</option>
                  <option value="5">5 years - 20% discount</option>
                  <option value="7">7 years - 30% discount</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="receipt">InstaPay receipt</Label>
                <Input id="receipt" name="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required />
              </div>
              <div className="rounded-lg border bg-secondary/25 p-3 text-sm leading-6 md:col-span-2">
                <p className="font-medium">InstaPay instructions</p>
                <p>Recipient: {overview.instapay.name}</p>
                <p>Handle: {overview.instapay.handle}</p>
                <p>Phone: {overview.instapay.phone}</p>
                <p className="mt-2 text-muted-foreground">
                  After payment, upload your receipt. Super Admin will verify and activate your subscription.
                </p>
              </div>
              <div className="md:col-span-2">
                <Button type="submit">
                  <FileUp />
                  Upload receipt
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="size-4 text-primary" />
                Auto renewal intent
              </CardTitle>
              <CardDescription>
                Auto renewal prepares reminders only. Automatic payment collection is coming soon.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateAutoRenewAction} className="flex items-center justify-between gap-3">
                <Label htmlFor="autoRenew" className="text-sm">Enable renewal reminders</Label>
                <input
                  id="autoRenew"
                  name="autoRenew"
                  type="checkbox"
                  defaultChecked={subscription?.auto_renew_enabled ?? false}
                  className="size-5 accent-primary"
                />
                <Button type="submit" variant="outline">Save</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="size-4 text-primary" />
                Recent receipts
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {overview.receipts.map((receipt) => (
                <div key={receipt.id} className="rounded-lg border bg-secondary/25 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{formatEgp(receipt.amount_egp)}</span>
                    <span className="rounded-full border px-2 py-0.5 text-xs capitalize">{receipt.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {receipt.duration_years} year{receipt.duration_years === 1 ? "" : "s"} - {formatCairoDateTime(receipt.created_at)}
                  </p>
                  {receipt.rejection_reason && (
                    <p className="mt-2 text-xs text-destructive">{receipt.rejection_reason}</p>
                  )}
                </div>
              ))}
              {!overview.receipts.length && <p className="text-sm text-muted-foreground">No receipts uploaded yet.</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Billing events</CardTitle>
          <CardDescription>Trial, grace, receipt, and activation audit history.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {overview.events.map((event) => (
            <div key={event.id} className="rounded-lg border bg-secondary/25 p-3">
              <p className="font-medium">{event.action}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatCairoDateTime(event.created_at)}</p>
            </div>
          ))}
          {!overview.events.length && <p className="text-sm text-muted-foreground">No billing events yet.</p>}
        </CardContent>
      </Card>
    </section>
  );
}
