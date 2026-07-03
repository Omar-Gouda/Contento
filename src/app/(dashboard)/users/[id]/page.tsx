import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BriefcaseBusiness, CalendarDays, FileText, Lightbulb, Plus } from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { FormSheet } from "@/components/dashboard/form-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { requirePermission } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import { assignClientUserAction, removeClientUserAssignmentAction } from "@/lib/clients/actions";
import { getClients } from "@/lib/clients/queries";
import { getOrgUserProfile } from "@/lib/users/queries";
import { formatCairoDateTime } from "@/lib/time";
import { isProductionRole, normalizeRoleName } from "@/types/roles";

export const metadata: Metadata = {
  title: "User profile",
};

export default async function OrgUserProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ id }, messages] = await Promise.all([params, searchParams]);
  const context = await requirePermission("settings.profile", "view");
  const profile = await getOrgUserProfile(context, id);

  if (!profile) {
    notFound();
  }

  const canManageAllClientAssignments =
    hasPermission(context, "clients.assign", "full") ||
    hasPermission(context, "clients.assign_account_manager", "full");
  const canManageScopedClientAssignments =
    context.role === "supervisor" &&
    (
      hasPermission(context, "clients.assign", "limited") ||
      hasPermission(context, "clients.assign_account_manager", "limited")
    );
  const profileRoleKey = normalizeRoleName(profile.roleName);
  const canManageClientAssignments =
    canManageAllClientAssignments ||
    (canManageScopedClientAssignments && isProductionRole(profileRoleKey));
  const visibleClients = canManageClientAssignments ? await getClients(context) : [];
  const assignedClientKeys = new Set(
    profile.clientAssignments.map((assignment) => `${assignment.clientId}:${assignment.assignmentRole}`)
  );
  const availableClients = visibleClients.filter((client) => {
    if (profileRoleKey === "supervisor") {
      return !assignedClientKeys.has(`${client.id}:account_manager`);
    }

    if (profileRoleKey === "creator") {
      return !assignedClientKeys.has(`${client.id}:content_creator`);
    }

    if (profileRoleKey === "graphic-designer") {
      return !assignedClientKeys.has(`${client.id}:graphic_designer`);
    }

    if (profileRoleKey === "video-editor") {
      return !assignedClientKeys.has(`${client.id}:video_editor`);
    }

    if (profileRoleKey === "client") {
      return !assignedClientKeys.has(`${client.id}:client_contact`);
    }

    return !assignedClientKeys.has(`${client.id}:member`);
  });

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Organization profile</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">{profile.displayName}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          View-only workspace profile with role, teams, clients, and visible work summary.
        </p>
      </div>

      <PageMessage error={messages.error} status={messages.notice} />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Managed by organization permissions.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border bg-secondary text-xl font-semibold text-primary">
              {profile.avatarSignedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarSignedUrl} alt="" className="size-full object-cover" />
              ) : (
                profile.displayName.slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <p className="text-xl font-semibold">{profile.displayName}</p>
              <p className="mt-1 text-sm text-muted-foreground">{profile.email}</p>
            </div>
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Role</span>
                <Badge>{profile.roleName}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={profile.status === "active" ? "default" : "secondary"}>{profile.status}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Joined</span>
                <span className="font-medium">{formatCairoDateTime(profile.created_at)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <BriefcaseBusiness className="size-4 text-primary" />
                <CardTitle>{profile.taskCount}</CardTitle>
                <CardDescription>Assigned tasks</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Lightbulb className="size-4 text-primary" />
                <CardTitle>{profile.ideaCount}</CardTitle>
                <CardDescription>Assigned ideas</CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <FileText className="size-4 text-primary" />
                <CardTitle>{profile.contentCount}</CardTitle>
                <CardDescription>Content items</CardDescription>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Teams and clients</CardTitle>
              <CardDescription>Visible assignments for this user.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium">Teams</p>
                <div className="flex flex-wrap gap-2">
                  {profile.teamNames.map((name) => <Badge key={name} variant="secondary">{name}</Badge>)}
                  {!profile.teamNames.length && <span className="text-sm text-muted-foreground">No visible teams.</span>}
                </div>
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Assigned clients</p>
                  {canManageClientAssignments && (
                    <FormSheet
                      title="Assign client"
                      description="Assign this existing user to an existing client workspace."
                      triggerLabel="Add client"
                    >
                      <form action={assignClientUserAction} className="grid gap-4">
                        <input type="hidden" name="userId" value={profile.id} />
                        <input type="hidden" name="redirectTo" value={`/users/${profile.id}`} />
                        <div className="space-y-2">
                          <Label htmlFor="profile-client-assignment">Client</Label>
                          <select
                            id="profile-client-assignment"
                            name="clientId"
                            required
                            disabled={!availableClients.length}
                            className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                          >
                            <option value="">Choose client</option>
                            {availableClients.map((client) => (
                              <option key={client.id} value={client.id}>
                                {client.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {!availableClients.length && (
                          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                            No clients are available for this assignment scope.
                          </p>
                        )}
                        <Button type="submit" disabled={!availableClients.length}>
                          <Plus />
                          Assign client
                        </Button>
                      </form>
                    </FormSheet>
                  )}
                </div>
                <div className="grid gap-2">
                  {profile.clientAssignments.map((assignment) => (
                    <div key={`${assignment.clientId}-${assignment.assignmentRole}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-secondary/25 p-3">
                      <div>
                        <p className="text-sm font-medium">{assignment.clientName}</p>
                        <p className="text-xs capitalize text-muted-foreground">{assignment.assignmentRole.replaceAll("_", " ")}</p>
                      </div>
                      {canManageClientAssignments && (
                        <form action={removeClientUserAssignmentAction}>
                          <input type="hidden" name="clientId" value={assignment.clientId} />
                          <input type="hidden" name="userId" value={profile.id} />
                          <input type="hidden" name="assignmentRole" value={assignment.assignmentRole} />
                          <input type="hidden" name="redirectTo" value={`/users/${profile.id}`} />
                          <Button type="submit" variant="outline" size="sm">
                            Remove
                          </Button>
                        </form>
                      )}
                    </div>
                  ))}
                  {!profile.clientAssignments.length && <span className="text-sm text-muted-foreground">No clients assigned yet.</span>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CalendarDays className="size-4 text-primary" />
              <CardTitle>Privacy</CardTitle>
              <CardDescription>
                This page is read-only and only shows organization-scoped profile and work summary information.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </section>
  );
}
