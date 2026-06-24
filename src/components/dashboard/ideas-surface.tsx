import Link from "next/link";
import { Lightbulb, Plus, Save, Search, Trash2 } from "lucide-react";

import {
  createIdeaAction,
  deleteIdeaAction,
  updateIdeaAction,
  updateIdeaStatusAction,
} from "@/lib/workflows/actions";
import {
  getWorkflowIdeas,
  getWorkflowTeams,
  getWorkflowUsers,
} from "@/lib/workflows/queries";
import { hasPermission, type AuthContext } from "@/lib/auth/permissions";
import { formatCairoDateTime } from "@/lib/time";
import { PageMessage } from "@/components/admin/page-message";
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

const ideaStatuses = ["draft", "submitted", "under_review", "approved", "rejected", "archived"] as const;
const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function statusVariant(status: string) {
  if (status === "approved") {
    return "default";
  }

  if (status === "rejected" || status === "archived") {
    return "secondary";
  }

  return "outline";
}

export async function IdeasSurface({
  context,
  basePath,
  title,
  description,
  searchParams,
}: {
  context: AuthContext;
  basePath: string;
  title: string;
  description: string;
  searchParams: { q?: string; status?: string; team?: string; error?: string; notice?: string };
}) {
  const [ideas, users, teams] = await Promise.all([
    getWorkflowIdeas(context, { search: searchParams.q, status: searchParams.status, teamId: searchParams.team }),
    getWorkflowUsers(context),
    getWorkflowTeams(context),
  ]);
  const activeUsers = users.filter((user) => user.status === "active");
  const activeTeams = teams.filter((team) => team.status === "active");
  const canCreate = hasPermission(context, "ideas.create", "limited");
  const canUpdate = hasPermission(context, "ideas.update", "limited");
  const canChangeStatus = hasPermission(context, "ideas.change_status", "limited");

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Ideas</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      <PageMessage error={searchParams.error} status={searchParams.notice} />

      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create idea</CardTitle>
            <CardDescription>Capture a concept and optionally assign someone to develop it.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createIdeaAction} className="grid gap-4 lg:grid-cols-3">
              <input type="hidden" name="redirectTo" value={basePath} />
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignedTo">Assignee</Label>
                <select id="assignedTo" name="assignedTo" className={selectClass}>
                  <option value="">Unassigned</option>
                  {activeUsers.map((user) => (
                    <option key={user.id} value={user.id}>{user.displayName}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="teamId">Team</Label>
                <select id="teamId" name="teamId" className={selectClass}>
                  <option value="">No team</option>
                  {activeTeams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" />
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" />
              </div>
              <div className="lg:col-span-3">
                <Button type="submit">
                  <Plus />
                  Create idea
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search ideas and narrow by review status.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={basePath} className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
            <div className="space-y-2">
              <Label htmlFor="q">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="q" name="q" defaultValue={searchParams.q ?? ""} className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select id="status" name="status" defaultValue={searchParams.status ?? "all"} className={selectClass}>
                <option value="all">All statuses</option>
                {ideaStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="team">Team</Label>
              <select id="team" name="team" defaultValue={searchParams.team ?? "all"} className={selectClass}>
                <option value="all">All teams</option>
                {activeTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full md:w-auto">Apply</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {ideas.map((idea) => (
          <Card key={idea.id}>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>{idea.title}</CardTitle>
                  <CardDescription>{idea.description || "No description provided."}</CardDescription>
                </div>
                <Badge variant={statusVariant(idea.status)}>{idea.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-3 text-sm md:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Created by</p>
                  <p className="font-medium">{idea.creatorName ?? "Unknown"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Assigned to</p>
                  <p className="font-medium">{idea.assigneeName ?? "Unassigned"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Team</p>
                  <p className="font-medium">{idea.teamName ?? "No team"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">{formatCairoDateTime(idea.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Updated</p>
                  <p className="font-medium">{formatCairoDateTime(idea.updated_at)}</p>
                </div>
              </div>

              {idea.notes && (
                <div className="rounded-lg border bg-secondary/30 p-3 text-sm">
                  <p className="mb-1 font-medium">Notes</p>
                  <p className="text-muted-foreground">{idea.notes}</p>
                </div>
              )}

              {canUpdate && (
                <form action={updateIdeaAction} className="grid gap-3 rounded-lg border bg-secondary/30 p-3 lg:grid-cols-3">
                  <input type="hidden" name="ideaId" value={idea.id} />
                  <input type="hidden" name="redirectTo" value={basePath} />
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor={`title-${idea.id}`}>Title</Label>
                    <Input id={`title-${idea.id}`} name="title" defaultValue={idea.title} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`assigned-${idea.id}`}>Assignee</Label>
                    <select id={`assigned-${idea.id}`} name="assignedTo" defaultValue={idea.assigned_to ?? ""} className={selectClass}>
                      <option value="">Unassigned</option>
                      {activeUsers.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`team-${idea.id}`}>Team</Label>
                    <select id={`team-${idea.id}`} name="teamId" defaultValue={idea.team_id ?? ""} className={selectClass}>
                      <option value="">No team</option>
                      {activeTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor={`description-${idea.id}`}>Description</Label>
                    <Input id={`description-${idea.id}`} name="description" defaultValue={idea.description} />
                  </div>
                  <div className="space-y-2 lg:col-span-3">
                    <Label htmlFor={`notes-${idea.id}`}>Notes</Label>
                    <Input id={`notes-${idea.id}`} name="notes" defaultValue={idea.notes} />
                  </div>
                  <Button type="submit" variant="outline">
                    <Save />
                    Save idea
                  </Button>
                </form>
              )}

              <div className="flex flex-wrap gap-3">
                <Link href={`/ideas/${idea.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  Open idea detail
                </Link>

                {canChangeStatus && (
                  <form action={updateIdeaStatusAction} className="flex flex-wrap gap-2">
                    <input type="hidden" name="ideaId" value={idea.id} />
                    <input type="hidden" name="redirectTo" value={basePath} />
                    <select name="status" defaultValue={idea.status} className={selectClass}>
                      {ideaStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <Button type="submit" variant="outline" size="sm">Update status</Button>
                  </form>
                )}

                {canUpdate && (
                  <form action={deleteIdeaAction}>
                    <input type="hidden" name="ideaId" value={idea.id} />
                    <input type="hidden" name="redirectTo" value={basePath} />
                    <Button type="submit" variant="destructive" size="sm">
                      <Trash2 />
                      Delete
                    </Button>
                  </form>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {!ideas.length && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Lightbulb className="mx-auto mb-3 size-8 text-primary" />
              No ideas match the current filters.
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
