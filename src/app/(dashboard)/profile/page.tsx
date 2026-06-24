import type { Metadata } from "next";
import Link from "next/link";
import { Camera, KeyRound, Save, User } from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";
import { requirePermission } from "@/lib/auth/context";
import { updateProfileAction, uploadAvatarAction } from "@/lib/settings/actions";
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

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
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

        <Card>
          <CardHeader>
            <CardTitle>Access</CardTitle>
            <CardDescription>Managed by your organization Admin.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
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
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">{formatCairoDateTime(profile.created_at)}</span>
            </div>
            <Link href={routes.changePassword} className={buttonVariants({ variant: "outline" })}>
              <KeyRound />
              Change password
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Avatar</CardTitle>
          <CardDescription>Avatar files are stored privately in the workspace avatar bucket.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={uploadAvatarAction} encType="multipart/form-data" className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input name="avatar" type="file" accept="image/*" />
            <Button type="submit" variant="outline">
              <Camera />
              Upload avatar
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
