import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ExternalLink, ReceiptText, ShieldAlert, XCircle } from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { routes } from "@/constants/routes";
import {
  approvePaymentReceiptAction,
  backfillMissingSubscriptionsAction,
  processExpiredSubscriptionsAction,
  rejectPaymentReceiptAction,
} from "@/lib/billing/actions";
import { formatEgp } from "@/lib/billing/constants";
import { getSuperAdminBillingOverview } from "@/lib/billing/queries";
import { formatCairoDateTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Platform billing",
};

function dateLabel(value: string | null) {
  return value ? formatCairoDateTime(value) : "Not set";
}

export default async function SuperAdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [overview, params] = await Promise.all([getSuperAdminBillingOverview(), searchParams]);
  const pendingReceipts = overview.receipts.filter((receipt) => receipt.status === "pending");
  const expiredGraceCount = overview.subscriptions.filter((subscription) => (
    subscription.status === "grace_period" &&
    subscription.grace_ends_at &&
    new Date(subscription.grace_ends_at) <= new Date()
  )).length;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Platform</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Billing</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Review manual InstaPay receipts and keep organization subscriptions safe.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={backfillMissingSubscriptionsAction}>
            <Button type="submit" variant="outline">
              <ReceiptText />
              Backfill missing subscriptions
            </Button>
          </form>
          <form action={processExpiredSubscriptionsAction}>
            <Button type="submit" variant={expiredGraceCount ? "destructive" : "outline"}>
              <ShieldAlert />
              Process expired grace ({expiredGraceCount})
            </Button>
          </form>
        </div>
      </div>

      <PageMessage error={params.error} status={params.notice} />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Subscriptions</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{overview.subscriptions.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending receipts</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{pendingReceipts.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Grace period</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {overview.subscriptions.filter((subscription) => subscription.status === "grace_period").length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Scheduled deletion</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {overview.subscriptions.filter((subscription) => subscription.status === "scheduled_deletion").length}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="size-4 text-primary" />
            Receipt review queue
          </CardTitle>
          <CardDescription>Approve to activate a subscription. Reject with a clear reason for the Marketing Manager.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {overview.receipts.map((receipt) => (
            <div key={receipt.id} className="rounded-xl border bg-secondary/25 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{receipt.companyName}</p>
                    <span className="rounded-full border px-2 py-0.5 text-xs capitalize">{receipt.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {receipt.planName ?? "Unknown plan"} - {receipt.duration_years} year{receipt.duration_years === 1 ? "" : "s"} - {formatEgp(receipt.amount_egp)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Submitted by {receipt.submittedByEmail ?? "unknown"} on {formatCairoDateTime(receipt.created_at)}
                  </p>
                  {receipt.signedUrl && (
                    <Link
                      href={receipt.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-4"
                    >
                      View receipt
                      <ExternalLink className="size-3.5" />
                    </Link>
                  )}
                  {receipt.rejection_reason && (
                    <p className="mt-2 text-sm text-destructive">{receipt.rejection_reason}</p>
                  )}
                </div>

                {receipt.status === "pending" && (
                  <div className="grid gap-2 sm:min-w-80">
                    <form action={approvePaymentReceiptAction}>
                      <input type="hidden" name="receiptId" value={receipt.id} />
                      <Button type="submit" className="w-full">
                        <CheckCircle2 />
                        Approve receipt
                      </Button>
                    </form>
                    <form action={rejectPaymentReceiptAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input type="hidden" name="receiptId" value={receipt.id} />
                      <Input name="rejectionReason" placeholder="Rejection reason" required />
                      <Button type="submit" variant="outline">
                        <XCircle />
                        Reject
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          ))}
          {!overview.receipts.length && <p className="text-sm text-muted-foreground">No receipts submitted yet.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organization subscriptions</CardTitle>
          <CardDescription>Trial, grace, active, and deletion-scheduled organizations.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {overview.subscriptions.map((subscription) => (
            <div key={subscription.id} className="rounded-lg border bg-secondary/25 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <Link
                    href={routes.superiorAdmin.organization(subscription.company_id)}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {subscription.companyName}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {subscription.companySlug} - {subscription.planName ?? "No plan"} - {subscription.status.replaceAll("_", " ")}
                  </p>
                </div>
                <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3 lg:min-w-[36rem]">
                  <span>Trial: {dateLabel(subscription.trial_ends_at)}</span>
                  <span>Grace: {dateLabel(subscription.grace_ends_at)}</span>
                  <span>Renewal: {dateLabel(subscription.current_period_end)}</span>
                </div>
              </div>
            </div>
          ))}
          {!overview.subscriptions.length && <p className="text-sm text-muted-foreground">No subscriptions found.</p>}
        </CardContent>
      </Card>
    </section>
  );
}
