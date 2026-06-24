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
}: {
  dashboard: RoleDashboard;
  summary: DashboardSummaryMetric[];
}) {
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

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
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
      </div>
    </section>
  );
}
