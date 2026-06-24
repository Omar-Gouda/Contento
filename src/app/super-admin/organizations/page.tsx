import type { Metadata } from "next";
import { Building2, UserPlus } from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrganizationAction } from "@/lib/super-admin/actions";

export const metadata: Metadata = {
  title: "Superior admin",
};

export default async function SuperiorAdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const params = await searchParams;

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Superior Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Create organization</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Create a company workspace and its first Organization Admin account.
        </p>
      </div>

      <PageMessage
        error={params.error}
        status={params.notice === "created" ? "Organization and Admin account created." : undefined}
      />

      <Card>
        <CardHeader>
          <CardTitle>Organization setup</CardTitle>
          <CardDescription>
            The superior admin is not added to the organization. The created admin becomes the workspace owner.
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
