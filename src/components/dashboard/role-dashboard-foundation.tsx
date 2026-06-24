import Link from "next/link";
import { CalendarDays, ClipboardList, FileBarChart, Lightbulb, PanelsTopLeft, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RoleDashboard } from "@/types/roles";
import type { DashboardSummaryMetric } from "@/lib/dashboard/queries";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";
import {
  defaultDashboardWidgets,
  resetDashboardWidgetsAction,
  updateDashboardWidgetsAction,
  type DashboardWidgetId,
} from "@/lib/dashboard/preferences";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const quickLinks = [
  { href: routes.tasks, label: "Tasks", icon: ClipboardList },
  { href: routes.ideas, label: "Ideas", icon: Lightbulb },
  { href: routes.content.home, label: "Content", icon: PanelsTopLeft },
  { href: routes.calendar, label: "Calendar", icon: CalendarDays },
  { href: routes.reports, label: "Reports", icon: FileBarChart },
];

export function RoleDashboardFoundation({
  dashboard,
  summary,
  widgets = defaultDashboardWidgets,
  currentPath,
}: {
  dashboard: RoleDashboard;
  summary: DashboardSummaryMetric[];
  widgets?: DashboardWidgetId[];
  currentPath: string;
}) {
  const visibleWidgets = new Set(widgets);

  return (
    <section className="animate-in fade-in-0 duration-500">
      <div className="mb-6 max-w-3xl">
        <Badge variant="secondary">{dashboard.eyebrow}</Badge>
        <h1 className="mt-4 text-3xl font-semibold tracking-normal text-foreground">
          {dashboard.title}
        </h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          {dashboard.description}
        </p>
      </div>

      {visibleWidgets.has("summary") && (
        <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summary.map((metric) => (
            <Card key={metric.label}>
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
      )}

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        {visibleWidgets.has("focus") && (
          <Card>
            <CardHeader>
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </div>
              <CardTitle>My focus</CardTitle>
              <CardDescription>
                A private workspace for your current responsibilities, own work, and next useful actions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {dashboard.primaryFocus.map((focus) => (
                  <div key={focus} className="rounded-lg border bg-secondary/45 p-3 text-sm">
                    {focus}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {visibleWidgets.has("shortcuts") && (
          <Card>
            <CardHeader>
              <CardTitle>Operational shortcuts</CardTitle>
              <CardDescription>
                Jump into the workflow modules available for this workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {quickLinks.map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(buttonVariants({ variant: "outline" }), "justify-start")}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Dashboard customization</CardTitle>
          <CardDescription>Choose the widgets shown on this role dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <form action={updateDashboardWidgetsAction} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="redirectTo" value={currentPath} />
            {defaultDashboardWidgets.map((widget) => (
              <Label key={widget} className="flex items-center gap-2 rounded-lg border bg-secondary/30 px-3 py-2 text-sm">
                <input type="checkbox" name="widgets" value={widget} defaultChecked={visibleWidgets.has(widget)} />
                {widget}
              </Label>
            ))}
            <Button type="submit" variant="outline">Save widgets</Button>
          </form>
          <form action={resetDashboardWidgetsAction}>
            <input type="hidden" name="redirectTo" value={currentPath} />
            <Button type="submit" variant="ghost">Reset</Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
