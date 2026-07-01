import Link from "next/link";
import type { Metadata } from "next";
import { Activity, Building2, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { getPlatformOverview } from "@/lib/super-admin/queries";
import { formatCairoDateTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Platform Dashboard",
};

export default async function SuperAdminPage() {
  const overview = await getPlatformOverview();

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Platform</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Platform Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Monitor organization lifecycle, platform activity, and tenant readiness without joining workspaces.
          </p>
        </div>
        <Link href={routes.superiorAdmin.organizations} className={buttonVariants()}>
          <Building2 />
          Manage organizations
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="size-4 text-primary" />
              Organizations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{overview.totals.organizations}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {overview.totals.active} active, {overview.totals.disabled} disabled
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <UsersRound className="size-4 text-primary" />
              Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{overview.totals.users}</p>
            <p className="mt-1 text-sm text-muted-foreground">{overview.totals.teams} teams across all organizations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Activity className="size-4 text-primary" />
              Lifecycle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{overview.totals.deleted}</p>
            <p className="mt-1 text-sm text-muted-foreground">soft-deleted or archived organizations</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent platform activity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {overview.activity.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-lg border bg-secondary/30 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{item.action}</p>
                <p className="text-sm text-muted-foreground">{item.adminEmail ?? "Platform admin"}</p>
              </div>
              <Badge variant="secondary">{formatCairoDateTime(item.created_at)}</Badge>
            </div>
          ))}
          {!overview.activity.length && (
            <p className="rounded-lg border bg-secondary/30 p-4 text-sm text-muted-foreground">
              No platform lifecycle activity has been recorded yet.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
