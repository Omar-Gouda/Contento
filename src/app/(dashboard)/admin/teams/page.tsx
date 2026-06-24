import type { Metadata } from "next";
import { Archive, Save, Users } from "lucide-react";

import {
  archiveTeamAction,
  createTeamAction,
  updateTeamAction,
  updateTeamMembersAction,
} from "@/lib/workflows/actions";
import {
  getWorkflowTeams,
  getWorkflowUsers,
} from "@/lib/workflows/queries";
import { requirePermission } from "@/lib/auth/context";
import { PageMessage } from "@/components/admin/page-message";
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

export const metadata: Metadata = {
  title: "Teams",
};

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("teams.view_roster", "full");
  const [teams, users] = await Promise.all([
    getWorkflowTeams(context),
    getWorkflowUsers(context),
  ]);
  const activeUsers = users.filter((user) => user.status === "active");

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Teams</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Create teams, assign leads and members, and review workload signals inside this company.
          </p>
        </div>
      </div>

      <PageMessage error={params.error} status={params.notice} />

      <Card>
        <CardHeader>
          <CardTitle>Create team</CardTitle>
          <CardDescription>Teams keep task assignment, content ownership, and reports scoped.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createTeamAction} className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="name">Team name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamLeadId">Team lead</Label>
              <select id="teamLeadId" name="teamLeadId" className={selectClass}>
                <option value="">No lead yet</option>
                {activeUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName} - {user.roleName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full lg:w-auto">
                <Users />
                Create
              </Button>
            </div>
            <div className="space-y-2 lg:col-span-3">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" />
            </div>
          </form>
        </CardContent>
      </Card>

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
                  <Badge variant="secondary">{team.memberCount} members</Badge>
                  <Badge variant="secondary">{team.openTaskCount} open tasks</Badge>
                  <Badge variant="secondary">{team.activeContentCount} active content</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5">
              <form action={updateTeamAction} className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
                <input type="hidden" name="teamId" value={team.id} />
                <div className="space-y-2">
                  <Label htmlFor={`name-${team.id}`}>Name</Label>
                  <Input id={`name-${team.id}`} name="name" defaultValue={team.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`lead-${team.id}`}>Lead</Label>
                  <select id={`lead-${team.id}`} name="teamLeadId" defaultValue={team.team_lead_id ?? ""} className={selectClass}>
                    <option value="">No lead</option>
                    {activeUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.displayName} - {user.roleName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button type="submit" variant="outline" className="w-full lg:w-auto">
                    <Save />
                    Save
                  </Button>
                </div>
                <div className="space-y-2 lg:col-span-3">
                  <Label htmlFor={`description-${team.id}`}>Description</Label>
                  <Input id={`description-${team.id}`} name="description" defaultValue={team.description} />
                </div>
              </form>

              <form action={updateTeamMembersAction} className="grid gap-3">
                <input type="hidden" name="teamId" value={team.id} />
                <Label htmlFor={`members-${team.id}`}>Members</Label>
                <select
                  id={`members-${team.id}`}
                  name="memberIds"
                  multiple
                  defaultValue={team.members.map((member) => member.id)}
                  className="min-h-32 w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {activeUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName} - {user.roleName}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Current lead: {team.leadName ?? "Not assigned"}
                  </p>
                  <Button type="submit" variant="outline">
                    <Save />
                    Save members
                  </Button>
                </div>
              </form>

              {team.status === "active" && (
                <form action={archiveTeamAction}>
                  <input type="hidden" name="teamId" value={team.id} />
                  <Button type="submit" variant="destructive">
                    <Archive />
                    Archive team
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}

        {!teams.length && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No teams exist yet. Create the first company team above.
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
