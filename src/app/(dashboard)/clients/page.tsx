import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Search } from "lucide-react";

import { getClients } from "@/lib/clients/queries";
import { getWorkflowContent, getWorkflowIdeas, getWorkflowTasks } from "@/lib/workflows/queries";
import { requirePermission } from "@/lib/auth/context";
import { formatCairoDateTime } from "@/lib/time";
import { PageMessage } from "@/components/admin/page-message";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";

export const metadata: Metadata = {
  title: "Clients",
};

const statusOptions = ["active", "paused", "archived"] as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function nearestDate(values: Array<string | null>) {
  const now = Date.now();
  return values
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .filter((item) => Number.isFinite(item.time) && item.time >= now)
    .sort((a, b) => a.time - b.time)[0]?.value ?? null;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("clients.view", "view");
  const [clients, tasks, ideas, content] = await Promise.all([
    getClients(context, { search: params.q, status: params.status }),
    getWorkflowTasks(context, { status: "all" }),
    getWorkflowIdeas(context, { status: "all" }),
    getWorkflowContent(context, { status: "all" }),
  ]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Clients</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">Client workspace</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Browse client profiles, briefs, contacts, ownership, and current delivery signals.
          </p>
        </div>
        <Link href={routes.dashboards.admin} className={buttonVariants({ variant: "outline" })}>
          <Building2 />
          Open manager dashboard
        </Link>
      </div>

      <PageMessage error={params.error} status={params.notice} />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search client profiles or narrow by lifecycle status.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={routes.clients.home} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <div className="space-y-2">
              <Label htmlFor="q">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="q" name="q" defaultValue={params.q ?? ""} className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={params.status ?? "all"}
                className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              >
                <option value="all">All statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full md:w-auto">Apply</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Client list</h2>
          <p className="text-sm text-muted-foreground">{clients.length} client profiles in this workspace.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
            {clients.map((client) => {
              const clientTasks = tasks.filter((task) => task.client_id === client.id);
              const clientIdeas = ideas.filter((idea) => idea.client_id === client.id);
              const clientContent = content.filter((item) => item.client_id === client.id);
              const openTaskCount = clientTasks.filter((task) => !["completed", "closed"].includes(task.status)).length;
              const openIdeaCount = clientIdeas.filter((idea) => !["approved", "rejected", "archived"].includes(idea.status)).length;
              const upcomingPublishingAt = nearestDate([
                ...clientIdeas.map((idea) => idea.publishing_at),
                ...clientContent.map((item) => item.scheduled_at),
              ]);

              return (
                <Card key={client.id} className="border-muted/60">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-secondary text-sm font-semibold">
                        {client.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={client.logo_url} alt="" className="size-full object-cover" />
                        ) : (
                          initials(client.name)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <CardTitle className="truncate">{client.name}</CardTitle>
                            <CardDescription>{client.slug || "No slug yet"}</CardDescription>
                          </div>
                          <Badge>{client.status}</Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm">
                    <div className="grid gap-2 md:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground">Account manager</p>
                        <p className="font-medium">{client.accountManagerName ?? "Unassigned"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Contact email</p>
                        <p className="font-medium">{client.contact_email || "Not set"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Upcoming publishing</p>
                        <p className="font-medium">{upcomingPublishingAt ? formatCairoDateTime(upcomingPublishingAt) : "Not scheduled"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Open work</p>
                        <p className="font-medium">{openTaskCount} tasks / {openIdeaCount} ideas</p>
                      </div>
                    </div>
                    <p className="line-clamp-3 text-muted-foreground">{client.requirements || client.notes || "No brief yet."}</p>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">{client.assignedUsers.length} assigned users</p>
                      <Link href={routes.clients.detail(client.id)} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                        Open client
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {!clients.length && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No clients have been created yet.
              </div>
            )}
        </div>
      </div>
    </section>
  );
}
