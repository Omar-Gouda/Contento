import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Download, ExternalLink, Filter, ReceiptText, ShieldAlert, XCircle } from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { PageActions, PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { manuallyActivateSubscriptionAction } from "@/lib/super-admin/platform-actions";
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
  searchParams: Promise<{ error?: string; notice?: string; status?: string; org?: string; from?: string; to?: string }>;
}) {
  const [overview, params] = await Promise.all([getSuperAdminBillingOverview(), searchParams]);
  const expiredGraceCount = overview.subscriptions.filter((subscription) => (
    subscription.status === "grace_period" &&
    subscription.grace_ends_at &&
    new Date(subscription.grace_ends_at) <= new Date()
  )).length;
  const filteredReceipts = overview.receipts.filter((receipt) => {
    const matchesStatus = params.status ? receipt.status === params.status : true;
    const matchesOrg = params.org ? receipt.companyName.toLowerCase().includes(params.org.toLowerCase()) : true;
    const created = new Date(receipt.created_at).getTime();
    const from = params.from ? new Date(params.from).getTime() : null;
    const to = params.to ? new Date(params.to).getTime() + 86_399_999 : null;

    return matchesStatus && matchesOrg && (from === null || created >= from) && (to === null || created <= to);
  });

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Billing Management"
        description="Review manual InstaPay receipts, activate subscriptions, and manage trial/grace lifecycles."
        actions={(
          <PageActions>
            <Link href="/super-admin/billing/export" className={buttonVariants({ variant: "outline" })}>
              <Download />
              Export CSV
            </Link>
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
          </PageActions>
        )}
      />

      <PageMessage error={params.error} status={params.notice} />

      <div className="grid gap-4 md:grid-cols-4">
        {(["pending", "approved", "rejected"] as const).map((status) => (
          <Card key={status}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm capitalize">{status} receipts</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {overview.receipts.filter((receipt) => receipt.status === status).length}
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active subscriptions</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {overview.subscriptions.filter((subscription) => subscription.status === "active").length}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="size-4 text-primary" />
            Filters
          </CardTitle>
          <CardDescription>Filter receipt review by organization, status, and submission date.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_10rem_10rem_10rem_auto]">
            <Input name="org" placeholder="Organization" defaultValue={params.org ?? ""} />
            <select name="status" defaultValue={params.status ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <Input name="from" type="date" defaultValue={params.from ?? ""} aria-label="From date" />
            <Input name="to" type="date" defaultValue={params.to ?? ""} aria-label="To date" />
            <Button type="submit" variant="outline">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Receipt review queue</CardTitle>
          <CardDescription>Approve to activate a subscription. Reject with a clear reason for the Marketing Manager.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {filteredReceipts.map((receipt) => (
            <div key={receipt.id} className="rounded-xl border bg-secondary/25 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={routes.superiorAdmin.organization(receipt.company_id)} className="font-semibold hover:underline">
                      {receipt.companyName}
                    </Link>
                    <Badge variant={receipt.status === "rejected" ? "destructive" : receipt.status === "approved" ? "default" : "secondary"}>
                      {receipt.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {receipt.planName ?? "Unknown plan"} - {receipt.duration_years} year{receipt.duration_years === 1 ? "" : "s"} - {formatEgp(receipt.amount_egp)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Submitted by {receipt.submittedByEmail ?? "unknown"} on {formatCairoDateTime(receipt.created_at)}
                  </p>
                  {receipt.signedUrl && (
                    <Link href={receipt.signedUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-4">
                      View receipt
                      <ExternalLink className="size-3.5" />
                    </Link>
                  )}
                  {receipt.rejection_reason && <p className="mt-2 text-sm text-destructive">{receipt.rejection_reason}</p>}
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
          {!filteredReceipts.length && <p className="text-sm text-muted-foreground">No receipts match these filters.</p>}
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
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <Link href={routes.superiorAdmin.organization(subscription.company_id)} className="font-medium underline-offset-4 hover:underline">
                    {subscription.companyName}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {subscription.companySlug} - {subscription.planName ?? "No plan"} - {subscription.status.replaceAll("_", " ")}
                  </p>
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3 lg:min-w-[36rem]">
                    <span>Trial: {dateLabel(subscription.trial_ends_at)}</span>
                    <span>Grace: {dateLabel(subscription.grace_ends_at)}</span>
                    <span>Renewal: {dateLabel(subscription.current_period_end)}</span>
                  </div>
                </div>
                {subscription.status !== "active" && subscription.plan_id && (
                  <form action={manuallyActivateSubscriptionAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="organizationId" value={subscription.company_id} />
                    <input type="hidden" name="subscriptionId" value={subscription.id} />
                    <input type="hidden" name="planId" value={subscription.plan_id} />
                    <input type="hidden" name="durationYears" value={subscription.duration_years} />
                    <input type="hidden" name="redirectTo" value="/super-admin/billing" />
                    <Button type="submit" variant="outline">Manually activate</Button>
                  </form>
                )}
              </div>
            </div>
          ))}
          {!overview.subscriptions.length && <p className="text-sm text-muted-foreground">No subscriptions found.</p>}
        </CardContent>
      </Card>
    </section>
  );
}
