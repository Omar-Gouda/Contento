"use client";

import { useMemo, useState } from "react";
import { UserPlus } from "lucide-react";

import { createCompanyUserAction } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRoleDisplayName, normalizeRoleName, type UserRole } from "@/types/roles";

type RoleOption = {
  id: string;
  name: string;
};

type TeamOption = {
  id: string;
  name: string;
};

type ClientOption = {
  id: string;
  name: string;
  status: string;
};

type AccountManagerOption = {
  id: string;
  displayName: string;
  status: string;
};

const userStatuses = ["active", "suspended", "disabled"] as const;
const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function roleNeedsClients(role: UserRole | null) {
  return role === "supervisor" || role === "creator" || role === "graphic-designer" || role === "video-editor";
}

function roleNeedsTeam(role: UserRole | null) {
  return role === "team-lead" || role === "creator" || role === "graphic-designer" || role === "video-editor";
}

function clientLabel(role: UserRole | null) {
  if (role === "client") {
    return "Linked client profile";
  }

  if (role === "supervisor") {
    return "Assigned clients";
  }

  if (role === "graphic-designer") {
    return "Design client scope";
  }

  if (role === "video-editor") {
    return "Video client scope";
  }

  return "Production client scope";
}

export function RoleAwareUserCreateForm({
  roles,
  teams,
  clients,
  accountManagers,
}: {
  roles: RoleOption[];
  teams: TeamOption[];
  clients: ClientOption[];
  accountManagers: AccountManagerOption[];
}) {
  const roleById = useMemo(() => new Map(roles.map((role) => [role.id, normalizeRoleName(role.name)])), [roles]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const selectedRole = roleById.get(selectedRoleId) ?? null;
  const showTeam = roleNeedsTeam(selectedRole);
  const showClients = roleNeedsClients(selectedRole);
  const isClientRole = selectedRole === "client";
  const activeClients = clients.filter((client) => client.status === "active");
  const activeAccountManagers = accountManagers.filter((user) => user.status === "active");

  return (
    <form action={createCompanyUserAction} className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Account access</CardTitle>
          <CardDescription>
            {isClientRole
              ? "This will create a client login and a client profile."
              : "Create a workspace user with temporary password access."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="email">{isClientRole ? "Login email" : "Email"}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="firstName">{isClientRole ? "Client contact first name" : "First name"}</Label>
            <Input id="firstName" name="firstName" autoComplete="given-name" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">{isClientRole ? "Client contact last name" : "Last name"}</Label>
            <Input id="lastName" name="lastName" autoComplete="family-name" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="temporaryPassword">Temporary password</Label>
            <Input id="temporaryPassword" name="temporaryPassword" type="password" autoComplete="new-password" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmTemporaryPassword">Confirm temporary password</Label>
            <Input id="confirmTemporaryPassword" name="confirmTemporaryPassword" type="password" autoComplete="new-password" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newUserStatus">Status</Label>
            <select id="newUserStatus" name="status" defaultValue="active" className={selectClass}>
              {userStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role details</CardTitle>
          <CardDescription>Fields below change based on the selected role.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="roleId">Role</Label>
            <select
              id="roleId"
              name="roleId"
              required
              value={selectedRoleId}
              onChange={(event) => setSelectedRoleId(event.target.value)}
              className={selectClass}
            >
              <option value="">Choose role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {getRoleDisplayName(role.name)}
                </option>
              ))}
            </select>
          </div>

          {showTeam && (
            <div className="space-y-2">
              <Label htmlFor="teamId">Assigned team</Label>
              <select id="teamId" name="teamId" className={selectClass}>
                <option value="">No team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showClients && (
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="clientIds">{clientLabel(selectedRole)}</Label>
              <select
                id="clientIds"
                name="clientIds"
                multiple
                className="min-h-28 w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {activeClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {isClientRole && (
        <Card>
          <CardHeader>
            <CardTitle>Client profile details</CardTitle>
            <CardDescription>This client profile will be linked to the login account above.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="clientName">Client/company name</Label>
              <Input id="clientName" name="clientName" required={isClientRole} />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="clientLogoUrl">Client logo URL</Label>
              <Input id="clientLogoUrl" name="clientLogoUrl" type="url" placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientPrimaryColor">Brand primary color</Label>
              <Input id="clientPrimaryColor" name="clientPrimaryColor" placeholder="#2563eb" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientSecondaryColor">Brand secondary color</Label>
              <Input id="clientSecondaryColor" name="clientSecondaryColor" placeholder="#0f172a" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientContactPhone">Contact phone</Label>
              <Input id="clientContactPhone" name="clientContactPhone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignedAccountManagerId">Assigned Account Manager</Label>
              <select id="assignedAccountManagerId" name="assignedAccountManagerId" className={selectClass}>
                <option value="">No account manager</option>
                {activeAccountManagers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="clientBriefDriveLink">Brief Drive link</Label>
              <Input id="clientBriefDriveLink" name="clientBriefDriveLink" type="url" />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="clientNotes">Notes</Label>
              <textarea
                id="clientNotes"
                name="clientNotes"
                className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <Button type="submit">
          <UserPlus />
          Create user
        </Button>
      </div>
    </form>
  );
}
