import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";

import { getCalendarItems } from "@/lib/workflows/queries";
import { requirePermission } from "@/lib/auth/context";
import { CONTENTO_TIME_ZONE, formatCairoDateTime, getCairoDate } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = {
  title: "Calendar",
};

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function eventVariant(type: string) {
  if (type === "content") {
    return "default";
  }

  if (type === "work_hours") {
    return "secondary";
  }

  return "outline";
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("calendar.view", "view");
  const calendar = await getCalendarItems(context, params);
  const anchorDate = params.date || getCairoDate();
  const grouped = new Map<string, typeof calendar.items>();

  calendar.items.forEach((item) => {
    const day = item.startsAt.slice(0, 10);
    grouped.set(day, [...(grouped.get(day) ?? []), item]);
  });

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Calendar</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Content calendar</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          View content schedule, creator/team activity, day-off visibility, and work-hours context in {CONTENTO_TIME_ZONE}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View controls</CardTitle>
          <CardDescription>Switch between monthly, weekly, and list operational views.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/calendar" className="grid gap-3 md:grid-cols-[180px_220px_auto]">
            <div className="space-y-2">
              <Label htmlFor="view">View</Label>
              <select id="view" name="view" defaultValue={calendar.range.view} className={selectClass}>
                <option value="month">Month</option>
                <option value="week">Week</option>
                <option value="list">List</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Anchor date</Label>
              <Input id="date" name="date" type="date" defaultValue={anchorDate} />
            </div>
            <div className="flex items-end">
              <Button type="submit">
                <CalendarDays />
                Apply
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{calendar.items.length}</CardTitle>
            <CardDescription>Total calendar records</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{calendar.items.filter((item) => item.type === "content").length}</CardTitle>
            <CardDescription>Scheduled content records</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{calendar.items.filter((item) => item.type === "work_hours").length}</CardTitle>
            <CardDescription>Work-hour records in range</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {calendar.range.view === "week"
              ? "Weekly view"
              : calendar.range.view === "list"
                ? "List view"
                : "Monthly view"}
          </CardTitle>
          <CardDescription>
            {calendar.range.start.toISOString().slice(0, 10)} to {calendar.range.end.toISOString().slice(0, 10)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {Array.from(grouped.entries()).map(([day, items]) => (
              <div key={day} className="rounded-lg border bg-secondary/25 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-medium">{day}</h2>
                  <Badge variant="secondary">{items.length} items</Badge>
                </div>
                <div className="grid gap-2">
                  {items.map((item) => (
                    <div key={`${item.type}-${item.id}`} className="rounded-lg border bg-background p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-muted-foreground">{item.owner ?? "Company schedule"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={eventVariant(item.type)}>{item.type}</Badge>
                          <Badge variant="secondary">{item.status}</Badge>
                        </div>
                      </div>
                      <p className="mt-2 text-muted-foreground">
                        {formatCairoDateTime(item.startsAt)} to {formatCairoDateTime(item.endsAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {!calendar.items.length && (
              <div className="py-10 text-center text-muted-foreground">
                No calendar records exist in this range.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
