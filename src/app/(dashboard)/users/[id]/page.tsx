import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BriefcaseBusiness, CalendarDays, FileText, Lightbulb } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/context";
import { getOrgUserProfile } from "@/lib/users/queries";
import { formatCairoDateTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "User profile",
};

export default async function OrgUserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requirePermission("settings.profile", "view");
  const profile = await getOrgUserProfile(context, id);

  if (!profile) {
    notFound();
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Organization profile</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">{profile.displayName}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          View-only workspace profile with role, teams, clients, and visible work summary.
        </p>
      </div>

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
                <p className="mb-2 text-sm font-medium">Clients</p>
                <div className="flex flex-wrap gap-2">
                  {profile.clientNames.map((name) => <Badge key={name} variant="outline">{name}</Badge>)}
                  {!profile.clientNames.length && <span className="text-sm text-muted-foreground">No visible clients.</span>}
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
