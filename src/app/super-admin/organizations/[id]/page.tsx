import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Activity, AlertTriangle, Building2, Power, ShieldOff, Trash2, UsersRound } from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { FormSheet } from "@/components/dashboard/form-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hardDeleteOrganizationAction } from "@/lib/super-admin/actions";
import { updateOrganizationLifecycleAction } from "@/lib/super-admin/lifecycle";
import { getPlatformOrganizationDetail } from "@/lib/super-admin/queries";
import { formatCairoDateTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Organization details",
};

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
  organization: Awaited<ReturnType<typeof getPlatformOrganizationDetail>>;
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
          Permanent deletion is only available to active platform Super Admins.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm leading-6 text-muted-foreground">
          This permanently deletes the organization, users, clients, tasks, ideas, content, reports, chat, notifications, files, and related data.
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
              This permanently deletes the organization, users, clients, tasks, ideas, content, reports, chat, notifications, files, and related data.
              This cannot be undone.
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
              <Input
                id="organization-delete-confirmation"
                name="confirmation"
                placeholder={organization.slug}
                autoComplete="off"
                required
              />
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
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  let organization;

  try {
    organization = await getPlatformOrganizationDetail(id);
  } catch {
    notFound();
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Organization</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">{organization.name}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {organization.slug} · owner {organization.ownerEmail ?? "unassigned"} · created {formatCairoDateTime(organization.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {organization.status !== "active" && (
            <LifecycleButton organizationId={organization.id} status="active" label="Reactivate" icon={<Power />} />
          )}
          {organization.status === "active" && (
            <LifecycleButton organizationId={organization.id} status="disabled" label="Disable" icon={<ShieldOff />} />
          )}
          {organization.status !== "deleted" && (
            <LifecycleButton organizationId={organization.id} status="deleted" label="Soft-delete" icon={<Trash2 />} variant="destructive" />
          )}
        </div>
      </div>

      <PageMessage
        error={query.error}
        status={query.notice === "updated" ? "Organization lifecycle updated." : query.notice}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="size-4 text-primary" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={organization.status === "active" ? "default" : "secondary"}>{organization.status}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <UsersRound className="size-4 text-primary" />
              Users and teams
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{organization.userCount}</p>
            <p className="text-sm text-muted-foreground">{organization.teamCount} teams</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Activity className="size-4 text-primary" />
              Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{organization.activityCount}</p>
            <p className="text-sm text-muted-foreground">tenant audit entries</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organization admins</CardTitle>
            <CardDescription>Active and historical Org Admin accounts.</CardDescription>
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

        <Card>
          <CardHeader>
            <CardTitle>Recent tenant activity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {organization.recentActivity.map((item) => (
              <div key={item.id} className="rounded-lg border bg-secondary/30 p-3">
                <p className="font-medium">{item.action}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.userEmail ?? "System"} · {formatCairoDateTime(item.createdAt)}
                </p>
              </div>
            ))}
            {!organization.recentActivity.length && <p className="text-sm text-muted-foreground">No tenant activity yet.</p>}
          </CardContent>
        </Card>
      </div>

      <DangerZone organization={organization} />
    </section>
  );
}
