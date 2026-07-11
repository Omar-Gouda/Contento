import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Building2,
  Clock,
  CreditCard,
  Eye,
  Power,
  ShieldOff,
  ShieldX,
  Trash2,
  UsersRound,
} from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { FormSheet } from "@/components/dashboard/form-sheet";
import { PageActions, PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEgp } from "@/lib/billing/constants";
import {
  changeOrganizationPlanAction,
  extendOrganizationSubscriptionAction,
  manuallyActivateSubscriptionAction,
  markOrganizationReadOnlyAction,
  processScheduledDeletionAction,
} from "@/lib/super-admin/platform-actions";
import { hardDeleteOrganizationAction } from "@/lib/super-admin/actions";
import { updateOrganizationLifecycleAction } from "@/lib/super-admin/lifecycle";
import { getOrganizationControlCenter } from "@/lib/super-admin/platform-control";
import { formatCairoDateTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Organization control center",
};

function dateLabel(value: string | null | undefined) {
  return value ? formatCairoDateTime(value) : "Not set";
}

function bytesLabel(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function LifecycleButton({
  organizationId,
  status,
  label,
  icon,
  variant = "outline",
}: {
  organizationId: string;
  status: string;
  label: string;
  icon: ReactNode;
  variant?: "default" | "destructive" | "outline";
}) {
  return (
    <form action={updateOrganizationLifecycleAction}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant={variant}>
        {icon}
        {label}
      </Button>
    </form>
  );
}

function DangerZone({
  organization,
}: {
  organization: Awaited<ReturnType<typeof getOrganizationControlCenter>>;
}) {
  const counts = organization.hardDeletePreview;
  const countRows = [
    ["Users", counts.users],
    ["Clients", counts.clients],
    ["Teams", counts.teams],
    ["Tasks", counts.tasks],
    ["Ideas", counts.ideas],
    ["Content", counts.content],
    ["Reports", counts.reports],
    ["Calendar/time off", counts.calendarItems],
    ["Notifications", counts.notifications],
    ["Chat messages", counts.chatMessages],
    ["Tracked files", counts.files],
  ];

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-4" />
          Danger zone
        </CardTitle>
        <CardDescription>
          Process scheduled deletion or permanently hard-delete after typed confirmation.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {organization.subscription?.status === "scheduled_deletion" && (
          <form action={processScheduledDeletionAction}>
            <input type="hidden" name="organizationId" value={organization.id} />
            <Button type="submit" variant="destructive">
              <ShieldX />
              Process scheduled deletion
            </Button>
          </form>
        )}
        <p className="text-sm leading-6 text-muted-foreground">
          Permanent deletion removes the organization, users, clients, work, chat, notifications, files, and related records.
          This cannot be undone.
        </p>
        <FormSheet
          title="Delete organization permanently"
          description={`Type ${organization.slug} or the exact organization name to confirm permanent deletion.`}
          triggerLabel="Delete organization permanently"
          triggerIcon={<Trash2 />}
          triggerClassName="border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
        >
          <form action={hardDeleteOrganizationAction} className="grid gap-5">
            <input type="hidden" name="organizationId" value={organization.id} />
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm leading-6 text-destructive">
              This permanently deletes all organization data and auth users. This cannot be undone.
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {countRows.map(([label, value]) => (
                <div key={label} className="rounded-lg border bg-secondary/30 p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="organization-delete-confirmation">Confirm slug or name</Label>
              <Input id="organization-delete-confirmation" name="confirmation" placeholder={organization.slug} autoComplete="off" required />
            </div>
            <Button type="submit" variant="destructive">
              <Trash2 />
              Delete organization permanently
            </Button>
          </form>
        </FormSheet>
      </CardContent>
    </Card>
  );
}

export default async function SuperAdminOrganizationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string; observer?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  let organization;

  try {
    organization = await getOrganizationControlCenter(id);
  } catch {
    notFound();
  }

  const observerMode = query.observer === "1";

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow={observerMode ? "Observer mode" : "Organization Control Center"}
        title={organization.name}
        description={`${organization.slug} - owner ${organization.ownerEmail ?? "unassigned"} - created ${formatCairoDateTime(organization.created_at)}`}
        actions={(
          <PageActions>
            {observerMode ? (
              <Link href={`/super-admin/organizations/${organization.id}`} className={buttonVariants({ variant: "outline" })}>
                Exit observer mode
              </Link>
            ) : (
              <Link href={`/super-admin/organizations/${organization.id}?observer=1`} className={buttonVariants({ variant: "outline" })}>
                <Eye />
                View organization
              </Link>
            )}
            {!observerMode && organization.status !== "active" && (
              <LifecycleButton organizationId={organization.id} status="active" label="Reactivate" icon={<Power />} />
            )}
            {!observerMode && organization.status === "active" && (
              <LifecycleButton organizationId={organization.id} status="disabled" label="Disable" icon={<ShieldOff />} />
            )}
          </PageActions>
        )}
      />

      {observerMode && (
        <Card className="border-primary/30 bg-primary/10">
          <CardContent className="p-4">
            <p className="font-semibold">Observer mode</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You are reviewing this organization from the platform console. Write actions are hidden; no password impersonation or unsafe RLS bypass is used.
            </p>
          </CardContent>
        </Card>
      )}

      <PageMessage
        error={query.error}
        status={query.notice === "updated" ? "Organization lifecycle updated." : query.notice}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="size-4 text-primary" />
              Organization status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={organization.status === "active" ? "default" : "secondary"}>{organization.status}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CreditCard className="size-4 text-primary" />
              Subscription
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{organization.subscription?.status?.replaceAll("_", " ") ?? "No subscription"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{organization.plan?.name ?? "No plan"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <UsersRound className="size-4 text-primary" />
              Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{organization.userCount}</p>
            <p className="text-sm text-muted-foreground">{organization.clientCount} clients, {organization.teamCount} teams</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Activity className="size-4 text-primary" />
              Storage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{bytesLabel(organization.storageBytes)}</p>
            <p className="text-sm text-muted-foreground">tracked attachment usage</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Subscription control</CardTitle>
            <CardDescription>Plan, trial, grace, renewal, and read-only controls.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
              <p><span className="block text-xs uppercase text-muted-foreground">Plan</span>{organization.plan?.name ?? "No plan"}</p>
              <p><span className="block text-xs uppercase text-muted-foreground">Duration</span>{organization.subscription?.duration_years ?? 1} year(s)</p>
              <p><span className="block text-xs uppercase text-muted-foreground">Trial started</span>{dateLabel(organization.subscription?.trial_started_at)}</p>
              <p><span className="block text-xs uppercase text-muted-foreground">Trial ends</span>{dateLabel(organization.subscription?.trial_ends_at)}</p>
              <p><span className="block text-xs uppercase text-muted-foreground">Grace ends</span>{dateLabel(organization.subscription?.grace_ends_at)}</p>
              <p><span className="block text-xs uppercase text-muted-foreground">Renewal</span>{dateLabel(organization.subscription?.current_period_end)}</p>
            </div>

            {!observerMode && organization.subscription && (
              <div className="grid gap-3 rounded-xl border bg-secondary/25 p-4">
                <form action={extendOrganizationSubscriptionAction} className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input type="hidden" name="organizationId" value={organization.id} />
                  <input type="hidden" name="subscriptionId" value={organization.subscription.id} />
                  <Input name="days" type="number" min="1" max="730" defaultValue="30" aria-label="Extension days" />
                  <Button type="submit" variant="outline">
                    <Clock />
                    Extend
                  </Button>
                </form>
                <form action={changeOrganizationPlanAction} className="grid gap-3 md:grid-cols-[1fr_9rem_auto]">
                  <input type="hidden" name="organizationId" value={organization.id} />
                  <input type="hidden" name="subscriptionId" value={organization.subscription.id} />
                  <select name="planId" defaultValue={organization.plan?.id ?? ""} className="h-10 rounded-md border bg-background px-3 text-sm">
                    {organization.availablePlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>{plan.name} {plan.yearly_price_egp ? `- ${formatEgp(plan.yearly_price_egp)}/year` : "- custom"}</option>
                    ))}
                  </select>
                  <select name="durationYears" defaultValue={organization.subscription.duration_years} className="h-10 rounded-md border bg-background px-3 text-sm">
                    <option value="1">1 year</option>
                    <option value="5">5 years</option>
                    <option value="7">7 years</option>
                  </select>
                  <Button type="submit" variant="outline">Change plan</Button>
                </form>
                <div className="flex flex-wrap gap-2">
                  <form action={manuallyActivateSubscriptionAction}>
                    <input type="hidden" name="organizationId" value={organization.id} />
                    <input type="hidden" name="subscriptionId" value={organization.subscription.id} />
                    <input type="hidden" name="planId" value={organization.plan?.id ?? organization.availablePlans[0]?.id ?? ""} />
                    <input type="hidden" name="durationYears" value={organization.subscription.duration_years} />
                    <input type="hidden" name="redirectTo" value={`/super-admin/organizations/${organization.id}`} />
                    <Button type="submit">Manually activate</Button>
                  </form>
                  <form action={markOrganizationReadOnlyAction}>
                    <input type="hidden" name="organizationId" value={organization.id} />
                    <input type="hidden" name="subscriptionId" value={organization.subscription.id} />
                    <Button type="submit" variant="outline">Mark read-only</Button>
                  </form>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organization admins</CardTitle>
            <CardDescription>Active and historical Marketing Manager accounts.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {organization.admins.map((admin) => (
              <div key={admin.id} className="rounded-lg border bg-secondary/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{admin.name}</p>
                  <Badge variant={admin.status === "active" ? "default" : "secondary"}>{admin.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{admin.email}</p>
              </div>
            ))}
            {!organization.admins.length && <p className="text-sm text-muted-foreground">No admin profile found.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payment receipts</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {organization.paymentReceipts.map((receipt) => (
              <div key={receipt.id} className="rounded-lg border bg-secondary/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{formatEgp(receipt.amount_egp)}</p>
                  <Badge variant={receipt.status === "rejected" ? "destructive" : receipt.status === "approved" ? "default" : "secondary"}>{receipt.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{formatCairoDateTime(receipt.created_at)}</p>
              </div>
            ))}
            {!organization.paymentReceipts.length && <p className="text-sm text-muted-foreground">No payment receipts yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing events</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {organization.billingEvents.map((event) => (
              <div key={event.id} className="rounded-lg border bg-secondary/30 p-3">
                <p className="font-medium">{event.action}</p>
                <p className="mt-1 text-sm text-muted-foreground">{formatCairoDateTime(event.created_at)}</p>
              </div>
            ))}
            {!organization.billingEvents.length && <p className="text-sm text-muted-foreground">No billing events yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Latest tenant activity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {organization.recentActivity.map((item) => (
              <div key={item.id} className="rounded-lg border bg-secondary/30 p-3">
                <p className="font-medium">{item.action}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.userEmail ?? "System"} - {formatCairoDateTime(item.createdAt)}
                </p>
              </div>
            ))}
            {!organization.recentActivity.length && <p className="text-sm text-muted-foreground">No tenant activity yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform audit</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {organization.platformLogs.map((item) => (
              <div key={item.id} className="rounded-lg border bg-secondary/30 p-3">
                <p className="font-medium">{item.action}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.adminEmail ?? "Platform admin"} - {formatCairoDateTime(item.created_at)}
                </p>
              </div>
            ))}
            {!organization.platformLogs.length && <p className="text-sm text-muted-foreground">No platform audit logs for this organization yet.</p>}
          </CardContent>
        </Card>
      </div>

      {!observerMode && <DangerZone organization={organization} />}
    </section>
  );
}
