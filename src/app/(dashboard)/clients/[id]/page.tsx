import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileText,
  MessageSquare,
  Phone,
  Plus,
  Send,
  Users,
} from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { IdeaTypeFields } from "@/components/dashboard/idea-type-fields";
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
import { routes } from "@/constants/routes";
import { requirePermission } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import { saveClientAction } from "@/lib/clients/actions";
import { getClientAssignableUsers, getClientWorkspace } from "@/lib/clients/queries";
import {
  addTaskCommentAction,
  createIdeaAction,
  createTaskAction,
  submitTaskFinalOutputAction,
  updateTaskStatusAction,
} from "@/lib/workflows/actions";
import { getWorkflowTaskComments } from "@/lib/workflows/queries";
import { formatCairoDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { isProductionRole } from "@/types/roles";

export const metadata: Metadata = {
  title: "Client detail",
};

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

const priorities = ["low", "normal", "high", "urgent"] as const;

function statusTone(status: string) {
  if (["approved", "published", "completed", "closed", "sent"].includes(status)) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  }

  if (["pending", "assigned", "submitted", "under_review"].includes(status)) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200";
  }

  if (["rejected", "archived"].includes(status) || status.includes("changes_requested")) {
    return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200";
  }

  if (["scheduled", "in_progress"].includes(status)) {
    return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-200";
  }

  return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-200";
}

