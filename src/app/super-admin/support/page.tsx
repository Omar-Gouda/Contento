import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, TicketCheck } from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateSupportItemAction } from "@/lib/super-admin/platform-actions";
import { getSupportInbox } from "@/lib/super-admin/platform-control";
import { formatCairoDateTime } from "@/lib/time";

export const metadata: Metadata = {
  title: "Support Inbox",
};

function priorityVariant(priority: string) {
  return priority === "urgent" || priority === "high" ? "destructive" as const : "secondary" as const;
}

export default async function SupportInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [items, params] = await Promise.all([getSupportInbox(), searchParams]);

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Support Inbox"
        description="Review organization requests, billing issues, platform health signals, and manually tracked support items."
      />

      <PageMessage error={params.error} status={params.notice} />

      <div className="grid gap-4 md:grid-cols-4">
        {(["open", "in_progress", "resolved", "closed"] as const).map((status) => (
          <Card key={status}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm capitalize">{status.replaceAll("_", " ")}</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">
              {items.filter((item) => item.status === status).length}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TicketCheck className="size-4 text-primary" />
            Inbox
          </CardTitle>
          <CardDescription>Virtual items open the source workflow; saved support items can be updated directly.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border bg-secondary/25 p-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{item.title}</p>
                    <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                    <Badge variant={item.status === "resolved" || item.status === "closed" ? "outline" : "secondary"}>
                      {item.status.replaceAll("_", " ")}
                    </Badge>
                    {item.isVirtual && <Badge variant="outline">source queue</Badge>}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description || "No description."}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.companyName ?? "Platform"} - {item.requesterEmail ?? "no requester"} - {formatCairoDateTime(item.createdAt)}
                  </p>
                  {item.sourceHref && (
                    <Link href={item.sourceHref} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-4">
                      {item.sourceLabel ?? "Open source"}
                      <ExternalLink className="size-3.5" />
                    </Link>
                  )}
                </div>
                {!item.isVirtual && (
                  <form action={updateSupportItemAction} className="grid gap-2 lg:min-w-96">
                    <input type="hidden" name="itemId" value={item.id} />
                    <select name="status" defaultValue={item.status} className="h-10 rounded-md border bg-background px-3 text-sm">
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                    <Input name="internalNote" defaultValue={item.internalNote} placeholder="Internal note" />
                    <Button type="submit" variant="outline">Save support status</Button>
                  </form>
                )}
                {item.isVirtual && item.sourceHref && (
                  <Link href={item.sourceHref} className={buttonVariants({ variant: "outline" })}>
                    Open workflow
                  </Link>
                )}
              </div>
            </div>
          ))}
          {!items.length && <p className="rounded-xl border bg-secondary/25 p-4 text-sm text-muted-foreground">No support items or source queues need attention.</p>}
        </CardContent>
      </Card>
    </section>
  );
}
