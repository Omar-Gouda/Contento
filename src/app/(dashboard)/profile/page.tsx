import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  KeyRound,
  Save,
  ShieldCheck,
  User,
} from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { FormSheet } from "@/components/dashboard/form-sheet";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarUpload } from "@/components/forms/avatar-upload";
import { ChangePasswordForm } from "@/components/forms/change-password-form";

import { routes } from "@/constants/routes";
import { requirePermission } from "@/lib/auth/context";
import { updateProfileAction } from "@/lib/settings/actions";
import { getProfileData } from "@/lib/settings/queries";
import { formatCairoDateTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Profile",
};

function displayDate(value: string | null) {
  return value ? formatCairoDateTime(value) : "Not recorded";
}

function minutesLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (!hours) {
    return `${remainder}m`;
  }

  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function humanizeAction(action: string) {
  return action.replace(/\./g, " ").replace(/_/g, " ");
}

function humanizeAssignmentRole(role: string) {
  return role.replace(/_/g, " ");
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("settings.profile", "view");
  const profile = await getProfileData(context);
  const displayName = `${profile.first_name} ${profile.last_name}`.trim() || profile.email;

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Profile</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Manage your personal details without changing role, company, or team assignment.
        </p>
      </div>

      <PageMessage error={params.error} status={params.notice} />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>Your public workspace identity.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <AvatarUpload
              initialAvatarUrl={profile.avatarSignedUrl}
              displayName={displayName}
            />
            <div>
              <p className="text-xl font-semibold">{displayName}</p>
              <p className="mt-1 text-sm text-muted-foreground">{profile.email}</p>
            </div>
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Role</span>
                <Badge>{profile.roleName}</Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Team</span>
                <span className="font-medium">{profile.teamName ?? "No team"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={profile.status === "active" ? "default" : "secondary"}>{profile.status}</Badge>
              </div>
              <div className="space-y-2 rounded-lg border bg-secondary/25 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Completion</span>
                  <span className="font-semibold">{profile.profileCompletionPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${profile.profileCompletionPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-4 text-primary" />
              Personal details
            </CardTitle>
            <CardDescription>Your name is used across tasks, reviews, reports, and audit logs.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-3 rounded-lg border bg-secondary/25 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">First name</span>
                <span className="font-medium">{profile.first_name}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Last name</span>
                <span className="font-medium">{profile.last_name}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Email</span>
                <span className="truncate font-medium">{profile.email}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium">{profile.phone || "Not added"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Job title</span>
                <span className="font-medium">{profile.job_title || "Not added"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Timezone</span>
                <span className="font-medium">{profile.timezone}</span>
              </div>
            </div>
            <div className="mb-4 rounded-lg border bg-background p-4 text-sm">
              <p className="text-muted-foreground">Bio</p>
              <p className="mt-2 leading-6">{profile.bio || "No bio added yet."}</p>
            </div>
            <FormSheet
              title="Edit profile"
              description="Update your personal details and notification preferences. Role, team, and company assignment stay controlled by workspace permissions."
              triggerLabel="Edit profile"
            >
              <form action={updateProfileAction} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input id="firstName" name="firstName" defaultValue={profile.first_name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" name="lastName" defaultValue={profile.last_name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" defaultValue={profile.phone ?? ""} autoComplete="tel" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Job title</Label>
                  <Input id="jobTitle" name="jobTitle" defaultValue={profile.job_title ?? ""} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Email</Label>
                  <Input value={profile.email} readOnly />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input id="timezone" name="timezone" defaultValue={profile.timezone} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="bio">Bio</Label>
                  <textarea
                    id="bio"
                    name="bio"
                    defaultValue={profile.bio}
                    rows={4}
                    className="min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>
                <div className="grid gap-3 rounded-lg border bg-secondary/30 p-3 md:col-span-2">
                  <p className="text-sm font-medium">Notification preferences</p>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="notificationSound" defaultChecked={profile.notificationPreferences.sound} className="size-4" />
                    Sound for new notifications
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="notificationToast" defaultChecked={profile.notificationPreferences.toast} className="size-4" />
                    Toast notifications
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="notificationDesktop" defaultChecked={profile.notificationPreferences.desktop} className="size-4" />
                    Desktop push when available
                  </label>
                </div>
                <div className="md:col-span-2">
                  <Button type="submit">
                    <Save />
                    Save profile
                  </Button>
                </div>
              </form>
            </FormSheet>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              Organization
            </CardTitle>
            <CardDescription>Workspace and assignment context.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Organization</span>
              <span className="font-medium">{profile.companyName}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Teams</span>
              <span className="text-right font-medium">{profile.teamNames.length ? profile.teamNames.join(", ") : "No team"}</span>
            </div>
            <div className="grid gap-2">
              <span className="text-muted-foreground">Assigned clients</span>
              <div className="flex flex-wrap gap-2">
                {profile.assignedClients.map((client) => (
                  <Badge key={`${client.clientId}-${client.assignmentRole}`} variant="secondary">
                    {client.clientName} - {humanizeAssignmentRole(client.assignmentRole)}
                  </Badge>
                ))}
                {!profile.assignedClients.length && <span className="text-muted-foreground">No clients assigned.</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-primary" />
              Work hours
            </CardTitle>
            <CardDescription>Today&apos;s work summary.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={profile.workHours?.activeWorkSession ? "default" : "secondary"}>
                {profile.workHours?.activeBreakSession ? "On break" : profile.workHours?.activeWorkSession ? "Working" : "Not clocked in"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Worked</span>
              <span className="font-medium">{minutesLabel(profile.workHours?.workedMinutes ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Break used</span>
              <span className="font-medium">{minutesLabel(profile.workHours?.breakMinutes ?? 0)}</span>
            </div>
            <Link href={routes.profile.workHours} className={buttonVariants({ variant: "outline" })}>
              <Clock />
              Open work hours
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              Security
            </CardTitle>
            <CardDescription>Password and account timeline.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">{formatCairoDateTime(profile.created_at)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Last login</span>
              <span className="font-medium">{displayDate(profile.last_login_at)}</span>
            </div>
            <FormSheet
              title="Change password"
              description="Update your password without leaving your profile."
              triggerLabel="Change password"
              triggerIcon={<KeyRound />}
            >
              <ChangePasswordForm variant="plain" />
            </FormSheet>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              Recent activity
            </CardTitle>
            <CardDescription>Your latest audited workspace actions.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {profile.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between gap-3 rounded-lg border bg-secondary/25 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium capitalize">{humanizeAction(activity.action)}</p>
                  <p className="text-xs text-muted-foreground">{activity.entity_type}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatCairoDateTime(activity.created_at)}</span>
              </div>
            ))}
            {!profile.recentActivity.length && (
              <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                No recent activity yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" />
              Completion details
            </CardTitle>
            <CardDescription>Profile readiness indicators.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {profile.completionItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{item.label}</span>
                <Badge variant={item.complete ? "default" : "secondary"}>{item.complete ? "Done" : "Missing"}</Badge>
              </div>
            ))}
            <div className="rounded-lg border bg-secondary/25 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Bell className="size-4 text-primary" />
                Notifications
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Sound {profile.notificationPreferences.sound ? "on" : "off"} - Toast {profile.notificationPreferences.toast ? "on" : "off"} - Desktop {profile.notificationPreferences.desktop ? "on" : "off"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
