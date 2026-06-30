import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";

import { saveClientAction } from "@/lib/clients/actions";
import { getClientAssignableUsers, getClients } from "@/lib/clients/queries";
import { requirePermission } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import { PageMessage } from "@/components/admin/page-message";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";
import { getRoleDisplayName } from "@/types/roles";

export const metadata: Metadata = {
  title: "Clients",
};

const statusOptions = ["active", "paused", "archived"] as const;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("clients.view", "view");
  const [clients, users] = await Promise.all([
    getClients(context, { search: params.q, status: params.status }),
    getClientAssignableUsers(context),
  ]);
  const canManage = hasPermission(context, "clients.manage", "limited");

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Clients</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Client workspace</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Manage client profiles, briefs, brand colors, contacts, and the people assigned to each account.
          </p>
        </div>
        <Link href={routes.dashboards.admin} className={buttonVariants({ variant: "outline" })}>
          <Building2 />
          Open manager dashboard
        </Link>
      </div>

      <PageMessage error={params.error} status={params.notice} />

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Create client</CardTitle>
            <CardDescription>Set up a new client workspace with its own brief, palette, and account owner.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveClientAction} className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="name">Client name</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" placeholder="auto-generated if empty" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignedAccountManagerId">Account manager</Label>
                <select id="assignedAccountManagerId" name="assignedAccountManagerId" className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
                  <option value="">None</option>
                  {users
                    .filter((user) => ["supervisor", "team-lead", "admin"].includes(user.roleKey ?? ""))
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.displayName} - {getRoleDisplayName(user.roleName)}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPerson">Contact person</Label>
                <Input id="contactPerson" name="contactPerson" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact email</Label>
                <Input id="contactEmail" name="contactEmail" type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact phone</Label>
                <Input id="contactPhone" name="contactPhone" />
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input id="logoUrl" name="logoUrl" type="url" placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary color</Label>
                <Input id="primaryColor" name="primaryColor" placeholder="#2563eb" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Secondary color</Label>
                <Input id="secondaryColor" name="secondaryColor" placeholder="#0f172a" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accentColor">Accent color</Label>
                <Input id="accentColor" name="accentColor" placeholder="#f97316" />
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label htmlFor="briefDriveLink">Brief Drive link</Label>
                <Input id="briefDriveLink" name="briefDriveLink" type="url" />
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label htmlFor="requirements">Brief / requirements</Label>
                <textarea id="requirements" name="requirements" className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label htmlFor="notes">Internal notes</Label>
                <textarea id="notes" name="notes" className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select id="status" name="status" defaultValue="active" className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm">
                  {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div className="lg:col-span-3 space-y-3">
                <Label>Assigned users</Label>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {users.map((user) => (
                    <label key={user.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                      <input type="checkbox" name="assignedUserIds" value={user.id} className="mt-1 size-4 rounded border-input" />
                      <span className="min-w-0">
                        <span className="block font-medium">{user.displayName}</span>
                        <span className="block text-muted-foreground">{getRoleDisplayName(user.roleName)}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-3">
                <Button type="submit">
                  <Plus />
                  Save client
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Client list</CardTitle>
          <CardDescription>{clients.length} client profiles in this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 xl:grid-cols-2">
            {clients.map((client) => (
              <Card key={client.id} className="border-muted/60">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{client.name}</CardTitle>
                      <CardDescription>{client.slug || "No slug yet"}</CardDescription>
                    </div>
                    <Badge>{client.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm">
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground">Account manager</p>
                      <p className="font-medium">{client.accountManagerName ?? "Unassigned"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Contact</p>
                      <p className="font-medium">{client.contact_person || client.contact_email || "Not set"}</p>
                    </div>
                  </div>
                  <p className="line-clamp-3 text-muted-foreground">{client.requirements || client.notes || "No brief yet."}</p>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">{client.assignedUsers.length} assigned users</p>
                    <Link href={routes.clients.detail(client.id)} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                      Open client
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!clients.length && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No clients have been created yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
