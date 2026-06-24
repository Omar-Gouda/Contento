import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2, Send, Star } from "lucide-react";

import {
  rateContentAction,
  reviewContentAction,
  scheduleContentAction,
  submitContentAction,
} from "@/lib/workflows/actions";
import {
  getWorkflowContentById,
  getWorkflowContentRatings,
  getWorkflowContentReviews,
} from "@/lib/workflows/queries";
import { requirePermission } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import { formatCairoDateTime } from "@/lib/time";
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
import { PageMessage } from "@/components/admin/page-message";

export const metadata: Metadata = {
  title: "Content detail",
};

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function canSubmitStatus(status: string) {
  return status === "draft" || status === "changes_requested_by_team_lead" || status === "changes_requested_by_supervisor";
}

function reviewOptions(role: "admin" | "supervisor" | "team-lead" | "creator", status: string) {
  if (role === "creator") {
    return [];
  }

  if (role === "team-lead" && (status === "submitted_to_team_lead" || status === "changes_requested_by_supervisor")) {
    return [
      { value: "send_to_supervisor", label: "Send to supervisor" },
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
      { value: "send_to_supervisor", label: "Send to supervisor" },
    ];
  }

  return [];
}

export default async function ContentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ id }, messages] = await Promise.all([params, searchParams]);
  const context = await requirePermission("content.track_pipeline", "view");
  const [content, reviews, ratings] = await Promise.all([
    getWorkflowContentById(context, id),
    getWorkflowContentReviews(context, [id]),
    getWorkflowContentRatings(context, [id]),
  ]);

  if (!content) {
    notFound();
  }

  const canSubmit = hasPermission(context, "content.submit", "limited");
  const canReview = hasPermission(context, "reviews.add_feedback", "limited");
  const canRate = hasPermission(context, "content.rate", "limited");
  const canSchedule = hasPermission(context, "calendar.schedule_content", "limited");
  const options = reviewOptions(context.role, content.status);
  const canSubmitCurrent = canSubmit && canSubmitStatus(content.status) && content.creator_id === context.userId;
  const canReviewCurrent = canReview && options.length > 0;
  const canRateCurrent = canReviewCurrent && canRate && (context.role === "admin" || content.creator_id !== context.userId);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Content detail</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">{content.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {content.description || "No description provided."}
        </p>
      </div>

      <PageMessage error={messages.error} status={messages.notice} />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Pipeline state</CardTitle>
              <CardDescription>Review linked task, idea, team, and schedule context.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{content.status}</Badge>
              {content.teamName && <Badge variant="secondary">{content.teamName}</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Creator</p>
            <p className="font-medium">{content.creatorName ?? "Unassigned"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Task</p>
            <p className="font-medium">{content.taskTitle ?? "No task"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Idea</p>
            <p className="font-medium">{content.ideaTitle ?? "No idea"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Updated</p>
            <p className="font-medium">{formatCairoDateTime(content.updated_at)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Submitted</p>
            <p className="font-medium">{formatCairoDateTime(content.submitted_at)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Approved</p>
            <p className="font-medium">{formatCairoDateTime(content.approved_at)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Scheduled</p>
            <p className="font-medium">{formatCairoDateTime(content.scheduled_at)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Published</p>
            <p className="font-medium">{formatCairoDateTime(content.published_at)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        {canSubmitCurrent && (
          <form action={submitContentAction}>
            <input type="hidden" name="contentId" value={content.id} />
            <input type="hidden" name="redirectTo" value={`/content/${content.id}`} />
            <Button type="submit" variant="outline">
              <Send />
              Submit
            </Button>
          </form>
        )}

        {canSchedule && content.status === "approved" && (
          <form action={scheduleContentAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="contentId" value={content.id} />
            <input type="hidden" name="redirectTo" value={`/content/${content.id}`} />
            <Input name="scheduledAt" type="datetime-local" className="w-56" required />
            <Button type="submit" variant="outline">
              <CalendarClock />
              Schedule
            </Button>
          </form>
        )}
      </div>

      {canReviewCurrent && (
        <Card>
          <CardHeader>
            <CardTitle>Review content</CardTitle>
            <CardDescription>Move submitted content through the team lead and supervisor review flow.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={reviewContentAction} className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
              <input type="hidden" name="contentId" value={content.id} />
              <input type="hidden" name="redirectTo" value={`/content/${content.id}`} />
              <div className="space-y-2">
                <Label htmlFor="decision">Decision</Label>
                <select id="decision" name="decision" className={selectClass}>
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="feedback">Feedback</Label>
                <Input id="feedback" name="feedback" />
              </div>
              <div className="flex items-end">
                <Button type="submit">
                  <CheckCircle2 />
                  Save review
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {canRateCurrent && (
        <Card>
          <CardHeader>
            <CardTitle>Rate content</CardTitle>
            <CardDescription>Attach a reviewer rating to this submitted content item.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={rateContentAction} className="grid gap-3 md:grid-cols-[140px_1fr_auto]">
              <input type="hidden" name="contentId" value={content.id} />
              <input type="hidden" name="redirectTo" value={`/content/${content.id}`} />
              <div className="space-y-2">
                <Label htmlFor="ratingValue">Rating</Label>
                <select id="ratingValue" name="ratingValue" className={selectClass} defaultValue="5">
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>{value}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ratingComment">Rating note</Label>
                <Input id="ratingComment" name="comment" />
              </div>
              <div className="flex items-end">
                <Button type="submit" variant="outline">
                  <Star />
                  Save rating
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Review history</CardTitle>
          <CardDescription>{reviews.length} review records linked to this content item.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-lg border bg-secondary/25 p-3 text-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{review.reviewerName ?? "Unknown reviewer"}</span>
                <span>{formatCairoDateTime(review.reviewed_at)}</span>
              </div>
              <Badge variant={review.decision === "approved" ? "default" : "secondary"}>{review.decision}</Badge>
              {review.feedback && <p className="mt-2">{review.feedback}</p>}
            </div>
          ))}
          {!reviews.length && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No reviews have been recorded yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ratings</CardTitle>
          <CardDescription>{ratings.length} rating records linked to this content item.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {ratings.map((rating) => (
            <div key={rating.id} className="rounded-lg border bg-secondary/25 p-3 text-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{rating.reviewerName ?? "Unknown reviewer"}</span>
                <span>{formatCairoDateTime(rating.created_at)}</span>
              </div>
              <Badge variant="secondary">{rating.rating_value}/5</Badge>
              {rating.comment && <p className="mt-2">{rating.comment}</p>}
            </div>
          ))}
          {!ratings.length && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No ratings have been recorded yet.
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
