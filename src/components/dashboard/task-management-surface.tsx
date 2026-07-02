import Link from "next/link";
import { MessageSquare, Plus, Search } from "lucide-react";

import {
  addTaskCommentAction,
  assignTaskAction,
  createTaskAction,
  submitTaskFinalOutputAction,
  updateTaskStatusAction,
} from "@/lib/workflows/actions";
import {
  getWorkflowTaskComments,
  getWorkflowTasks,
  getWorkflowTeams,
  getWorkflowUsers,
} from "@/lib/workflows/queries";
import { getClients } from "@/lib/clients/queries";
import { hasPermission, type AuthContext } from "@/lib/auth/permissions";
import { formatCairoDateTime } from "@/lib/time";
import { PageMessage } from "@/components/admin/page-message";
import { FilterPanel } from "@/components/dashboard/filter-panel";
import { FormSheet } from "@/components/dashboard/form-sheet";
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
import { isProductionRole } from "@/types/roles";

const taskStatuses = ["pending", "assigned", "in_progress", "under_review", "completed", "closed"] as const;
const priorities = ["low", "normal", "high", "urgent"] as const;
const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function statusVariant(status: string) {
  if (status === "completed" || status === "closed") {
    return "default";
  }

  if (status === "under_review" || status === "in_progress") {
    return "secondary";
  }

  return "outline";
}

function productionType(roleName: string) {
  if (roleName === "Graphic Designer") {
    return "Design";
  }

  if (roleName === "Video Editor") {
    return "Video";
  }

  return "Content";
}

