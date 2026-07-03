import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import {
  resetUserPasswordAction,
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
import { getClients } from "@/lib/clients/queries";
import { PageMessage } from "@/components/admin/page-message";
import { FilterPanel } from "@/components/dashboard/filter-panel";
import { FormSheet } from "@/components/dashboard/form-sheet";
import { PageActions, PageHeader } from "@/components/dashboard/page-header";
import { RoleAwareUserCreateForm } from "@/components/admin/role-aware-user-create-form";
import { UserTerminationControls } from "@/components/admin/user-termination-controls";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { normalizeRoleName } from "@/types/roles";

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
  const [users, roles, teams, clients] = await Promise.all([
    getCompanyUsers(context, { search: params.q, status: params.status }),
    getCompanyRoles(context),
    getCompanyTeams(context),
    getClients(context),
  ]);
  const accountManagers = users
    .filter((user) => normalizeRoleName(user.roleName) === "supervisor")
    .map((user) => ({
      id: user.id,
      displayName: `${user.first_name} ${user.last_name}`.trim() || user.email,
      status: user.status,
    }));

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="User management"
        description="Manage company users, account status, agency role assignment, and team membership."
        actions={
          <PageActions>
            <FormSheet
              title="Create user"
              description="Create a company-scoped account. Client-role users can also create the linked client profile from this flow."
              triggerLabel="Create user"
            >
              <RoleAwareUserCreateForm roles={roles} teams={teams} clients={clients} accountManagers={accountManagers} />
            </FormSheet>
            <FilterPanel
              description="Search by name or email and filter by account status."
              activeFilters={[
                { label: "Search", value: params.q },
                { label: "Status", value: params.status },
              ]}
            >
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
              <Button type="submit" className="w-fit">
                Apply
              </Button>
            </div>
          </form>
            </FilterPanel>
          </PageActions>
        }
      />

      <PageMessage error={params.error} status={params.notice} />

      <Card>
        <CardHeader>
          <CardTitle>Company users</CardTitle>
          <CardDescription>{users.length} users found in this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 lg:hidden">
            {users.map((user) => (
              <div key={user.id} className="rounded-xl border bg-secondary/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{user.first_name} {user.last_name}</p>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
                </div>
                <details className="mt-4 rounded-lg border bg-background/60 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-primary">Manage user</summary>
                <div className="mt-3 grid gap-3">
                  <Link href={`/users/${user.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Open profile and assignments
                  </Link>
                  <form action={updateUserRoleAction} className="grid gap-2">
                    <input type="hidden" name="userId" value={user.id} />
                    <Label htmlFor={`mobile-role-${user.id}`}>Role</Label>
                    <div className="flex gap-2">
                      <select
                        id={`mobile-role-${user.id}`}
                        name="roleId"
                        defaultValue={user.role_id ?? ""}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm"
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {getRoleDisplayName(role.name)}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" variant="outline" size="sm">Save</Button>
                    </div>
                  </form>
                  <form action={updateUserTeamAction} className="grid gap-2">
                    <input type="hidden" name="userId" value={user.id} />
                    <Label htmlFor={`mobile-team-${user.id}`}>Team</Label>
                    <div className="flex gap-2">
                      <select
                        id={`mobile-team-${user.id}`}
                        name="teamId"
                        defaultValue={user.teamId ?? ""}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm"
                      >
                        <option value="">No team</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" variant="outline" size="sm">Save</Button>
                    </div>
                  </form>
                  <form action={updateUserStatusAction} className="grid gap-2">
                    <input type="hidden" name="userId" value={user.id} />
                    <Label htmlFor={`mobile-status-${user.id}`}>Status</Label>
                    <div className="flex gap-2">
                      <select
                        id={`mobile-status-${user.id}`}
                        name="status"
                        defaultValue={user.status === "invited" ? "active" : user.status}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-sm"
                      >
                        {userStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" size="sm">Update</Button>
                    </div>
                  </form>
                  <UserTerminationControls
                    userId={user.id}
                    userName={`${user.first_name} ${user.last_name}`.trim() || user.email}
                    disabled={user.id === context.userId}
                  />
                  {context.role === "admin" && (
                    <FormSheet
                      title="Reset user password"
                      description="Set a temporary password. The user must change it on their next sign-in."
                      triggerLabel="Reset password"
                    >
                      <form action={resetUserPasswordAction} className="grid gap-4">
                        <input type="hidden" name="userId" value={user.id} />
                        <div className="rounded-lg border bg-secondary/30 p-3 text-sm">
                          Reset password for <span className="font-medium">{user.email}</span>. Share the temporary password securely outside Contento.
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`mobile-temp-${user.id}`}>Temporary password</Label>
                          <Input id={`mobile-temp-${user.id}`} name="temporaryPassword" type="password" autoComplete="new-password" required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`mobile-confirm-temp-${user.id}`}>Confirm temporary password</Label>
                          <Input id={`mobile-confirm-temp-${user.id}`} name="confirmTemporaryPassword" type="password" autoComplete="new-password" required />
                        </div>
                        <Button type="submit" variant="destructive" disabled={user.id === context.userId}>
                          Reset password
                        </Button>
                      </form>
                    </FormSheet>
                  )}
                </div>
                </details>
              </div>
            ))}
            {!users.length && (
              <div className="rounded-xl border border-dashed px-3 py-10 text-center text-muted-foreground">
                No company users match the current filters.
              </div>
            )}
          </div>
          <div className="hidden overflow-x-auto lg:block">
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
                      <span className="font-medium">{getRoleDisplayName(user.roleName)}</span>
                    </td>
                    <td className="border-b px-3 py-4">
                      {user.teamName ?? "No team"}
                    </td>
                    <td className="border-b px-3 py-4">
                      <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
                    </td>
                    <td className="border-b px-3 py-4">
                      <details className="rounded-lg border bg-secondary/20 p-3">
                        <summary className="cursor-pointer text-sm font-medium text-primary">Manage user</summary>
                      <div className="mt-3 grid gap-3">
                        <Link href={`/users/${user.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                          Open profile and assignments
                        </Link>
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
                          <Button type="submit" variant="outline" size="sm">Save role</Button>
                        </form>
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
                          <Button type="submit" variant="outline" size="sm">Save team</Button>
                        </form>
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
                        {context.role === "admin" && (
                          <FormSheet
                            title="Reset user password"
                            description="Set a temporary password. The user must change it on their next sign-in."
                            triggerLabel="Reset password"
                          >
                            <form action={resetUserPasswordAction} className="grid gap-4">
                              <input type="hidden" name="userId" value={user.id} />
                              <div className="rounded-lg border bg-secondary/30 p-3 text-sm">
                                Reset password for <span className="font-medium">{user.email}</span>. Share the temporary password securely outside Contento.
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`temp-${user.id}`}>Temporary password</Label>
                                <Input id={`temp-${user.id}`} name="temporaryPassword" type="password" autoComplete="new-password" required />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`confirm-temp-${user.id}`}>Confirm temporary password</Label>
                                <Input id={`confirm-temp-${user.id}`} name="confirmTemporaryPassword" type="password" autoComplete="new-password" required />
                              </div>
                              <Button type="submit" variant="destructive" disabled={user.id === context.userId}>
                                Reset password
                              </Button>
                            </form>
                          </FormSheet>
                        )}
                      </div>
                      </details>
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
