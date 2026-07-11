import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Ban,
  Building2,
  ClipboardCheck,
  CreditCard,
  MailWarning,
  ReceiptText,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageActions, PageHeader } from "@/components/dashboard/page-header";
import { routes } from "@/constants/routes";
import { formatEgp } from "@/lib/billing/constants";
import { getPlatformControlCenterDashboard } from "@/lib/super-admin/platform-control";
import { formatCairoDateTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Platform Control Center",
};

function MetricCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: string | number;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

export default async function SuperAdminPage() {
  const dashboard = await getPlatformControlCenterDashboard();
  const metrics = dashboard.metrics;

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Platform Control Center"
        description="Manage organizations, requests, billing, announcements, support, auditability, and system health from one Super Admin console."
        actions={(
          <PageActions>
            <Link href={routes.superiorAdmin.organizations} className={buttonVariants()}>
              <Building2 />
              Organizations
            </Link>
            <Link href={routes.superiorAdmin.billing} className={buttonVariants({ variant: "outline" })}>
              <CreditCard />
              Billing
            </Link>
          </PageActions>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard title="Total organizations" value={metrics.totalOrganizations} helper="All tenant workspaces" icon={<Building2 className="size-4 text-primary" />} />
        <MetricCard title="Active organizations" value={metrics.activeOrganizations} helper="Currently available workspaces" icon={<Activity className="size-4 text-primary" />} />
        <MetricCard title="Trial organizations" value={metrics.trialOrganizations} helper="Trial pending or active" icon={<ClipboardCheck className="size-4 text-primary" />} />
        <MetricCard title="Grace period" value={metrics.gracePeriodOrganizations} helper="Read-only renewal window" icon={<AlertTriangle className="size-4 text-primary" />} />
        <MetricCard title="Expired / scheduled" value={metrics.expiredOrScheduledOrganizations} helper="Deletion-review lifecycle" icon={<Ban className="size-4 text-destructive" />} />
        <MetricCard title="Pending org requests" value={metrics.pendingOrganizationRequests} helper="Demo conversion requests" icon={<MailWarning className="size-4 text-primary" />} />
        <MetricCard title="Pending receipts" value={metrics.pendingPaymentReceipts} helper="Manual InstaPay reviews" icon={<ReceiptText className="size-4 text-primary" />} />
        <MetricCard title="Active annual revenue" value={formatEgp(metrics.estimatedActiveAnnualRevenueEgp)} helper="Estimated from active plans" icon={<TrendingUp className="size-4 text-primary" />} />
        <MetricCard title="Trial blacklist" value={metrics.blacklistedTrialEmails} helper="Emails blocked from new trials" icon={<Ban className="size-4 text-primary" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Latest organization requests</CardTitle>
            <CardDescription>Recent demo conversion and onboarding requests.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {dashboard.latestRequests.map((request) => (
              <div key={request.id} className="rounded-xl border bg-secondary/25 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{request.organization_name}</p>
                  <Badge variant={request.status === "pending" ? "secondary" : "outline"}>{request.status.replaceAll("_", " ")}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {request.business_email} - {request.plan_code ?? "no plan"} - {request.amountLabel}
                </p>
              </div>
            ))}
            {!dashboard.latestRequests.length && <p className="text-sm text-muted-foreground">No organization requests yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest payment receipts</CardTitle>
            <CardDescription>Manual billing submissions across organizations.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {dashboard.latestReceipts.map((receipt) => (
              <div key={receipt.id} className="rounded-xl border bg-secondary/25 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{receipt.companyName}</p>
                  <Badge variant={receipt.status === "pending" ? "secondary" : receipt.status === "rejected" ? "destructive" : "default"}>
                    {receipt.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {receipt.planName ?? "Unknown plan"} - {formatEgp(receipt.amount_egp)} - {formatCairoDateTime(receipt.created_at)}
                </p>
              </div>
            ))}
            {!dashboard.latestReceipts.length && <p className="text-sm text-muted-foreground">No payment receipts yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest billing events</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {dashboard.latestBillingEvents.map((event) => (
              <div key={event.id} className="rounded-xl border bg-secondary/25 p-3">
                <p className="font-medium">{event.action}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {event.companyName} - {formatCairoDateTime(event.created_at)}
                </p>
              </div>
            ))}
            {!dashboard.latestBillingEvents.length && <p className="text-sm text-muted-foreground">No billing events yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest platform audit logs</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {dashboard.latestPlatformLogs.map((log) => (
              <div key={log.id} className="rounded-xl border bg-secondary/25 p-3">
                <p className="font-medium">{log.action}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {log.adminEmail ?? "Platform admin"} - {formatCairoDateTime(log.created_at)}
                </p>
              </div>
            ))}
            {!dashboard.latestPlatformLogs.length && <p className="text-sm text-muted-foreground">No platform audit logs yet.</p>}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
