import Link from "next/link";
import { CalendarClock, CheckCircle2, FileText, Plus, Send, Star } from "lucide-react";

import {
  createContentAction,
  submitContentFinalOutputAction,
  rateContentAction,
  reviewContentAction,
  scheduleContentAction,
  submitContentAction,
} from "@/lib/workflows/actions";
import { getClients } from "@/lib/clients/queries";
import { getContentTemplates } from "@/lib/content-templates/queries";
import {
  getWorkflowContent,
  getWorkflowContentRatings,
  getWorkflowContentReviews,
  getWorkflowIdeas,
  getWorkflowTasks,
  getWorkflowTeams,
  getWorkflowUsers,
} from "@/lib/workflows/queries";
import { routes } from "@/constants/routes";
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

const contentStatuses = [
  "draft",
  "submitted_to_team_lead",
  "changes_requested_by_team_lead",
  "sent_to_supervisor",
  "changes_requested_by_supervisor",
  "approved",
  "rejected",
  "scheduled",
  "published",
  "archived",
] as const;
const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function statusVariant(status: string) {
  if (status === "approved" || status === "scheduled" || status === "published") {
    return "default";
  }

  if (status === "archived") {
    return "secondary";
  }

  return "outline";
}

function canSubmitStatus(status: string) {
  return status === "draft" || status === "changes_requested_by_team_lead" || status === "changes_requested_by_supervisor";
}

function reviewOptions(role: AuthContext["role"], status: string) {
  if (role === "creator") {
    return [];
  }

  if (role === "team-lead" && (status === "submitted_to_team_lead" || status === "changes_requested_by_supervisor")) {
    return [
      { value: "send_to_supervisor", label: "Send to Account Manager" },
      { value: "changes_requested", label: "Request changes" },
    ];
  }

  if (role === "supervisor" && status === "sent_to_supervisor") {
    return [
      { value: "approved", label: "Approve" },
      { value: "changes_requested", label: "Request changes" },
      { value: "rejected", label: "Reject" },
    ];
  }

  if (role === "admin" && status !== "draft") {
    return [
      { value: "approved", label: "Approve" },
      { value: "changes_requested", label: "Request changes" },
      { value: "rejected", label: "Reject" },
      { value: "send_to_supervisor", label: "Send to Account Manager" },
    ];
  }

  return [];
}

function scoreOptions() {
  return [5, 4, 3, 2, 1].map((value) => (
    <option key={value} value={value}>{value}</option>
  ));
}

function isVisibleInReviewMode(context: AuthContext, status: string, creatorId: string | null) {
  if (context.role === "creator") {
    return creatorId === context.userId && status !== "draft";
  }

  if (context.role === "team-lead") {
    return status === "submitted_to_team_lead" || status === "changes_requested_by_supervisor";
  }

  if (context.role === "supervisor") {
    return status === "sent_to_supervisor";
  }

  return status !== "draft";
}

