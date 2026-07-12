import type { Metadata } from "next";
import { Ban, Trash2 } from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addTrialBlacklistEmailAction, removeTrialBlacklistEmailAction } from "@/lib/super-admin/platform-actions";
import { getTrialBlacklist } from "@/lib/super-admin/platform-control";
import { formatCairoDateTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Trial Blacklist",
};

export default async function TrialBlacklistPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [entries, params] = await Promise.all([getTrialBlacklist(), searchParams]);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Trial Blacklist"
        description="Prevent duplicate free trial requests by email and keep a linked audit trail."
      />

      <PageMessage error={params.error} status={params.notice} />

      <Card>
        <CardHeader>
          <CardTitle>Add blacklisted email</CardTitle>
          <CardDescription>Use this when a trial grace period expires or a duplicate trial request is detected.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={addTrialBlacklistEmailAction} className="grid gap-4 md:grid-cols-[1fr_1.5fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="owner@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Input id="reason" name="reason" placeholder="Trial grace period expired" required />
            </div>
            <Button type="submit">
              <Ban />
              Add email
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Blacklisted trial emails</CardTitle>
          <CardDescription>{entries.length} email{entries.length === 1 ? "" : "s"} currently blocked from new free trials.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {entries.map((entry) => (
            <div key={entry.id} className="grid gap-3 rounded-xl border bg-secondary/25 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{entry.email}</p>
                  <Badge variant="secondary">{entry.normalized_email}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{entry.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatCairoDateTime(entry.blacklisted_at)}
                  {entry.companyName ? ` - ${entry.companyName}` : ""}
                  {entry.createdByEmail ? ` - by ${entry.createdByEmail}` : ""}
                </p>
              </div>
              <form action={removeTrialBlacklistEmailAction}>
                <input type="hidden" name="entryId" value={entry.id} />
                <Button type="submit" variant="outline">
                  <Trash2 />
                  Remove
                </Button>
              </form>
            </div>
          ))}
          {!entries.length && <p className="rounded-xl border bg-secondary/25 p-4 text-sm text-muted-foreground">No blacklisted trial emails yet.</p>}
        </CardContent>
      </Card>
    </section>
  );
}
