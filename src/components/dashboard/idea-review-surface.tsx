import Link from "next/link";
import { CheckCircle2, Lightbulb, MessageSquare, RotateCcw, XCircle } from "lucide-react";

import { addCollaborationCommentAction } from "@/lib/collaboration/actions";
import { reviewIdeaAction } from "@/lib/workflows/actions";
import { getWorkflowIdeas } from "@/lib/workflows/queries";
import { hasPermission, type AuthContext } from "@/lib/auth/permissions";
import { formatCairoDateTime } from "@/lib/time";
import { routes } from "@/constants/routes";
import { PageMessage } from "@/components/admin/page-message";
import { FilterPanel } from "@/components/dashboard/filter-panel";
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

const reviewStatuses = ["submitted", "under_review"] as const;

function statusTone(status: string) {
  if (status === "approved") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  }

  if (status === "rejected") {
    return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200";
  }

  return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200";
}

export async function IdeaReviewSurface({
  context,
  searchParams,
}: {
  context: AuthContext;
  searchParams: { q?: string; status?: string; error?: string; notice?: string };
}) {
  const ideas = await getWorkflowIdeas(context, {
    search: searchParams.q,
    status: searchParams.status,
  });
  const reviewableIdeas = ideas.filter((idea) => reviewStatuses.includes(idea.status as (typeof reviewStatuses)[number]));
  const canDecide = hasPermission(context, "ideas.change_status", "limited");
  const canComment = hasPermission(context, "comments.create", "limited");

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Reviews"
        title="Idea reviews"
        description="Review submitted ideas, leave clear feedback, and move approved concepts toward production."
        actions={
          <PageActions>
            <FilterPanel
              title="Review filters"
              description="Only submitted and under-review ideas appear here."
              activeFilters={[
                { label: "Search", value: searchParams.q },
                { label: "Status", value: searchParams.status },
              ]}
            >
          <form action={routes.reviews.ideas} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <div className="space-y-2">
              <Label htmlFor="q">Search</Label>
              <Input id="q" name="q" defaultValue={searchParams.q ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={searchParams.status ?? "all"}
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="all">Review queue</option>
                {reviewStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status.replace("_", " ")}
                  </option>
                ))}
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
        {reviewableIdeas.map((idea) => (
          <Card key={idea.id}>
            <CardHeader>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>{idea.title}</CardTitle>
                  <CardDescription>{idea.description || "No description provided."}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={statusTone(idea.status)}>{idea.status.replace("_", " ")}</Badge>
                  {idea.clientName && <Badge variant="secondary">{idea.clientName}</Badge>}
                  {idea.teamName && <Badge variant="secondary">{idea.teamName}</Badge>}
                  <Badge variant="outline">{idea.idea_type}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-3 text-sm md:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Created by</p>
                  <p className="font-medium">{idea.creatorName ?? "Unknown"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Owner</p>
                  <p className="font-medium">{idea.assigneeName ?? "Unassigned"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Publishing</p>
                  <p className="font-medium">{formatCairoDateTime(idea.publishing_at)}</p>
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

              <Link href={`/ideas/${idea.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Open idea detail
              </Link>

              {canDecide && (
                <details className="rounded-lg border bg-secondary/20 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-primary">Review idea</summary>
                <form action={reviewIdeaAction} className="mt-3 grid gap-3">
                  <input type="hidden" name="ideaId" value={idea.id} />
                  <input type="hidden" name="redirectTo" value={routes.reviews.ideas} />
                  <div className="space-y-2">
                    <Label htmlFor={`feedback-${idea.id}`}>Review feedback</Label>
                    <Input id={`feedback-${idea.id}`} name="feedback" placeholder="Add clear feedback for the idea owner" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" name="decision" value="approved">
                      <CheckCircle2 />
                      Approve
                    </Button>
                    <Button type="submit" name="decision" value="revision_requested" variant="outline">
                      <RotateCcw />
                      Request revision
                    </Button>
                    <Button type="submit" name="decision" value="rejected" variant="outline">
                      <XCircle />
                      Decline
                    </Button>
                  </div>
                </form>
                </details>
              )}

              {!canDecide && canComment && (
                <details className="rounded-lg border bg-secondary/20 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-primary">Add feedback</summary>
                <form action={addCollaborationCommentAction} className="mt-3 grid gap-3">
                  <input type="hidden" name="entityType" value="idea" />
                  <input type="hidden" name="entityId" value={idea.id} />
                  <input type="hidden" name="redirectTo" value={routes.reviews.ideas} />
                  <Label htmlFor={`comment-${idea.id}`}>Feedback</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input id={`comment-${idea.id}`} name="body" placeholder="Add a comment for the reviewer or owner" required />
                    <Button type="submit" variant="outline">
                      <MessageSquare />
                      Add feedback
                    </Button>
                  </div>
                </form>
                </details>
              )}
            </CardContent>
          </Card>
        ))}

        {!reviewableIdeas.length && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Lightbulb className="mx-auto mb-3 size-8 text-primary" />
              No submitted ideas need review right now.
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