function SectionCard({
  id,
  title,
  description,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  description: string;
  icon: typeof BarChart3;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ id }, messages] = await Promise.all([params, searchParams]);
  const context = await requirePermission("clients.view", "view");
  const [client, users] = await Promise.all([
    getClientWorkspace(context, id),
    getClientAssignableUsers(context),
  ]);

  if (!client) {
    notFound();
  }

  const taskComments = await getWorkflowTaskComments(context, client.tasks.map((task) => task.id));
  const canManageClient = (
    hasPermission(context, "clients.update", "limited") ||
    hasPermission(context, "clients.manage", "limited")
  ) && context.role !== "client";
  const canCreateIdea = hasPermission(context, "ideas.create", "limited") && context.role !== "client";
  const canCreateTask = hasPermission(context, "tasks.create", "limited") && context.role !== "client";
  const canComment = hasPermission(context, "tasks.view", "view") && context.role !== "client";
  const canFinalOutput = hasPermission(context, "content.final_output", "limited");
  const productionRole = isProductionRole(context.role);
  const productionUsers = users.filter((user) =>
    user.status === "active" && ["creator", "graphic-designer", "video-editor"].includes(user.roleKey ?? "")
  );
  const initials = client.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const logoStyle = client.logo_url
    ? ({ backgroundImage: `url("${client.logo_url.replaceAll("\"", "%22")}")` } satisfies CSSProperties)
    : undefined;
  const recentComments = taskComments.slice(0, 8);
  const productionTasks = productionRole
    ? client.tasks.filter((task) => task.assigned_to === context.userId)
    : client.tasks;
  const visibleTabs = context.role === "client"
    ? [
      ["ideas", "Ideas", MessageSquare],
      ["calendar", "Calendar", CalendarDays],
      ["reports", "Reports", FileText],
      ["insights", "Insights", BarChart3],
    ] as const
    : [
      ["overview", "Overview", BarChart3],
      ["brief", "Brief", FileText],
      ["ideas", "Ideas", MessageSquare],
      ["tasks", "Tasks", ClipboardList],
      ["content", "Content", FileText],
      ["calendar", "Calendar", CalendarDays],
      ["reports", "Reports", FileText],
      ["insights", "Insights", BarChart3],
      ["chat", "Chat", MessageSquare],
      ["contact", "Contact", Phone],
    ] as const;

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="h-2 bg-primary" />
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div
              className="flex size-16 shrink-0 items-center justify-center rounded-xl border bg-secondary bg-cover bg-center text-lg font-semibold text-primary"
              style={logoStyle}
            >
              {!client.logo_url && initials}
            </div>
            <div>
              <p className="text-sm font-medium text-primary">Client command center</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-normal">{client.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {client.contact_person || client.contact_email || "No client contact yet"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("capitalize", statusTone(client.status))}>{client.status}</Badge>
            {client.contact_email && (
              <a href={`mailto:${client.contact_email}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Send />
                Contact
              </a>
            )}
            <Link href={routes.clients.home} className={buttonVariants({ variant: "secondary", size: "sm" })}>
              All clients
            </Link>
          </div>
        </div>
      </div>

      <PageMessage error={messages.error} status={messages.notice} />

      <div className="sticky top-16 z-10 flex gap-2 overflow-x-auto border-b bg-background/95 py-3 backdrop-blur">
        {visibleTabs.map(([tabId, label, Icon]) => (
          <a key={tabId} href={`#${tabId}`} className="inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm hover:bg-secondary">
            <Icon className="size-4" />
            {label}
          </a>
        ))}
      </div>

      {context.role !== "client" && (
        <>
          <SectionCard id="overview" title="Overview" description="Current work volume for this client." icon={BarChart3}>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border bg-secondary/25 p-4"><p className="text-2xl font-semibold">{client.tasks.length}</p><p className="text-sm text-muted-foreground">Tasks</p></div>
              <div className="rounded-lg border bg-secondary/25 p-4"><p className="text-2xl font-semibold">{client.ideas.length}</p><p className="text-sm text-muted-foreground">Ideas</p></div>
              <div className="rounded-lg border bg-secondary/25 p-4"><p className="text-2xl font-semibold">{client.content.length}</p><p className="text-sm text-muted-foreground">Content</p></div>
              <div className="rounded-lg border bg-secondary/25 p-4"><p className="text-2xl font-semibold">{client.reports.length}</p><p className="text-sm text-muted-foreground">Reports</p></div>
            </div>
          </SectionCard>

          <SectionCard id="brief" title="Brief" description="Brand direction, links, and operating notes." icon={FileText}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-3 text-sm">
                <div><p className="text-muted-foreground">Contact person</p><p className="font-medium">{client.contact_person || "Not set"}</p></div>
                <div><p className="text-muted-foreground">Contact email</p><p className="font-medium">{client.contact_email || "Not set"}</p></div>
                <div>
                  <p className="text-muted-foreground">Brief link</p>
                  {client.brief_drive_link ? (
                    <a href={client.brief_drive_link} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                      Open brief
                    </a>
                  ) : (
                    <p className="font-medium">Not set</p>
                  )}
                </div>
                <div><p className="text-muted-foreground">Requirements</p><p className="whitespace-pre-wrap text-muted-foreground">{client.requirements || "No brief yet."}</p></div>
              </div>

              {canManageClient && (
                <form action={saveClientAction} className="grid gap-3">
                  <input type="hidden" name="clientId" value={client.id} />
                  <input type="hidden" name="slug" value={client.slug ?? ""} />
                  <input type="hidden" name="logoUrl" value={client.logo_url ?? ""} />
                  <input type="hidden" name="primaryColor" value={client.primary_color ?? ""} />
                  <input type="hidden" name="secondaryColor" value={client.secondary_color ?? ""} />
                  <input type="hidden" name="accentColor" value={client.accent_color ?? ""} />
                  <input type="hidden" name="notes" value={client.notes} />
                  <div className="space-y-2">
                    <Label htmlFor="name">Client name</Label>
                    <Input id="name" name="name" defaultValue={client.name} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="contactPerson">Contact person</Label>
                      <Input id="contactPerson" name="contactPerson" defaultValue={client.contact_person ?? ""} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">Contact email</Label>
                      <Input id="contactEmail" name="contactEmail" type="email" defaultValue={client.contact_email ?? ""} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="briefDriveLink">Brief Drive link</Label>
                    <Input id="briefDriveLink" name="briefDriveLink" type="url" defaultValue={client.brief_drive_link ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requirements">Requirements</Label>
                    <textarea id="requirements" name="requirements" defaultValue={client.requirements} className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                  </div>
                  <input type="hidden" name="status" value={client.status} />
                  <input type="hidden" name="contactPhone" value={client.contact_phone ?? ""} />
                  <input type="hidden" name="assignedAccountManagerId" value={client.assigned_account_manager_id ?? ""} />
                  {client.assignedUsers.map((user) => (
                    <input key={user.id} type="hidden" name="assignedUserIds" value={user.id} />
                  ))}
                  <Button type="submit">Save brief</Button>
                </form>
              )}
            </div>
          </SectionCard>
        </>
      )}

      <SectionCard id="ideas" title="Ideas" description="Client-specific ideas, formats, scheduling, and creative direction." icon={MessageSquare}>
        <div className="grid gap-4">
          {canCreateIdea && (
            <form action={createIdeaAction} className="grid gap-4 rounded-xl border bg-secondary/20 p-4 lg:grid-cols-3">
              <input type="hidden" name="clientId" value={client.id} />
              <input type="hidden" name="redirectTo" value={routes.clients.detail(client.id)} />
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="idea-title">New idea</Label>
                <Input id="idea-title" name="title" placeholder="Warning: creativity may occur here." required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="idea-assigned">Production owner</Label>
                <select id="idea-assigned" name="assignedTo" className={selectClass}>
                  <option value="">Unassigned</option>
                  {productionUsers.map((user) => <option key={user.id} value={user.id}>{user.displayName} - {user.roleName}</option>)}
                </select>
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label htmlFor="idea-description">Description</Label>
                <Input id="idea-description" name="description" />
              </div>
              <IdeaTypeFields selectClass={selectClass} />
              <div className="lg:col-span-3">
                <Button type="submit"><Plus /> Submit idea</Button>
              </div>
            </form>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {client.ideas.map((idea) => (
              <Link key={idea.id} href={`/ideas/${idea.id}`} className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{idea.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{idea.headline || idea.description || "No headline yet."}</p>
                  </div>
                  <Badge variant="outline" className={statusTone(idea.status)}>{idea.status}</Badge>
                </div>
                <div className="mt-4 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                  <span>Client: {idea.clientName ?? client.name}</span>
                  <span>Type: {idea.idea_type}</span>
                  <span>Publishing: {idea.publishing_at ? formatCairoDateTime(idea.publishing_at) : "Not scheduled"}</span>
                  <span>Owner: {idea.assigneeName ?? "Unassigned"}</span>
                  <span>Comments: {idea.commentCount}</span>
                  <span>{idea.final_drive_link ? "Final Drive link attached" : "No final link"}</span>
                </div>
              </Link>
            ))}
          </div>
          {!client.ideas.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No ideas yet.</p>}
        </div>
      </SectionCard>

      {context.role !== "client" && (
        <SectionCard id="tasks" title="Tasks" description="Client-scoped assignment and production delivery." icon={ClipboardList}>
          <div className="grid gap-4">
            {canCreateTask && !productionRole && (
              <form action={createTaskAction} className="grid gap-4 rounded-xl border bg-secondary/20 p-4 lg:grid-cols-4">
                <input type="hidden" name="clientId" value={client.id} />
                <input type="hidden" name="redirectTo" value={routes.clients.detail(client.id)} />
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="task-title">Create task</Label>
                  <Input id="task-title" name="title" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-assigned">Assignee</Label>
                  <select id="task-assigned" name="assignedTo" className={selectClass}>
                    <option value="">Unassigned</option>
                    {productionUsers.map((user) => <option key={user.id} value={user.id}>{user.displayName} - {user.roleName}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-priority">Priority</Label>
                  <select id="task-priority" name="priority" defaultValue="normal" className={selectClass}>
                    {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                  </select>
                </div>
                <div className="space-y-2 lg:col-span-2">
                  <Label htmlFor="task-description">Brief</Label>
                  <Input id="task-description" name="description" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-due">Due date</Label>
                  <Input id="task-due" name="dueDate" type="date" />
                </div>
                <div className="flex items-end">
                  <Button type="submit"><Plus /> Create task</Button>
                </div>
              </form>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {productionTasks.map((task) => (
                <div key={task.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{task.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{task.description || client.requirements || "No brief provided."}</p>
                    </div>
                    <Badge variant="outline" className={statusTone(task.status)}>{task.status}</Badge>
                  </div>
                  <div className="mt-4 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                    <span>Client: {client.name}</span>
                    <span>Owner: {task.assigneeName ?? "Unassigned"}</span>
                    <span>Type: {task.assigneeName ? "Production" : "General"}</span>
                    <span>Due: {task.due_date ?? "No due date"}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/tasks/${task.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>Open task</Link>
                    {task.final_drive_link && <a href={task.final_drive_link} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>Final link</a>}
                  </div>
                  {canFinalOutput && task.assigned_to === context.userId && (
                    <form action={submitTaskFinalOutputAction} className="mt-4 grid gap-2">
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="redirectTo" value={routes.clients.detail(client.id)} />
                      <Label htmlFor={`final-${task.id}`}>Final Drive link</Label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input id={`final-${task.id}`} name="finalDriveLink" defaultValue={task.final_drive_link ?? ""} type="url" required />
                        <Button type="submit" variant="outline">Save final</Button>
                      </div>
                    </form>
                  )}
                  {productionRole && task.assigned_to === context.userId && (
                    <form action={updateTaskStatusAction} className="mt-3">
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="status" value="under_review" />
                      <input type="hidden" name="redirectTo" value={routes.clients.detail(client.id)} />
                      <Button type="submit" variant="outline" size="sm">Submit for Content Creator review</Button>
                    </form>
                  )}
                </div>
              ))}
            </div>
            {!productionTasks.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No client tasks are visible for your role.</p>}
          </div>
        </SectionCard>
      )}

      {context.role !== "client" && (
        <SectionCard id="content" title="Content" description="Submitted, reviewed, scheduled, and published work." icon={FileText}>
          <div className="grid gap-3 md:grid-cols-2">
            {client.content.map((item) => (
              <Link key={item.id} href={`/content/${item.id}`} className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{item.title}</p>
                  <Badge variant="outline" className={statusTone(item.status)}>{item.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.final_drive_link || "No final Drive link yet."}</p>
              </Link>
            ))}
          </div>
          {!client.content.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No content items yet.</p>}
        </SectionCard>
      )}

      <SectionCard id="calendar" title="Calendar" description="Publishing dates and client-visible deadlines." icon={CalendarDays}>
        <div className="grid gap-3 md:grid-cols-2">
          {client.content.filter((item) => item.scheduled_at).map((item) => (
            <Link key={item.id} href={`/content/${item.id}`} className="rounded-xl border bg-card p-4 hover:border-primary/40 hover:bg-primary/5">
              <p className="font-semibold">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatCairoDateTime(item.scheduled_at)}</p>
            </Link>
          ))}
        </div>
        {!client.content.some((item) => item.scheduled_at) && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No scheduled content yet.</p>}
      </SectionCard>

      <SectionCard id="reports" title="Reports" description="Client-ready reporting and delivery status." icon={FileText}>
        <div className="grid gap-3">
          {client.reports.map((report) => (
            <Link key={report.id} href={`/reports/${report.id}`} className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">{report.title}</p>
                <Badge variant="outline" className={statusTone(report.sent_to_client_at ? "sent" : "under_review")}>{report.sent_to_client_at ? "Sent" : "Review"}</Badge>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{report.body}</p>
            </Link>
          ))}
        </div>
        {!client.reports.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No reports yet.</p>}
      </SectionCard>

      <SectionCard id="insights" title="Insights" description="Lightweight delivery health for this account." icon={BarChart3}>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border bg-secondary/25 p-4"><p className="text-2xl font-semibold">{client.content.filter((item) => ["approved", "scheduled", "published"].includes(item.status)).length}</p><p className="text-sm text-muted-foreground">Approved / scheduled</p></div>
          <div className="rounded-lg border bg-secondary/25 p-4"><p className="text-2xl font-semibold">{client.ideas.filter((idea) => idea.status === "approved").length}</p><p className="text-sm text-muted-foreground">Approved ideas</p></div>
          <div className="rounded-lg border bg-secondary/25 p-4"><p className="text-2xl font-semibold">{client.reports.filter((report) => report.sent_to_client_at).length}</p><p className="text-sm text-muted-foreground">Sent reports</p></div>
        </div>
      </SectionCard>

      {context.role !== "client" && (
        <>
          <SectionCard id="chat" title="Chat" description="Recent client-scoped task comments." icon={MessageSquare}>
            <div className="grid gap-3">
              {canComment && client.tasks.length > 0 && (
                <form action={addTaskCommentAction} className="grid gap-3 rounded-xl border bg-secondary/20 p-4">
                  <input type="hidden" name="redirectTo" value={routes.clients.detail(client.id)} />
                  <Label htmlFor="chat-task">Add comment</Label>
                  <select id="chat-task" name="taskId" className={selectClass}>
                    {client.tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                  </select>
                  <Input name="body" placeholder="Add a client-specific update or handoff note" required />
                  <Button type="submit" variant="outline">Add comment</Button>
                </form>
              )}
              {recentComments.map((comment) => (
                <div key={comment.id} className="rounded-xl border bg-card p-4 text-sm">
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{comment.userName ?? "Unknown user"}</span>
                    <span>{formatCairoDateTime(comment.created_at)}</span>
                  </div>
                  <p>{comment.body}</p>
                </div>
              ))}
              {!recentComments.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No client comments yet.</p>}
            </div>
          </SectionCard>

          <SectionCard id="contact" title="Contact" description="Client contacts and assigned internal owners." icon={Users}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border bg-card p-4 text-sm">
                <p className="font-semibold">Client contact</p>
                <p className="mt-2 text-muted-foreground">{client.contact_person || "Not set"}</p>
                <p className="text-muted-foreground">{client.contact_email || "No email"}</p>
                <p className="text-muted-foreground">{client.contact_phone || "No phone"}</p>
              </div>
              <div className="grid gap-2">
                {client.assignedUsers.map((user) => (
                  <div key={user.id} className="rounded-xl border bg-card p-4 text-sm">
                    <p className="font-medium">{user.displayName}</p>
                    <p className="text-muted-foreground">{user.roleName}</p>
                  </div>
                ))}
                {!client.assignedUsers.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No assigned internal contacts yet.</p>}
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </section>
  );
}
