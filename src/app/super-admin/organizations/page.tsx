import type { Metadata } from "next";
import Link from "next/link";
import { Building2, UserPlus } from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";
import { createOrganizationAction } from "@/lib/super-admin/actions";
import { getPlatformOrganizations } from "@/lib/super-admin/queries";
import { formatCairoDateTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Organizations",
};

export default async function SuperAdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const organizations = await getPlatformOrganizations();

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Super Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Organizations</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Create workspaces, inspect tenant health, and manage organization lifecycle.
        </p>
      </div>

      <PageMessage
        error={params.error}
        status={params.notice === "created" ? "Organization and Admin account created." : undefined}
      />

      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>View tenant health, owner, and lifecycle status.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {organizations.map((organization) => (
            <div key={organization.id} className="grid gap-3 rounded-lg border bg-secondary/30 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{organization.name}</h2>
                  <Badge variant={organization.status === "active" ? "default" : "secondary"}>{organization.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {organization.slug} · owner {organization.ownerEmail ?? "unassigned"} · created {formatCairoDateTime(organization.created_at)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {organization.userCount} users · {organization.teamCount} teams · {organization.activityCount} activity events
                </p>
              </div>
              <Link href={routes.superiorAdmin.organization(organization.id)} className="text-sm font-medium text-primary hover:underline">
                Open details
              </Link>
            </div>
          ))}
          {!organizations.length && (
            <p className="rounded-lg border bg-secondary/30 p-4 text-sm text-muted-foreground">
              No organizations have been created yet.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organization setup</CardTitle>
          <CardDescription>
            The platform admin is not added to the organization. The created admin becomes the workspace owner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createOrganizationAction} className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">Organization name</Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="companyName" name="companyName" className="pl-9" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companySlug">Organization slug</Label>
              <Input id="companySlug" name="companySlug" placeholder="acme-studio" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminFirstName">Admin first name</Label>
              <Input id="adminFirstName" name="adminFirstName" autoComplete="given-name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminLastName">Admin last name</Label>
              <Input id="adminLastName" name="adminLastName" autoComplete="family-name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminEmail">Admin email</Label>
              <Input id="adminEmail" name="adminEmail" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminPassword">Admin temporary password</Label>
              <Input id="adminPassword" name="adminPassword" type="password" autoComplete="new-password" required />
            </div>
            <div className="lg:col-span-2">
              <Button type="submit">
                <UserPlus />
                Create organization and Admin
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
