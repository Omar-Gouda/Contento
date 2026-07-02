import Link from "next/link";
import {
  BarChart3,
  Building2,
  ClipboardList,
  Pin,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  DashboardChartSection,
  DashboardSections,
  DashboardSummaryMetric,
  DashboardWorkItem,
} from "@/lib/dashboard/queries";
import { cn } from "@/lib/utils";
import type { RoleDashboard } from "@/types/roles";

function statusTone(status: string) {
  if (["approved", "published", "completed", "closed", "sent"].includes(status)) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  }

  if (["pending", "assigned", "submitted", "under_review"].includes(status)) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200";
  }

  if (["rejected", "archived", "blocked"].includes(status) || status.includes("changes_requested")) {
    return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200";
  }

  if (["scheduled", "in_progress"].includes(status)) {
    return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-200";
  }

  if (status === "draft") {
    return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-200";
  }

  return "border-border bg-secondary text-secondary-foreground";
}

function formatDashboardDate(value: string | null) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: value.includes("T") ? "numeric" : undefined,
    minute: value.includes("T") ? "2-digit" : undefined,
  }).format(date);
}

function EmptyState({
  label,
  href,
  action,
}: {
  label: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed bg-secondary/25 px-4 py-8 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      {href && action && (
        <Link href={href} className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">
          {action}
        </Link>
      )}
    </div>
  );
}

function SectionHeader({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
    </div>
  );
}

