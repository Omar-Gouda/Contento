import type { Metadata } from "next";
import { Megaphone, XCircle } from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { archivePlatformAnnouncementAction, createPlatformAnnouncementAction } from "@/lib/super-admin/platform-actions";
import { getPlatformAnnouncements } from "@/lib/super-admin/platform-control";
import { formatCairoDateTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Platform Announcements",
};

export default async function PlatformAnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ announcements, companies }, params] = await Promise.all([getPlatformAnnouncements(), searchParams]);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Announcements"
        description="Create targeted platform banners for all organizations or a single workspace."
      />

      <PageMessage error={params.error} status={params.notice} />

      <Card>
        <CardHeader>
          <CardTitle>Create announcement</CardTitle>
          <CardDescription>Active announcements appear as dashboard banners for targeted organizations.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createPlatformAnnouncementAction} className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="severity">Severity</Label>
              <select id="severity" name="severity" defaultValue="info" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetType">Target</Label>
              <select id="targetType" name="targetType" defaultValue="all" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="all">All organizations</option>
                <option value="organization">Selected organization</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetCompanyId">Organization</Label>
              <select id="targetCompanyId" name="targetCompanyId" defaultValue="" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="">Only required for selected organization</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name} ({company.slug})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startsAt">Start date/time</Label>
              <Input id="startsAt" name="startsAt" type="datetime-local" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endsAt">End date/time</Label>
              <Input id="endsAt" name="endsAt" type="datetime-local" />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="message">Message</Label>
              <textarea id="message" name="message" rows={4} className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50" required />
            </div>
            <div className="lg:col-span-2">
              <Button type="submit">
                <Megaphone />
                Publish announcement
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Announcements</CardTitle>
          <CardDescription>Current and historical platform announcements.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {announcements.map((announcement) => (
            <div key={announcement.id} className="grid gap-3 rounded-xl border bg-secondary/25 p-4 lg:grid-cols-[1fr_auto] lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{announcement.title}</p>
                  <Badge variant={announcement.severity === "critical" ? "destructive" : "secondary"}>{announcement.severity}</Badge>
                  <Badge variant={announcement.status === "active" ? "default" : "outline"}>{announcement.status}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{announcement.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Target: {announcement.target_type === "all" ? "All organizations" : announcement.companyName ?? "Unknown organization"}
                  {" - "}Starts {formatCairoDateTime(announcement.starts_at)}
                  {announcement.ends_at ? ` - Ends ${formatCairoDateTime(announcement.ends_at)}` : ""}
                </p>
              </div>
              {announcement.status !== "archived" && (
                <form action={archivePlatformAnnouncementAction}>
                  <input type="hidden" name="announcementId" value={announcement.id} />
                  <Button type="submit" variant="outline">
                    <XCircle />
                    Archive
                  </Button>
                </form>
              )}
            </div>
          ))}
          {!announcements.length && <p className="rounded-xl border bg-secondary/25 p-4 text-sm text-muted-foreground">No announcements yet.</p>}
        </CardContent>
      </Card>
    </section>
  );
}
