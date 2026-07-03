import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Search } from "lucide-react";

import { getClients, getClientWorkspaceSignals } from "@/lib/clients/queries";
import { requirePermission } from "@/lib/auth/context";
import { formatCairoDateTime } from "@/lib/time";
import { PageMessage } from "@/components/admin/page-message";
import { FilterPanel } from "@/components/dashboard/filter-panel";
import { PageActions, PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";

export const metadata: Metadata = {
  title: "Clients",
};

const statusOptions = ["active", "disabled", "expired", "archived"] as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function contractWarning(endDate: string | null) {
  if (!endDate) {
    return null;
  }

  const today = new Date();
  const end = new Date(`${endDate}T12:00:00`);
  const days = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) {
    return "Contract expired";
  }

  if (days <= 14) {
    return `Contract ends in ${days} day${days === 1 ? "" : "s"}`;
  }

  return null;
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("clients.view", "view");
  const clients = await getClients(context, { search: params.q, status: params.status });
  const clientSignals = await getClientWorkspaceSignals(context, clients.map((client) => client.id));

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Clients"
        title="Client workspace"
        description="Browse client profiles, briefs, contacts, ownership, and current delivery signals."
        actions={
          <PageActions>
            <Link href={routes.dashboards.admin} className={buttonVariants({ variant: "outline", size: "lg" })}>
              <Building2 />
              Open manager dashboard
            </Link>
            <FilterPanel
              description="Search client profiles or narrow by lifecycle status."
              activeFilters={[
                { label: "Search", value: params.q },
                { label: "Status", value: params.status },
              ]}
            >
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
              <Button type="submit" className="w-fit">Apply</Button>
            </div>
          </form>
            </FilterPanel>
          </PageActions>
        }
      />

      <PageMessage error={params.error} status={params.notice} />

      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Client list</h2>
          <p className="text-sm text-muted-foreground">{clients.length} client profiles in this workspace.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
            {clients.map((client) => {
              const signal = clientSignals.get(client.id);
              const warning = contractWarning(client.contract_end_date);

              return (
                <Card key={client.id} className="border-muted/60">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-secondary text-sm font-semibold">
                        {client.logoSignedUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={client.logoSignedUrl} alt="" className="size-full object-cover" />
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
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Badge variant={client.status === "active" ? "default" : "secondary"}>{client.status}</Badge>
                            {warning && <Badge variant="outline">{warning}</Badge>}
                          </div>
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
                        <p className="font-medium">{signal?.upcomingPublishingAt ? formatCairoDateTime(signal.upcomingPublishingAt) : "Not scheduled"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Open work</p>
                        <p className="font-medium">{signal?.openTaskCount ?? 0} tasks / {signal?.openIdeaCount ?? 0} ideas</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Contract end</p>
                        <p className="font-medium">{client.contract_end_date ?? "Not set"}</p>
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
