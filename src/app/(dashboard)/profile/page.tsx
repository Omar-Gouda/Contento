import type { Metadata } from "next";
import Link from "next/link";
import { Clock, KeyRound, Save, User } from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarUpload } from "@/components/forms/avatar-upload";

import { routes } from "@/constants/routes";
import { requirePermission } from "@/lib/auth/context";
import { updateProfileAction } from "@/lib/settings/actions";
import { getProfileData } from "@/lib/settings/queries";
import { formatCairoDateTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("settings.profile", "view");
  const profile = await getProfileData(context);

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
              displayName={`${profile.first_name} ${profile.last_name}`.trim() || profile.email}
            />
            <div>
              <p className="text-xl font-semibold">{`${profile.first_name} ${profile.last_name}`.trim() || profile.email}</p>
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
            <form action={updateProfileAction} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" name="firstName" defaultValue={profile.first_name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" name="lastName" defaultValue={profile.last_name} required />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Email</Label>
                <Input value={profile.email} readOnly />
              </div>
              <div className="md:col-span-2">
                <Button type="submit">
                  <Save />
                  Save profile
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Security and work hours</CardTitle>
          <CardDescription>Password changes and work-hour tracking stay separate from profile editing.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">{formatCairoDateTime(profile.created_at)}</span>
            </div>
          </div>
          <Link href={routes.profile.workHours} className={buttonVariants({ variant: "outline" })}>
            <Clock />
            Work hours
          </Link>
          <Link href={routes.changePassword} className={buttonVariants({ variant: "outline" })}>
            <KeyRound />
            Change password
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}
