import Link from "next/link";
import { MessageSquare, Plus, Search } from "lucide-react";

import {
  addTaskCommentAction,
  assignTaskAction,
  createTaskAction,
  updateTaskStatusAction,
} from "@/lib/workflows/actions";
import {
  getWorkflowTaskComments,
  getWorkflowTasks,
  getWorkflowTeams,
  getWorkflowUsers,
} from "@/lib/workflows/queries";
import { hasPermission, type AuthContext } from "@/lib/auth/permissions";
import { formatCairoDateTime } from "@/lib/time";
import { PageMessage } from "@/components/admin/page-message";
import { SavedViewsPanel } from "@/components/dashboard/saved-views-panel";
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
  searchParams: { q?: string; status?: string; team?: string; error?: string; notice?: string };
}) {
  const [tasks, users, teams] = await Promise.all([
    getWorkflowTasks(context, {
      search: searchParams.q,
      status: searchParams.status,
      teamId: searchParams.team,
    }),
    getWorkflowUsers(context),
    getWorkflowTeams(context),
  ]);
  const comments = await getWorkflowTaskComments(context, tasks.map((task) => task.id));
  const commentsByTask = new Map(tasks.map((task) => [task.id, comments.filter((comment) => comment.task_id === task.id)]));
  const activeUsers = users.filter((user) => user.status === "active");
  const activeTeams = teams.filter((team) => team.status === "active");
  const canCreate = hasPermission(context, "tasks.create", "limited");
  const canAssign = hasPermission(context, "tasks.assign", "limited");
  const canUpdateStatus = hasPermission(context, "tasks.update_status", "limited");

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Tasks</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>

      <PageMessage error={searchParams.error} status={searchParams.notice} />

      {canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create task</CardTitle>
            <CardDescription>Create real company-scoped work with an owner, team, priority, and due date.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createTaskAction} className="grid gap-4 lg:grid-cols-4">
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
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter by status, team, or title.</CardDescription>
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
            <div className="flex items-end">
              <Button type="submit" className="w-full md:w-auto">Apply</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <SavedViewsPanel
        context={context}
        module="tasks"
        basePath={basePath}
        currentFilters={{
          q: searchParams.q,
          status: searchParams.status,
          team: searchParams.team,
        }}
      />

      <div className="grid gap-4">
        {tasks.map((task) => {
          const taskComments = commentsByTask.get(task.id) ?? [];

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
                    {task.teamName && <Badge variant="secondary">{task.teamName}</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="grid gap-3 text-sm md:grid-cols-4">
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
                    <form action={assignTaskAction} className="grid gap-3 rounded-lg border bg-secondary/30 p-3">
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="redirectTo" value={basePath} />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`assign-${task.id}`}>Assignee</Label>
                          <select id={`assign-${task.id}`} name="assignedTo" defaultValue={task.assigned_to ?? ""} className={selectClass}>
                            <option value="">Unassigned</option>
                            {activeUsers.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}
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
                  )}

                  {canUpdateStatus && (
                    <form action={updateTaskStatusAction} className="grid gap-3 rounded-lg border bg-secondary/30 p-3">
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="redirectTo" value={basePath} />
                      <Label htmlFor={`status-${task.id}`}>Status</Label>
                      <select id={`status-${task.id}`} name="status" defaultValue={task.status} className={selectClass}>
                        {taskStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                      <Button type="submit" variant="outline" size="sm">Update status</Button>
                    </form>
                  )}
                </div>

                <div>
                  <Link href={`/tasks/${task.id}`} className={buttonVariants({ variant: "secondary" })}>
                    Open task detail
                  </Link>
                </div>

                <form action={addTaskCommentAction} className="grid gap-3">
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
              </CardContent>
            </Card>
          );
        })}

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
