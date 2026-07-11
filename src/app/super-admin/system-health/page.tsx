import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, HeartPulse } from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { resolvePlatformEventAction } from "@/lib/super-admin/platform-actions";
import { getSystemHealth, sanitizeMetadata } from "@/lib/super-admin/platform-control";
import { formatCairoDateTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "System Health",
};

function severityVariant(severity: string) {
  return severity === "critical" || severity === "error" ? "destructive" as const : "secondary" as const;
}

export default async function SystemHealthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [health, params] = await Promise.all([getSystemHealth(), searchParams]);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="System Health"
        description="Monitor platform events, failed billing actions, cleanup signals, and operational warnings."
      />

      <PageMessage error={params.error} status={params.notice} />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Open events</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{health.summary.openEvents}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Critical events</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{health.summary.criticalEvents}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Open support</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{health.summary.openSupportItems}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Tracked files</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold">{health.summary.trackedFiles}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HeartPulse className="size-4 text-primary" />
            Platform events
          </CardTitle>
          <CardDescription>If no events are listed, no platform event logging has been recorded yet.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {health.events.map((event) => (
            <details key={event.id} className="rounded-xl border bg-secondary/25 p-4">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{event.title}</p>
                      <Badge variant={severityVariant(event.severity)}>{event.severity}</Badge>
                      <Badge variant={event.status === "open" ? "secondary" : "outline"}>{event.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{event.source} - {event.event_type} - {formatCairoDateTime(event.created_at)}</p>
                  </div>
                </div>
              </summary>
              <div className="mt-4 grid gap-4">
                <p className="text-sm leading-6 text-muted-foreground">{event.message || "No message."}</p>
                <pre className="max-h-80 overflow-auto rounded-xl border bg-background p-3 text-xs text-muted-foreground">
                  {JSON.stringify(sanitizeMetadata(event.metadata), null, 2)}
                </pre>
                {event.status === "open" && (
                  <form action={resolvePlatformEventAction} className="grid gap-2 md:grid-cols-[1fr_10rem_auto]">
                    <input type="hidden" name="eventId" value={event.id} />
                    <Input name="internalNote" placeholder="Internal note" />
                    <select name="status" defaultValue="resolved" className="h-10 rounded-md border bg-background px-3 text-sm">
                      <option value="resolved">Resolved</option>
                      <option value="ignored">Ignored</option>
                    </select>
                    <Button type="submit" variant="outline">
                      <CheckCircle2 />
                      Save
                    </Button>
                  </form>
                )}
              </div>
            </details>
          ))}
          {!health.events.length && <p className="rounded-xl border bg-secondary/25 p-4 text-sm text-muted-foreground">No platform events logged yet.</p>}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-primary" />
              Failed or attention-needed billing actions
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {health.failedBillingEvents.map((event) => (
              <div key={event.id} className="rounded-lg border bg-secondary/30 p-3">
                <p className="font-medium">{event.action}</p>
                <p className="mt-1 text-sm text-muted-foreground">{formatCairoDateTime(event.created_at)}</p>
              </div>
            ))}
            {!health.failedBillingEvents.length && <p className="text-sm text-muted-foreground">No failed billing signals found.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cleanup and deletion watchlist</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {health.scheduledSubscriptions.map((subscription) => (
              <div key={subscription.id} className="rounded-lg border bg-secondary/30 p-3">
                <p className="font-medium">{subscription.status.replaceAll("_", " ")}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Company {subscription.company_id} - grace {subscription.grace_ends_at ? formatCairoDateTime(subscription.grace_ends_at) : "not set"}
                </p>
              </div>
            ))}
            {!health.scheduledSubscriptions.length && <p className="text-sm text-muted-foreground">No subscriptions currently require cleanup review.</p>}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