function DashboardChart({ chart }: { chart: DashboardChartSection }) {
  const maxValue = Math.max(...chart.data.map((item) => item.value), 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{chart.title}</CardTitle>
            <CardDescription>{chart.description}</CardDescription>
          </div>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BarChart3 className="size-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {chart.data.map((item) => {
          const percentage = Math.max(4, Math.round((item.value / maxValue) * 100));

          return (
            <div key={item.label} className="grid gap-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium">{item.label}</span>
                <span className="tabular-nums text-muted-foreground">{item.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percentage}%` }} />
              </div>
              {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ClientSection({ sections }: { sections: DashboardSections }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <SectionHeader
          title="Clients"
          description="Client spaces that currently matter to your role."
          icon={Building2}
        />
      </CardHeader>
      <CardContent>
        {sections.clientsError ? (
          <EmptyState label={sections.clientsError} href="/clients" action="Open clients" />
        ) : sections.clients.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {sections.clients.slice(0, 4).map((client) => (
            <Link
              key={client.id}
              href={client.href}
              className="rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-secondary text-sm font-semibold">
                  {client.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={client.logoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    client.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{client.name}</p>
                    <Badge variant="outline" className={cn("shrink-0 capitalize", statusTone(client.status))}>
                      {client.status}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {client.accountManagerName ? `Account Manager: ${client.accountManagerName}` : "No account manager assigned"}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-secondary/60 p-2">
                  <p className="font-semibold text-foreground">{client.openTasks}</p>
                  <p className="text-muted-foreground">Tasks</p>
                </div>
                <div className="rounded-md bg-secondary/60 p-2">
                  <p className="font-semibold text-foreground">{client.openIdeas}</p>
                  <p className="text-muted-foreground">Ideas</p>
                </div>
                <div className="rounded-md bg-secondary/60 p-2">
                  <p className="truncate font-semibold text-foreground">{formatDashboardDate(client.upcomingPublishingAt)}</p>
                  <p className="text-muted-foreground">Next</p>
                </div>
              </div>
            </Link>
            ))}
          </div>
        ) : (
          <EmptyState label="No client spaces are available for your role yet." href="/clients" action="Open clients" />
        )}
      </CardContent>
    </Card>
  );
}

function WorkItemList({
  items,
}: {
  items: DashboardWorkItem[];
}) {
  const stickyColors = [
    "border-amber-200 bg-amber-100/90 text-amber-950 shadow-amber-950/10 dark:border-amber-300/20 dark:bg-amber-300/15 dark:text-amber-50",
    "border-violet-200 bg-violet-100/90 text-violet-950 shadow-violet-950/10 dark:border-violet-300/20 dark:bg-violet-300/15 dark:text-violet-50",
    "border-emerald-200 bg-emerald-100/90 text-emerald-950 shadow-emerald-950/10 dark:border-emerald-300/20 dark:bg-emerald-300/15 dark:text-emerald-50",
    "border-sky-200 bg-sky-100/90 text-sky-950 shadow-sky-950/10 dark:border-sky-300/20 dark:bg-sky-300/15 dark:text-sky-50",
  ];
  const rotations = ["rotate-[-1.4deg]", "rotate-[1deg]", "rotate-[-0.6deg]", "rotate-[1.3deg]"];

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          title="Priority work"
          description="The next tasks, reviews, ideas, and reports that need movement."
          icon={ClipboardList}
        />
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {items.length ? (
          items.map((item, index) => {
            const isIdea = item.href.startsWith("/ideas");
            const isTask = item.href.startsWith("/tasks");

            return (
            <Link
              key={`${item.href}-${item.id}`}
              href={item.href}
              className={cn(
                "group relative min-h-36 rounded-lg border p-4 shadow-md transition duration-200 hover:-translate-y-1 hover:rotate-0 hover:shadow-lg",
                stickyColors[index % stickyColors.length],
                rotations[index % rotations.length]
              )}
            >
              <span className="absolute left-1/2 top-2 flex size-5 -translate-x-1/2 items-center justify-center rounded-full bg-background/70 text-primary shadow-sm">
                <Pin className="size-3" />
              </span>
              <div className="mt-4 flex min-h-24 flex-col justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
                      {isIdea ? "Idea" : isTask ? "Task" : item.label}
                    </span>
                    <Badge variant="outline" className={cn("shrink-0 bg-background/45 capitalize", statusTone(item.status))}>
                      {item.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-sm font-semibold">{item.title}</p>
                  <p className="mt-2 line-clamp-1 text-xs opacity-75">
                    {item.clientName ?? "No client"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="rounded-md bg-background/45 px-2 py-1">
                    {isIdea ? "Type" : "Priority"}: {item.label.replaceAll("_", " ")}
                  </span>
                  <span className="rounded-md bg-background/45 px-2 py-1">
                    {isIdea ? "Publish" : "Due"}: {formatDashboardDate(item.date)}
                  </span>
                </div>
              </div>
            </Link>
            );
          })
        ) : (
          <EmptyState label="No active work needs your attention right now." href="/tasks" action="Open task queue" />
        )}
      </CardContent>
    </Card>
  );
}

export function RoleDashboardFoundation({
  dashboard,
  summary,
  charts,
  sections,
  titleOverride,
}: {
  dashboard: RoleDashboard;
  summary: DashboardSummaryMetric[];
  charts: DashboardChartSection[];
  sections: DashboardSections;
  titleOverride?: string;
}) {
  const visibleSummary = summary.slice(0, 4);
  const visibleCharts = charts.filter((chart) => chart.data.some((item) => item.value > 0)).slice(0, 3);
  const priorityItems = [...sections.reviewItems, ...sections.workItems, ...sections.reports].slice(0, 6);

  return (
    <section className="animate-in fade-in-0 duration-500">
      <div className="mb-6 max-w-3xl">
        <Badge variant="secondary">{dashboard.eyebrow}</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-normal text-foreground">
          {titleOverride ?? dashboard.title}
        </h1>
        <p className="mt-2 text-sm font-medium text-primary">Welcome back. The deadlines missed you.</p>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          {dashboard.description}
        </p>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visibleSummary.map((metric, index) => (
          <Card
            key={metric.label}
            className={cn(
              "overflow-hidden border-primary/10 shadow-sm",
              index % 2 === 0 ? "bg-gradient-to-br from-card to-primary/5" : "bg-gradient-to-br from-card to-violet-500/5"
            )}
          >
            <CardHeader>
              <CardTitle>{metric.value}</CardTitle>
              <CardDescription>{metric.label}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {metric.description}
            </CardContent>
          </Card>
        ))}
      </div>

      {visibleCharts.length > 0 && (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          {visibleCharts.map((chart) => (
            <DashboardChart key={chart.title} chart={chart} />
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {sections.clients.length > 0 && <ClientSection sections={sections} />}
        <WorkItemList items={priorityItems} />
      </div>
    </section>
  );
}