export async function ContentSurface({
  context,
  mode,
  searchParams,
}: {
  context: AuthContext;
  mode: "pipeline" | "reviews";
  searchParams: { q?: string; status?: string; team?: string; client?: string; error?: string; notice?: string };
}) {
  const [content, users, tasks, ideas, teams, reviews, ratings, templates] = await Promise.all([
    getWorkflowContent(context, { search: searchParams.q, status: searchParams.status, teamId: searchParams.team, clientId: searchParams.client }),
    getWorkflowUsers(context),
    getWorkflowTasks(context, { status: "all" }),
    getWorkflowIdeas(context, { status: "all" }),
    getWorkflowTeams(context),
    getWorkflowContentReviews(context),
    getWorkflowContentRatings(context),
    getContentTemplates(context),
  ]);
  const clients = await getClients(context);
  const activeUsers = users.filter((user) => user.status === "active");
  const openTasks = tasks.filter((task) => task.status !== "closed");
  const activeIdeas = ideas.filter((idea) => idea.status !== "archived" && idea.status !== "rejected");
  const activeTeams = teams.filter((team) => team.status === "active");
  const activeClients = clients.filter((client) => client.status === "active");
  const activeTemplates = templates.filter((template) => template.status === "active");
  const canCreate = hasPermission(context, "content.create", "limited");
  const canSubmit = hasPermission(context, "content.submit", "limited");
  const canFinalOutput = hasPermission(context, "content.final_output", "limited");
  const canReview = hasPermission(context, "reviews.add_feedback", "limited");
  const canRate = hasPermission(context, "content.rate", "limited");
  const canSchedule = hasPermission(context, "calendar.schedule_content", "limited");
  const basePath = mode === "reviews" ? routes.reviews.content : routes.content.home;
  const reviewableContent = mode === "reviews"
    ? content.filter((item) => isVisibleInReviewMode(context, item.status, item.creator_id))
    : content;

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Content pipeline</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
          {mode === "reviews" ? "Content reviews" : "Content"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {mode === "reviews"
            ? "Review submitted content through the Team Lead and Account Manager handoff flow."
            : "Create drafts, submit work to team lead review, and schedule approved content."}
        </p>
      </div>

      <PageMessage error={searchParams.error} status={searchParams.notice} />

      {mode === "pipeline" && canCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create content item</CardTitle>
            <CardDescription>Start a draft, assign a Content Creator, and optionally link it to an active task.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createContentAction} className="grid gap-4 lg:grid-cols-4">
              <input type="hidden" name="redirectTo" value="/content" />
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="creatorId">Content Creator</Label>
                <select id="creatorId" name="creatorId" className={selectClass} defaultValue={context.userId}>
                  {activeUsers.map((user) => (
                    <option key={user.id} value={user.id}>{user.displayName}</option>
                  ))}
                </select>
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
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="templateId">Template</Label>
                <select id="templateId" name="templateId" className={selectClass}>
                  <option value="">No template</option>
                  {activeTemplates.map((template) => (
                    <option key={template.id} value={template.id}>{template.title}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taskId">Linked task</Label>
                <select id="taskId" name="taskId" className={selectClass}>
                  <option value="">No task</option>
                  {openTasks.map((task) => (
                    <option key={task.id} value={task.id}>{task.title}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ideaId">Linked idea</Label>
                <select id="ideaId" name="ideaId" className={selectClass}>
                  <option value="">No idea</option>
                  {activeIdeas.map((idea) => (
                    <option key={idea.id} value={idea.id}>{idea.title}</option>
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
                <Label htmlFor="finalDriveLink">Final Drive link</Label>
                <Input id="finalDriveLink" name="finalDriveLink" type="url" placeholder="https://drive.google.com/..." />
              </div>
              <div className="lg:col-span-4">
                <Button type="submit">
                  <Plus />
                  Create content
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {mode === "pipeline" && (
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter content by status or title.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/content" className="grid gap-3 md:grid-cols-[1fr_180px_180px_180px_auto]">
              <div className="space-y-2">
                <Label htmlFor="q">Search</Label>
                <Input id="q" name="q" defaultValue={searchParams.q ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select id="status" name="status" defaultValue={searchParams.status ?? "all"} className={selectClass}>
                  <option value="all">All statuses</option>
                  {contentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
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
                <Button type="submit" className="w-full md:w-auto">Apply</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {reviewableContent.map((item) => {
          const itemReviews = reviews.filter((review) => review.content_id === item.id);
          const itemRatings = ratings.filter((rating) => rating.content_id === item.id);
          const options = reviewOptions(context.role, item.status);
          const canReviewItem = mode === "reviews" && canReview && options.length > 0;
          const canRateItem = canReviewItem && canRate && (context.role === "admin" || item.creator_id !== context.userId);

          return (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription>{item.description || "No description provided."}</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                    {item.clientName && <Badge variant="secondary">{item.clientName}</Badge>}
                    {item.taskTitle && <Badge variant="secondary">{item.taskTitle}</Badge>}
                    {item.ideaTitle && <Badge variant="secondary">{item.ideaTitle}</Badge>}
                    {item.teamName && <Badge variant="secondary">{item.teamName}</Badge>}
                    {item.averageRating && <Badge variant="secondary">{item.averageRating}/5 rating</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="grid gap-3 text-sm md:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Content Creator</p>
                    <p className="font-medium">{item.creatorName ?? "Unassigned"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Client</p>
                    {item.client_id ? (
                      <Link href={routes.clients.detail(item.client_id)} className="font-medium text-primary hover:underline">
                        {item.clientName ?? "Open client"}
                      </Link>
                    ) : (
                      <p className="font-medium">No client</p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Submitted</p>
                    <p className="font-medium">{formatCairoDateTime(item.submitted_at)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Approved</p>
                    <p className="font-medium">{formatCairoDateTime(item.approved_at)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Scheduled</p>
                    <p className="font-medium">{formatCairoDateTime(item.scheduled_at)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Final Drive</p>
                    {item.final_drive_link ? (
                      <a href={item.final_drive_link} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                        Open link
                      </a>
                    ) : (
                      <p className="font-medium">No final link</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link href={`/content/${item.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                    Open content detail
                  </Link>

                  {mode === "pipeline" && canSubmit && canSubmitStatus(item.status) && item.creator_id === context.userId && (
                    <form action={submitContentAction}>
                      <input type="hidden" name="contentId" value={item.id} />
                      <input type="hidden" name="redirectTo" value={basePath} />
                      <Button type="submit" variant="outline" size="sm">
                        <Send />
                        Submit
                      </Button>
                    </form>
                  )}

                  {mode === "pipeline" && canSchedule && item.status === "approved" && (
                    <form action={scheduleContentAction} className="flex flex-wrap gap-2">
                      <input type="hidden" name="contentId" value={item.id} />
                      <input type="hidden" name="redirectTo" value={basePath} />
                      <Input name="scheduledAt" type="datetime-local" className="w-56" required />
                      <Button type="submit" variant="outline" size="sm">
                        <CalendarClock />
                        Schedule
                      </Button>
                    </form>
                  )}

                  {canFinalOutput && (
                    <form action={submitContentFinalOutputAction} className="flex flex-col gap-2 rounded-lg border bg-secondary/20 p-3">
                      <input type="hidden" name="contentId" value={item.id} />
                      <input type="hidden" name="redirectTo" value={basePath} />
                      <Label htmlFor={`final-${item.id}`}>Final Drive link</Label>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          id={`final-${item.id}`}
                          name="finalDriveLink"
                          defaultValue={item.final_drive_link ?? ""}
                          type="url"
                          placeholder="https://drive.google.com/..."
                          required
                        />
                        <Button type="submit" variant="outline" size="sm">Save final</Button>
                      </div>
                    </form>
                  )}
                </div>

                {canReviewItem && (
                  <form action={reviewContentAction} className="grid gap-3 rounded-lg border bg-secondary/30 p-3">
                    <input type="hidden" name="contentId" value={item.id} />
                    <input type="hidden" name="redirectTo" value={routes.reviews.content} />
                    <div className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
                      <div className="space-y-2">
                        <Label htmlFor={`decision-${item.id}`}>Decision</Label>
                        <select id={`decision-${item.id}`} name="decision" className={selectClass}>
                          {options.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`feedback-${item.id}`}>Feedback</Label>
                        <Input id={`feedback-${item.id}`} name="feedback" />
                      </div>
                      <div className="flex items-end">
                        <Button type="submit">
                          <CheckCircle2 />
                          Save review
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-5">
                      <div className="space-y-2">
                        <Label htmlFor={`quality-${item.id}`}>Quality</Label>
                        <select id={`quality-${item.id}`} name="qualityScore" className={selectClass} defaultValue="5">
                          {scoreOptions()}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`creativity-${item.id}`}>Creativity</Label>
                        <select id={`creativity-${item.id}`} name="creativityScore" className={selectClass} defaultValue="5">
                          {scoreOptions()}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`accuracy-${item.id}`}>Accuracy</Label>
                        <select id={`accuracy-${item.id}`} name="accuracyScore" className={selectClass} defaultValue="5">
                          {scoreOptions()}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`overall-${item.id}`}>Overall</Label>
                        <select id={`overall-${item.id}`} name="overallRating" className={selectClass} defaultValue="5">
                          {scoreOptions()}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`score-comment-${item.id}`}>Score note</Label>
                        <Input id={`score-comment-${item.id}`} name="scoreComment" />
                      </div>
                    </div>
                  </form>
                )}

                {canRateItem && (
                  <form action={rateContentAction} className="grid gap-3 rounded-lg border bg-background p-3">
                    <input type="hidden" name="contentId" value={item.id} />
                    <input type="hidden" name="redirectTo" value={routes.reviews.content} />
                    <div className="grid gap-3 md:grid-cols-[140px_1fr_auto]">
                      <div className="space-y-2">
                        <Label htmlFor={`rating-${item.id}`}>Rating</Label>
                        <select id={`rating-${item.id}`} name="ratingValue" className={selectClass} defaultValue="5">
                          {[5, 4, 3, 2, 1].map((value) => (
                            <option key={value} value={value}>{value}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`rating-comment-${item.id}`}>Rating note</Label>
                        <Input id={`rating-comment-${item.id}`} name="comment" />
                      </div>
                      <div className="flex items-end">
                        <Button type="submit" variant="outline">
                          <Star />
                          Save rating
                        </Button>
                      </div>
                    </div>
                  </form>
                )}

                {itemReviews.length > 0 && (
                  <div className="grid gap-2">
                    {itemReviews.slice(0, 3).map((review) => (
                      <div key={review.id} className="rounded-lg border bg-background p-3 text-sm">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>{review.reviewerName ?? "Unknown reviewer"}</span>
                          <span>{formatCairoDateTime(review.reviewed_at)}</span>
                        </div>
                        <Badge variant={review.decision === "approved" ? "default" : "secondary"}>{review.decision}</Badge>
                        {review.overall_rating && <Badge variant="outline">{review.overall_rating}/5 overall</Badge>}
                        {review.feedback && <p className="mt-2">{review.feedback}</p>}
                        {review.score_comment && <p className="mt-1 text-muted-foreground">{review.score_comment}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {itemRatings.length > 0 && (
                  <div className="grid gap-2">
                    {itemRatings.slice(0, 3).map((rating) => (
                      <div key={rating.id} className="rounded-lg border bg-background p-3 text-sm">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>{rating.reviewerName ?? "Unknown reviewer"}</span>
                          <span>{formatCairoDateTime(rating.created_at)}</span>
                        </div>
                        <Badge variant="secondary">{rating.rating_value}/5</Badge>
                        {rating.comment && <p className="mt-2">{rating.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {!reviewableContent.length && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <FileText className="mx-auto mb-3 size-8 text-primary" />
              No content items match this view.
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
