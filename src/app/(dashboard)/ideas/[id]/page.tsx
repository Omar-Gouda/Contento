import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Save, Trash2 } from "lucide-react";

import {
  deleteIdeaAction,
  updateIdeaAction,
  updateIdeaStatusAction,
} from "@/lib/workflows/actions";
import {
  getWorkflowIdeaById,
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

export const metadata: Metadata = {
  title: "Idea detail",
};

const ideaStatuses = ["draft", "submitted", "under_review", "approved", "rejected", "archived"] as const;
const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function IdeaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requirePermission("ideas.review", "view");
  const [idea, users, teams] = await Promise.all([
    getWorkflowIdeaById(context, id),
    getWorkflowUsers(context),
    getWorkflowTeams(context),
  ]);

  if (!idea) {
    notFound();
  }

  const activeUsers = users.filter((user) => user.status === "active");
  const activeTeams = teams.filter((team) => team.status === "active");
  const canUpdate = hasPermission(context, "ideas.update", "limited");
  const canChangeStatus = hasPermission(context, "ideas.change_status", "limited");

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Idea detail</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">{idea.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {idea.description || "No description provided."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Idea state</CardTitle>
              <CardDescription>Review ownership, assignment, team scope, and notes.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>{idea.status}</Badge>
              {idea.clientName && <Badge variant="secondary">{idea.clientName}</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Client</p>
            {idea.client_id ? (
              <Link href={routes.clients.detail(idea.client_id)} className="font-medium text-primary hover:underline">
                {idea.clientName ?? "Open client"}
              </Link>
            ) : (
              <p className="font-medium">No client</p>
            )}
          </div>
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
            <p className="text-muted-foreground">Updated</p>
            <p className="font-medium">{formatCairoDateTime(idea.updated_at)}</p>
          </div>
        </CardContent>
      </Card>

      {idea.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{idea.notes}</CardContent>
        </Card>
      )}

      {canUpdate && (
        <Card>
          <CardHeader>
            <CardTitle>Edit idea</CardTitle>
            <CardDescription>Update details while preserving company and role scope.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateIdeaAction} className="grid gap-3 lg:grid-cols-3">
              <input type="hidden" name="ideaId" value={idea.id} />
              <input type="hidden" name="redirectTo" value={`/ideas/${idea.id}`} />
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" defaultValue={idea.title} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignedTo">Assignee</Label>
                <select id="assignedTo" name="assignedTo" defaultValue={idea.assigned_to ?? ""} className={selectClass}>
                  <option value="">Unassigned</option>
                  {activeUsers.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="teamId">Team</Label>
                <select id="teamId" name="teamId" defaultValue={idea.team_id ?? ""} className={selectClass}>
                  <option value="">No team</option>
                  {activeTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
              </div>
              <div className="space-y-2 lg:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" defaultValue={idea.description} />
              </div>
              <div className="space-y-2 lg:col-span-3">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" name="notes" defaultValue={idea.notes} />
              </div>
              <input type="hidden" name="clientId" value={idea.client_id ?? ""} />
              <input type="hidden" name="ideaType" value={idea.idea_type} />
              {idea.platforms.map((platform) => (
                <input key={platform} type="hidden" name="platforms" value={platform} />
              ))}
              <input type="hidden" name="headline" value={idea.headline ?? ""} />
              <input type="hidden" name="subtext" value={idea.subtext ?? ""} />
              <input type="hidden" name="visual" value={idea.visual ?? ""} />
              <input type="hidden" name="cta" value={idea.cta ?? ""} />
              <input type="hidden" name="script" value={idea.script ?? ""} />
              <input type="hidden" name="urgency" value={idea.urgency} />
              <input type="hidden" name="publishingAt" value={idea.publishing_at ?? ""} />
              <input type="hidden" name="finalDriveLink" value={idea.final_drive_link ?? ""} />
              <Button type="submit" variant="outline">
                <Save />
                Save idea
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        {canChangeStatus && (
          <form action={updateIdeaStatusAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="ideaId" value={idea.id} />
            <input type="hidden" name="redirectTo" value={`/ideas/${idea.id}`} />
            <select name="status" defaultValue={idea.status} className={selectClass}>
              {ideaStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <Button type="submit" variant="outline" size="sm">Update status</Button>
          </form>
        )}
        {canUpdate && (
          <form action={deleteIdeaAction}>
            <input type="hidden" name="ideaId" value={idea.id} />
            <input type="hidden" name="redirectTo" value="/ideas" />
            <Button type="submit" variant="destructive" size="sm">
              <Trash2 />
              Delete idea
            </Button>
          </form>
        )}
      </div>

      <CollaborationPanel context={context} entityType="idea" entityId={idea.id} redirectTo={`/ideas/${idea.id}`} />
    </section>
  );
}
