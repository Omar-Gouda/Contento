import type { Metadata } from "next";
import { Search, UserPlus } from "lucide-react";

import {
  createCompanyUserAction,
  updateUserRoleAction,
  updateUserStatusAction,
  updateUserTeamAction,
} from "@/lib/admin/actions";
import {
  getCompanyRoles,
  getCompanyTeams,
  getCompanyUsers,
} from "@/lib/admin/queries";
import { requirePermission } from "@/lib/auth/context";
import { PageMessage } from "@/components/admin/page-message";
import { UserTerminationControls } from "@/components/admin/user-termination-controls";
import { Badge } from "@/components/ui/badge";
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
import { getRoleDisplayName } from "@/types/roles";

export const metadata: Metadata = {
  title: "User management",
};

const userStatuses = ["active", "suspended", "disabled"] as const;

function statusVariant(status: string) {
  if (status === "active") {
    return "default";
  }

  if (status === "suspended") {
    return "secondary";
  }

  return "destructive";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("users.view_activity", "full");
  const [users, roles, teams] = await Promise.all([
    getCompanyUsers(context, { search: params.q, status: params.status }),
    getCompanyRoles(context),
    getCompanyTeams(context),
  ]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">User management</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Manage company users, account status, agency role assignment, and team membership.
          </p>
        </div>
      </div>

      <PageMessage error={params.error} status={params.notice} />

      <Card>
        <CardHeader>
          <CardTitle>Create user</CardTitle>
          <CardDescription>Create a company-scoped account with a Contento role and status.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createCompanyUserAction} className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" name="firstName" autoComplete="given-name" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" autoComplete="family-name" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="roleId">Role</Label>
              <select
                id="roleId"
                name="roleId"
                required
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Choose role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {getRoleDisplayName(role.name)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="teamId">Team</Label>
              <select
                id="teamId"
                name="teamId"
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">No team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newUserStatus">Status</Label>
              <select
                id="newUserStatus"
                name="status"
                defaultValue="active"
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {userStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="temporaryPassword">Temporary password</Label>
              <Input
                id="temporaryPassword"
                name="temporaryPassword"
                type="password"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmTemporaryPassword">Confirm temporary password</Label>
              <Input
                id="confirmTemporaryPassword"
                name="confirmTemporaryPassword"
                type="password"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="flex items-end">
              <Button type="submit">
                <UserPlus />
                Create user
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search by name or email and filter by account status.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_180px_auto]" action="/admin/users">
            <div className="space-y-2">
              <Label htmlFor="q">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="q" name="q" defaultValue={params.q ?? ""} className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={params.status ?? "all"}
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="all">All statuses</option>
                {userStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full md:w-auto">
                Apply
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company users</CardTitle>
          <CardDescription>{users.length} users found in this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="border-b px-3 py-2 font-medium">User</th>
                  <th className="border-b px-3 py-2 font-medium">Role</th>
                  <th className="border-b px-3 py-2 font-medium">Team</th>
                  <th className="border-b px-3 py-2 font-medium">Status</th>
                  <th className="border-b px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="align-top">
                    <td className="border-b px-3 py-4">
                      <div className="font-medium">{user.first_name} {user.last_name}</div>
                      <div className="text-muted-foreground">{user.email}</div>
                    </td>
                    <td className="border-b px-3 py-4">
                      <form action={updateUserRoleAction} className="flex gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <select
                          name="roleId"
                          defaultValue={user.role_id ?? ""}
                          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                        >
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {getRoleDisplayName(role.name)}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" variant="outline" size="sm">Save</Button>
                      </form>
                    </td>
                    <td className="border-b px-3 py-4">
                      <form action={updateUserTeamAction} className="flex gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <select
                          name="teamId"
                          defaultValue={user.teamId ?? ""}
                          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                        >
                          <option value="">No team</option>
                          {teams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                        <Button type="submit" variant="outline" size="sm">Save</Button>
                      </form>
                    </td>
                    <td className="border-b px-3 py-4">
                      <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
                    </td>
                    <td className="border-b px-3 py-4">
                      <div className="flex flex-wrap gap-2">
                        <form action={updateUserStatusAction} className="flex gap-2">
                          <input type="hidden" name="userId" value={user.id} />
                          <select
                            name="status"
                            defaultValue={user.status === "invited" ? "active" : user.status}
                            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
                          >
                            {userStatuses.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <Button type="submit" size="sm">Update</Button>
                        </form>
                        <UserTerminationControls
                          userId={user.id}
                          userName={`${user.first_name} ${user.last_name}`.trim() || user.email}
                          disabled={user.id === context.userId}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {!users.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                      No company users match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
