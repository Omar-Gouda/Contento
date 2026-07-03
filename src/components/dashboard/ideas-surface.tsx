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
import { getClients } from "@/lib/clients/queries";
import { hasPermission, type AuthContext } from "@/lib/auth/permissions";
import { formatCairoDateTime } from "@/lib/time";
import { PageMessage } from "@/components/admin/page-message";
import { FilterPanel } from "@/components/dashboard/filter-panel";
import { FormSheet } from "@/components/dashboard/form-sheet";
import { IdeaTypeFields } from "@/components/dashboard/idea-type-fields";
import { PageActions, PageHeader } from "@/components/dashboard/page-header";
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

function ideaTone(status: string) {
  if (status === "approved") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  }

  if (status === "rejected" || status === "archived") {
    return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200";
  }

  if (status === "under_review" || status === "submitted") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200";
  }

  return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-200";
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
  searchParams: { q?: string; status?: string; team?: string; client?: string; error?: string; notice?: string };
}) {
  const [ideas, users, teams, clients] = await Promise.all([
    getWorkflowIdeas(context, { search: searchParams.q, status: searchParams.status, teamId: searchParams.team, clientId: searchParams.client }),
    getWorkflowUsers(context),
    getWorkflowTeams(context),
    getClients(context),
  ]);
  const activeUsers = users.filter((user) => user.status === "active");
  const activeTeams = teams.filter((team) => team.status === "active");
  const activeClients = clients.filter((client) => client.status === "active");
  const canCreate = hasPermission(context, "ideas.create", "limited");
  const canUpdate = hasPermission(context, "ideas.update", "limited");
  const canChangeStatus = hasPermission(context, "ideas.change_status", "limited");

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Ideas"
        title={title}
        description={description}
        actions={
          <PageActions>
            {canCreate && (
              <FormSheet
                title="Create idea"
                description="Select a client, choose the format, and shape the idea before it moves into review."
                triggerLabel="Create idea"
              >
                <form action={createIdeaAction} className="grid gap-4 lg:grid-cols-3">
                  <input type="hidden" name="redirectTo" value={basePath} />
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" name="title" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientId">Client</Label>
                    <select id="clientId" name="clientId" className={selectClass}>
                      <option value="">No client</option>
                      {activeClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                    </select>
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
                  <IdeaTypeFields selectClass={selectClass} />
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
              </FormSheet>
            )}
            <FilterPanel
              description="Search ideas and narrow by review status, team, or client."
              activeFilters={[
                { label: "Search", value: searchParams.q },
                { label: "Status", value: searchParams.status },
                { label: "Team", value: activeTeams.find((team) => team.id === searchParams.team)?.name ?? searchParams.team },
                { label: "Client", value: activeClients.find((client) => client.id === searchParams.client)?.name ?? searchParams.client },
              ]}
            >
          <form action={basePath} className="grid gap-3 md:grid-cols-[1fr_180px_180px_180px_auto]">
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
            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <select id="client" name="client" defaultValue={searchParams.client ?? "all"} className={selectClass}>
                <option value="all">All clients</option>
                {activeClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-fit">Apply</Button>
            </div>
          </form>
            </FilterPanel>
          </PageActions>
        }
      />

      <PageMessage error={searchParams.error} status={searchParams.notice} />

      <div className="grid gap-4">
        {ideas.map((idea) => (
          <Card key={idea.id}>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle>{idea.title}</CardTitle>
                    <CardDescription>{idea.description || "No description provided."}</CardDescription>
                  </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={ideaTone(idea.status)}>{idea.status}</Badge>
                  {idea.clientName && <Badge variant="secondary">{idea.clientName}</Badge>}
                  <Badge variant="outline" className="border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-200">{idea.idea_type}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-3 text-sm md:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Client</p>
                  <p className="font-medium">{idea.clientName ?? "No client"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{idea.idea_type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Publishing</p>
                  <p className="font-medium">{idea.publishing_at ? formatCairoDateTime(idea.publishing_at) : "Not scheduled"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created by</p>
                  <p className="font-medium">{idea.creatorName ?? "Unknown"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Production owner</p>
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
                <div>
                  <p className="text-muted-foreground">Comments</p>
                  <p className="font-medium">{idea.commentCount}</p>
                </div>
              </div>

              {idea.final_drive_link && (
                <a href={idea.final_drive_link} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">
                  Open final Drive link
                </a>
              )}

              {idea.notes && (
                <div className="rounded-lg border bg-secondary/30 p-3 text-sm">
                  <p className="mb-1 font-medium">Notes</p>
                  <p className="text-muted-foreground">{idea.notes}</p>
                </div>
              )}

              {canUpdate && (
                <details className="rounded-lg border bg-secondary/20 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-primary">Edit idea details</summary>
                  <form action={updateIdeaAction} className="mt-3 grid gap-3 lg:grid-cols-3">
                  <input type="hidden" name="ideaId" value={idea.id} />
                  <input type="hidden" name="redirectTo" value={basePath} />
                  <div className="space-y-2">
                    <Label htmlFor={`client-${idea.id}`}>Client</Label>
                    <select id={`client-${idea.id}`} name="clientId" defaultValue={idea.client_id ?? ""} className={selectClass}>
                      <option value="">No client</option>
                      {activeClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`type-${idea.id}`}>Type</Label>
                    <select id={`type-${idea.id}`} name="ideaType" defaultValue={idea.idea_type} className={selectClass}>
                      <option value="post">Post</option>
                      <option value="reel">Reel</option>
                      <option value="story">Story</option>
                    </select>
                  </div>
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
                  <div className="space-y-2">
                    <Label htmlFor={`urgency-${idea.id}`}>Urgency</Label>
                    <select id={`urgency-${idea.id}`} name="urgency" defaultValue={idea.urgency} className={selectClass}>
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`publishing-${idea.id}`}>Publishing datetime</Label>
                    <Input id={`publishing-${idea.id}`} name="publishingAt" defaultValue={idea.publishing_at ? idea.publishing_at.slice(0, 16) : ""} type="datetime-local" />
                  </div>
                  <div className="space-y-2 lg:col-span-3">
                    <Label htmlFor={`headline-${idea.id}`}>Headline</Label>
                    <Input id={`headline-${idea.id}`} name="headline" defaultValue={idea.headline} />
                  </div>
                  <div className="space-y-2 lg:col-span-3">
                    <Label htmlFor={`subtext-${idea.id}`}>Subtext</Label>
                    <Input id={`subtext-${idea.id}`} name="subtext" defaultValue={idea.subtext} />
                  </div>
                  <div className="space-y-2 lg:col-span-3">
                    <Label htmlFor={`visual-${idea.id}`}>Visual direction</Label>
                    <Input id={`visual-${idea.id}`} name="visual" defaultValue={idea.visual} />
                  </div>
                  <div className="space-y-2 lg:col-span-3">
                    <Label htmlFor={`cta-${idea.id}`}>CTA</Label>
                    <Input id={`cta-${idea.id}`} name="cta" defaultValue={idea.cta} />
                  </div>
                  <div className="space-y-2 lg:col-span-3">
                    <Label htmlFor={`script-${idea.id}`}>Script / captions</Label>
                    <Input id={`script-${idea.id}`} name="script" defaultValue={idea.script} />
                  </div>
                  <div className="space-y-2 lg:col-span-3">
                    <Label htmlFor={`final-${idea.id}`}>Final Drive link</Label>
                    <Input id={`final-${idea.id}`} name="finalDriveLink" defaultValue={idea.final_drive_link ?? ""} />
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
                </details>
              )}

              <div className="flex flex-wrap gap-3">
                <Link href={`/ideas/${idea.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  Open idea detail
                </Link>

                {(canChangeStatus || canUpdate) && (
                  <details className="w-full rounded-lg border bg-secondary/20 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-primary">Manage idea</summary>
                    <div className="mt-3 flex flex-wrap gap-2">
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
                  </details>
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
