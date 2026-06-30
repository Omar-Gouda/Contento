import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare } from "lucide-react";

import {
  addTaskCommentAction,
  assignTaskAction,
  submitTaskFinalOutputAction,
  updateTaskStatusAction,
} from "@/lib/workflows/actions";
import {
  getWorkflowTaskById,
  getWorkflowTaskComments,
  getWorkflowTeams,
  getWorkflowUsers,
} from "@/lib/workflows/queries";
import { requirePermission } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import { formatCairoDateTime } from "@/lib/time";
import { routes } from "@/constants/routes";
import { CollaborationPanel } from "@/components/dashboard/collaboration-panel";
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
import { getClients } from "@/lib/clients/queries";

export const metadata: Metadata = {
  title: "Task detail",
};

const taskStatuses = ["pending", "assigned", "in_progress", "under_review", "completed", "closed"] as const;
const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ id }, messages] = await Promise.all([params, searchParams]);
  const context = await requirePermission("tasks.view", "view");
  const [task, comments, users, teams, clients] = await Promise.all([
    getWorkflowTaskById(context, id),
    getWorkflowTaskComments(context, [id]),
    getWorkflowUsers(context),
    getWorkflowTeams(context),
    getClients(context),
  ]);

  if (!task) {
    notFound();
  }

  const activeUsers = users.filter((user) => user.status === "active");
  const activeTeams = teams.filter((team) => team.status === "active");
  const activeClients = clients.filter((client) => client.status === "active");
  const canAssign = hasPermission(context, "tasks.assign", "limited");
  const canUpdateStatus = hasPermission(context, "tasks.update_status", "limited");
  const canFinalOutput = hasPermission(context, "content.final_output", "limited");

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Task detail</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">{task.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {task.description || "No description provided."}
        </p>
      </div>

      {(messages.error || messages.notice) && (
        <Card>
          <CardContent className="py-4 text-sm text-muted-foreground">
            {messages.error ?? messages.notice}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Task status</CardTitle>
              <CardDescription>Review ownership, priority, and workflow state.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{task.status}</Badge>
              <Badge variant="secondary">{task.priority}</Badge>
              {task.clientName && <Badge variant="secondary">{task.clientName}</Badge>}
              {task.teamName && <Badge variant="secondary">{task.teamName}</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Client</p>
            {task.client_id ? (
              <Link href={routes.clients.detail(task.client_id)} className="font-medium text-primary hover:underline">
                {task.clientName ?? "Open client"}
              </Link>
            ) : (
              <p className="font-medium">No client</p>
            )}
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
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {canAssign && (
          <Card>
            <CardHeader>
              <CardTitle>Assignment</CardTitle>
              <CardDescription>Reassign the task within the current company scope.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={assignTaskAction} className="grid gap-3">
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="redirectTo" value={`/tasks/${task.id}`} />
                <Label htmlFor="clientId">Client</Label>
                <select id="clientId" name="clientId" defaultValue={task.client_id ?? ""} className={selectClass}>
                  <option value="">No client</option>
                  {activeClients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
                <Label htmlFor="assignedTo">Assignee</Label>
                <select id="assignedTo" name="assignedTo" defaultValue={task.assigned_to ?? ""} className={selectClass}>
                  <option value="">Unassigned</option>
                  {activeUsers.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}
                </select>
                <Label htmlFor="teamId">Team</Label>
                <select id="teamId" name="teamId" defaultValue={task.team_id ?? ""} className={selectClass}>
                  <option value="">No team</option>
                  {activeTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
                <Button type="submit" variant="outline">Save assignment</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {canUpdateStatus && (
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
              <CardDescription>Move the task through the documented workflow.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateTaskStatusAction} className="grid gap-3">
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="redirectTo" value={`/tasks/${task.id}`} />
                <Label htmlFor="status">Status</Label>
                <select id="status" name="status" defaultValue={task.status} className={selectClass}>
                  {taskStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <Button type="submit" variant="outline">Update status</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {canFinalOutput && (
          <Card>
            <CardHeader>
              <CardTitle>Final output</CardTitle>
              <CardDescription>Attach the final Drive link for production handoff.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={submitTaskFinalOutputAction} className="grid gap-3">
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="redirectTo" value={`/tasks/${task.id}`} />
                <Label htmlFor="finalDriveLink">Final Drive link</Label>
                <Input
                  id="finalDriveLink"
                  name="finalDriveLink"
                  type="url"
                  defaultValue={task.final_drive_link ?? ""}
                  placeholder="https://drive.google.com/..."
                  required
                />
                <Button type="submit" variant="outline">Save final</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
          <CardDescription>Add progress, blockers, review notes, or handoff context.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form action={addTaskCommentAction} className="flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="taskId" value={task.id} />
            <input type="hidden" name="redirectTo" value={`/tasks/${task.id}`} />
            <Input name="body" placeholder="Add a task comment" />
            <Button type="submit" variant="outline">
              <MessageSquare />
              Add
            </Button>
          </form>
          <div className="grid gap-2">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-lg border bg-secondary/25 p-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{comment.userName ?? "Unknown user"}</span>
                  <span>{formatCairoDateTime(comment.created_at)}</span>
                </div>
                <p>{comment.body}</p>
              </div>
            ))}
            {!comments.length && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No comments have been added yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <CollaborationPanel context={context} entityType="task" entityId={task.id} redirectTo={`/tasks/${task.id}`} />
    </section>
  );
}
