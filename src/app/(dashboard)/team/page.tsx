import type { Metadata } from "next";
import { BriefcaseBusiness, UsersRound } from "lucide-react";

import { requirePermission } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import { updateTeamMembersAction } from "@/lib/workflows/actions";
import { getWorkflowTeams, getWorkflowUsers } from "@/lib/workflows/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = {
  title: "Team",
};

export default async function TeamPage() {
  const context = await requirePermission("teams.view_roster", "view");
  const [teams, users] = await Promise.all([getWorkflowTeams(context), getWorkflowUsers(context)]);
  const activeUsers = users.filter((user) => user.status === "active");
  const canManageMembers = hasPermission(context, "teams.assign_members", "limited");

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Team workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Team</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Review scoped teams, rosters, leads, and workload signals for your current role.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{teams.length}</CardTitle>
            <CardDescription>Visible teams</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{teams.reduce((total, team) => total + team.memberCount, 0)}</CardTitle>
            <CardDescription>Visible members</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{teams.reduce((total, team) => total + team.openTaskCount, 0)}</CardTitle>
            <CardDescription>Open tasks</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4">
        {teams.map((team) => (
          <Card key={team.id}>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>{team.name}</CardTitle>
                  <CardDescription>{team.description || "No description provided."}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={team.status === "active" ? "default" : "secondary"}>{team.status}</Badge>
                  <Badge variant="secondary">{team.openTaskCount} open tasks</Badge>
                  <Badge variant="secondary">{team.activeContentCount} active content</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-secondary/30 p-3">
                  <p className="text-muted-foreground">Lead</p>
                  <p className="font-medium">{team.leadName ?? "No lead assigned"}</p>
                </div>
                <div className="rounded-lg border bg-secondary/30 p-3">
                  <p className="text-muted-foreground">Members</p>
                  <p className="font-medium">{team.memberCount}</p>
                </div>
                <div className="rounded-lg border bg-secondary/30 p-3">
                  <p className="text-muted-foreground">Open tasks</p>
                  <p className="font-medium">{team.openTaskCount}</p>
                </div>
                <div className="rounded-lg border bg-secondary/30 p-3">
                  <p className="text-muted-foreground">Active content</p>
                  <p className="font-medium">{team.activeContentCount}</p>
                </div>
              </div>

              <div className="grid gap-2">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <UsersRound className="size-4 text-primary" />
                  Roster
                </p>
                {team.members.length ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {team.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3 text-sm">
                        <div>
                          <p className="font-medium">{member.displayName}</p>
                          <p className="text-muted-foreground">{member.email}</p>
                        </div>
                        <Badge variant="outline">{member.roleName}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    <BriefcaseBusiness className="mx-auto mb-3 size-8 text-primary" />
                    No members are assigned to this team yet.
                  </div>
                )}
              </div>

              {canManageMembers && (
                <form action={updateTeamMembersAction} className="grid gap-3 rounded-lg border bg-secondary/25 p-3">
                  <input type="hidden" name="teamId" value={team.id} />
                  <input type="hidden" name="redirectTo" value="/team" />
                  <Label htmlFor={`members-${team.id}`}>Assign members</Label>
                  <select
                    id={`members-${team.id}`}
                    name="memberIds"
                    multiple
                    defaultValue={team.members.map((member) => member.id)}
                    className="min-h-32 rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {activeUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.displayName} - {user.roleName}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="outline" className="w-fit">Save members</Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}

        {!teams.length && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <UsersRound className="mx-auto mb-3 size-8 text-primary" />
              No teams are visible for your current scope.
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