export async function TaskManagementSurface({
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
  const [tasks, users, teams] = await Promise.all([
    getWorkflowTasks(context, {
      search: searchParams.q,
      status: searchParams.status,
      teamId: searchParams.team,
      clientId: searchParams.client,
    }),
    getWorkflowUsers(context),
    getWorkflowTeams(context),
  ]);
  const clients = await getClients(context);
  const comments = await getWorkflowTaskComments(context, tasks.map((task) => task.id));
  const commentsByTask = new Map(tasks.map((task) => [task.id, comments.filter((comment) => comment.task_id === task.id)]));
  const activeUsers = users.filter((user) => user.status === "active");
  const productionUsers = activeUsers.filter((user) =>
    ["Content Creator", "Graphic Designer", "Video Editor"].includes(user.roleName)
  );
  const assignmentUsers = context.role === "supervisor" ? productionUsers : activeUsers;
  const activeTeams = teams.filter((team) => team.status === "active");
  const activeClients = clients.filter((client) => client.status === "active");
  const canCreate = hasPermission(context, "tasks.create", "limited");
  const canAssign = hasPermission(context, "tasks.assign", "limited");
  const canUpdateStatus = hasPermission(context, "tasks.update_status", "limited");
  const canFinalOutput = hasPermission(context, "content.final_output", "limited");
  const productionRole = isProductionRole(context.role);
  const today = new Date().toISOString().slice(0, 10);
  const groupedTasks = [
    {
      label: "Due soon",
      description: "Open tasks with the closest deadlines.",
      tasks: tasks.filter((task) => task.due_date && task.due_date >= today && !["completed", "closed"].includes(task.status)).slice(0, 8),
    },
    {
      label: "In progress",
      description: "Work actively moving through production.",
      tasks: tasks.filter((task) => ["assigned", "in_progress"].includes(task.status)),
    },
    {
      label: "Waiting review",
      description: "Tasks waiting for review or a handoff decision.",
      tasks: tasks.filter((task) => task.status === "under_review"),
    },
    {
      label: "Completed",
      description: "Recently completed or closed tasks.",
      tasks: tasks.filter((task) => ["completed", "closed"].includes(task.status)),
    },
  ].filter((group) => group.tasks.length > 0);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Tasks"
        title={title}
        description={description}
        actions={
          <PageActions>
            {canCreate && (
              <FormSheet
                title={context.role === "supervisor" ? "Assign production work" : "Create task"}
                description={
                  context.role === "supervisor"
                    ? "Create client-scoped work and assign it to a Content Creator, Graphic Designer, or Video Editor."
                    : "Create real company-scoped work with an owner, team, priority, and due date."
                }
                triggerLabel={context.role === "supervisor" ? "Assign work" : "Create task"}
              >
                <form action={createTaskAction} className="grid gap-4 lg:grid-cols-4">
                  <input type="hidden" name="redirectTo" value={basePath} />
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" name="title" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientId">Client</Label>
                    <select id="clientId" name="clientId" className={selectClass}>
                      <option value="">No client</option>
                      {activeClients.map((client) => (
                        <option key={client.id} value={client.id}>{client.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignedTo">Assignee</Label>
                    <select id="assignedTo" name="assignedTo" className={selectClass}>
                      <option value="">Unassigned</option>
                      {assignmentUsers.map((user) => (
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
                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="finalDriveLink">Final Drive link</Label>
                    <Input id="finalDriveLink" name="finalDriveLink" type="url" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <select id="priority" name="priority" defaultValue="normal" className={selectClass}>
                      {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due date</Label>
                    <Input id="dueDate" name="dueDate" type="date" />
                  </div>
                  <div className="flex items-end lg:col-span-4">
                    <Button type="submit">
                      <Plus />
                      Create task
                    </Button>
                  </div>
                </form>
              </FormSheet>
            )}
            <FilterPanel
              description="Filter by status, team, client, or title."
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
                {taskStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
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
        {(groupedTasks.length ? groupedTasks : [{ label: "Tasks", description: "Current task records.", tasks }]).map((group) => (
          <div key={group.label} className="grid gap-3">
            <div>
              <h2 className="text-lg font-semibold">{group.label}</h2>
              <p className="text-sm text-muted-foreground">{group.description}</p>
            </div>
            {group.tasks.map((task) => {
          const taskComments = commentsByTask.get(task.id) ?? [];
          const taskAssignee = activeUsers.find((user) => user.id === task.assigned_to);
          const taskType = taskAssignee ? productionType(taskAssignee.roleName) : "General";

          return (
            <Card key={task.id}>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle>{task.title}</CardTitle>
                    <CardDescription>{task.description || "No description provided."}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={statusVariant(task.status)}>{task.status}</Badge>
                    <Badge variant="secondary">{task.priority}</Badge>
                    <Badge variant="outline">{taskType}</Badge>
                    {task.clientName && <Badge variant="secondary">{task.clientName}</Badge>}
                    {task.teamName && <Badge variant="secondary">{task.teamName}</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="grid gap-3 text-sm md:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Client</p>
                    <p className="font-medium">{task.clientName ?? "No client"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Assignee</p>
                    <p className="font-medium">{task.assigneeName ?? "Unassigned"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Assigned by</p>
                    <p className="font-medium">{task.assignedByName ?? task.creatorName ?? "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Due date</p>
                    <p className="font-medium">{task.due_date ?? "No due date"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Updated</p>
                    <p className="font-medium">{formatCairoDateTime(task.updated_at)}</p>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  {canAssign && (
                    <details className="rounded-lg border bg-secondary/20 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-primary">Manage assignment</summary>
                    <form action={assignTaskAction} className="mt-3 grid gap-3">
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="redirectTo" value={basePath} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`client-${task.id}`}>Client</Label>
                          <select id={`client-${task.id}`} name="clientId" defaultValue={task.client_id ?? ""} className={selectClass}>
                            <option value="">No client</option>
                            {activeClients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`assign-${task.id}`}>Assignee</Label>
                          <select id={`assign-${task.id}`} name="assignedTo" defaultValue={task.assigned_to ?? ""} className={selectClass}>
                            <option value="">Unassigned</option>
                            {assignmentUsers.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`task-team-${task.id}`}>Team</Label>
                          <select id={`task-team-${task.id}`} name="teamId" defaultValue={task.team_id ?? ""} className={selectClass}>
                            <option value="">No team</option>
                            {activeTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <Button type="submit" variant="outline" size="sm">Save assignment</Button>
                    </form>
                    </details>
                  )}

                  {canUpdateStatus && !productionRole && (
                    <details className="rounded-lg border bg-secondary/20 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-primary">Update status</summary>
                    <form action={updateTaskStatusAction} className="mt-3 grid gap-3">
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="redirectTo" value={basePath} />
                      <Label htmlFor={`status-${task.id}`}>Status</Label>
                      <select id={`status-${task.id}`} name="status" defaultValue={task.status} className={selectClass}>
                        {taskStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      <Button type="submit" variant="outline" size="sm">Update status</Button>
                    </form>
                    </details>
                  )}
                </div>

                <div>
                  <Link href={`/tasks/${task.id}`} className={buttonVariants({ variant: "secondary" })}>
                    Open task detail
                  </Link>
                  {task.client_id && (
                    <Link href={`/clients/${task.client_id}`} className={buttonVariants({ variant: "ghost" })}>
                      Open client
                    </Link>
                  )}
                  {canUpdateStatus && productionRole && (
                    <details className="mt-3 rounded-lg border bg-secondary/20 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-primary">Submit for review</summary>
                    <form action={updateTaskStatusAction} className="mt-3 grid gap-3">
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="status" value="under_review" />
                      <input type="hidden" name="redirectTo" value={basePath} />
                      <p className="text-sm text-muted-foreground">
                        Send this production task to Content Creator review when the final link is ready.
                      </p>
                      <Button type="submit" variant="outline" size="sm">Submit for Content Creator review</Button>
                    </form>
                    </details>
                  )}
                </div>

                <details className="rounded-lg border bg-secondary/20 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-primary">Add comment</summary>
                <form action={addTaskCommentAction} className="mt-3 grid gap-3">
                  <input type="hidden" name="taskId" value={task.id} />
                  <input type="hidden" name="redirectTo" value={basePath} />
                  <Label htmlFor={`comment-${task.id}`}>Comment</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input id={`comment-${task.id}`} name="body" placeholder="Add progress, blocker, or review note" />
                    <Button type="submit" variant="outline">
                      <MessageSquare />
                      Add
                    </Button>
                  </div>
                </form>
                </details>

                {taskComments.length > 0 && (
                  <div className="grid gap-2">
                    {taskComments.slice(0, 3).map((comment) => (
                      <div key={comment.id} className="rounded-lg border bg-background p-3 text-sm">
                        <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span>{comment.userName ?? "Unknown user"}</span>
                          <span>{formatCairoDateTime(comment.created_at)}</span>
                        </div>
                        <p>{comment.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                {canFinalOutput && (
                  <details className="rounded-lg border bg-secondary/20 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-primary">Save final output</summary>
                  <form action={submitTaskFinalOutputAction} className="mt-3 grid gap-3">
                    <input type="hidden" name="taskId" value={task.id} />
                    <input type="hidden" name="redirectTo" value={basePath} />
                    <Label htmlFor={`final-${task.id}`}>Final Drive link</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        id={`final-${task.id}`}
                        name="finalDriveLink"
                        defaultValue={task.final_drive_link ?? ""}
                        type="url"
                        placeholder="https://drive.google.com/..."
                        required
                      />
                      <Button type="submit" variant="outline">
                        {productionRole ? "Save final and keep in queue" : "Save final"}
                      </Button>
                    </div>
                  </form>
                  </details>
                )}
              </CardContent>
            </Card>
          );
            })}
          </div>
        ))}

        {!tasks.length && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No tasks match the current filters.
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
