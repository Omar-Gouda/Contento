import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Send } from "lucide-react";

import { PageMessage } from "@/components/admin/page-message";
import { createTimeOffRequestAction, reviewTimeOffRequestAction } from "@/lib/workflows/actions";
import { getCalendarItems, type CalendarItem } from "@/lib/workflows/queries";
import { requirePermission } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import { CONTENTO_TIME_ZONE, formatCairoDateTime, getCairoDate } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Calendar",
};

type CalendarView = "month" | "week" | "day";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

const eventStyles: Record<CalendarItem["type"], string> = {
  task: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  content: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-200",
  day_off: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  sick_leave: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200",
};

function normalizeView(view: string | undefined): CalendarView {
  return view === "week" || view === "day" ? view : "month";
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function shiftAnchor(anchorDate: string, view: CalendarView, direction: -1 | 1) {
  const date = new Date(`${anchorDate}T00:00:00`);

  if (view === "month") {
    date.setMonth(date.getMonth() + direction);
  } else if (view === "week") {
    date.setDate(date.getDate() + direction * 7);
  } else {
    date.setDate(date.getDate() + direction);
  }

  return dateKey(date);
}

function calendarDays(view: CalendarView, start: Date) {
  if (view === "day") {
    return [start];
  }

  if (view === "week") {
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }

  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function itemsForDay(items: CalendarItem[], day: string) {
  return items.filter((item) => item.startsAt.slice(0, 10) <= day && item.endsAt.slice(0, 10) >= day);
}

function EventChip({ item, compact = false }: { item: CalendarItem; compact?: boolean }) {
  const content = (
    <span
      className={cn(
        "block rounded-md border px-2 py-1 text-left text-xs leading-5 transition-colors",
        eventStyles[item.type],
        compact && "truncate"
      )}
    >
      <span className="font-medium">{item.title}</span>
      {!compact && (
        <span className="mt-1 block text-[11px] opacity-80">
          {item.owner ?? item.status}
        </span>
      )}
    </span>
  );

  if (!item.href) {
    return content;
  }

  return (
    <Link href={item.href} aria-label={`Open ${item.title}`}>
      {content}
    </Link>
  );
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const view = normalizeView(params.view);
  const context = await requirePermission("calendar.view", "view");
  const anchorDate = params.date || getCairoDate();
  const calendar = await getCalendarItems(context, { view, date: anchorDate });
  const days = calendarDays(view, calendar.range.start);
  const activeMonth = calendar.range.start.getMonth();
  const previousDate = shiftAnchor(anchorDate, view, -1);
  const nextDate = shiftAnchor(anchorDate, view, 1);
  const selectedDayItems = itemsForDay(calendar.items, anchorDate);
  const canReviewTimeOff = hasPermission(context, "day_off.approve", "limited");
  const redirectTo = `/calendar?view=${view}&date=${anchorDate}`;

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Calendar</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Content calendar</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          A Cairo-time scheduling view for publishing dates, task due dates, day off, and sick leave.
        </p>
      </div>

      <PageMessage error={params.error} status={params.notice} />

      <Card>
        <CardHeader>
          <CardTitle>Calendar controls</CardTitle>
          <CardDescription>Switch views or jump to a Cairo calendar date.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <form action="/calendar" className="grid gap-3 sm:grid-cols-[160px_220px_auto]">
              <div className="space-y-2">
                <Label htmlFor="view">View</Label>
                <select id="view" name="view" defaultValue={view} className={selectClass}>
                  <option value="month">Month</option>
                  <option value="week">Week</option>
                  <option value="day">Day</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" defaultValue={anchorDate} />
              </div>
              <div className="flex items-end">
                <Button type="submit">
                  <CalendarDays />
                  Apply
                </Button>
              </div>
            </form>

            <div className="flex items-center gap-2">
              <Link href={`/calendar?view=${view}&date=${previousDate}`} className={buttonVariants({ variant: "outline", size: "icon" })}>
                <ChevronLeft />
                <span className="sr-only">Previous</span>
              </Link>
              <Badge variant="secondary">
                {calendar.range.start.toISOString().slice(0, 10)} to {calendar.range.end.toISOString().slice(0, 10)}
              </Badge>
              <Link href={`/calendar?view=${view}&date=${nextDate}`} className={buttonVariants({ variant: "outline", size: "icon" })}>
                <ChevronRight />
                <span className="sr-only">Next</span>
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {Object.keys(eventStyles).map((type) => (
              <Badge key={type} variant="outline" className={eventStyles[type as CalendarItem["type"]]}>
                {type.replace("_", " ")}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>{calendar.items.length}</CardTitle>
            <CardDescription>Total scheduled items</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{calendar.items.filter((item) => item.type === "task").length}</CardTitle>
            <CardDescription>Tasks with due dates</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{calendar.items.filter((item) => item.type === "content").length}</CardTitle>
            <CardDescription>Content schedule records</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              {calendar.items.filter((item) => item.type === "day_off" || item.type === "sick_leave").length}
            </CardTitle>
            <CardDescription>Time-off requests</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request time off</CardTitle>
          <CardDescription>Submit day off or sick leave requests for the selected Cairo calendar date.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createTimeOffRequestAction} className="grid gap-4 lg:grid-cols-4">
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <div className="space-y-2">
              <Label htmlFor="requestType">Type</Label>
              <select id="requestType" name="requestType" defaultValue="day_off" className={selectClass}>
                <option value="day_off">Day off</option>
                <option value="sick_leave">Sick leave</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" name="startDate" type="date" defaultValue={anchorDate} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End date</Label>
              <Input id="endDate" name="endDate" type="date" defaultValue={anchorDate} required />
            </div>
            <div className="space-y-2 lg:col-span-4">
              <Label htmlFor="reason">Reason</Label>
              <textarea
                id="reason"
                name="reason"
                required
                className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <div className="lg:col-span-4">
              <Button type="submit">
                <Send />
                Submit request
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{view === "month" ? "Month view" : view === "week" ? "Week view" : "Day view"}</CardTitle>
          <CardDescription>Dates and times are shown in {CONTENTO_TIME_ZONE}.</CardDescription>
        </CardHeader>
        <CardContent>
          {view !== "day" && (
            <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
          )}

          <div className={cn("grid gap-2", view === "month" ? "grid-cols-1 md:grid-cols-7" : view === "week" ? "grid-cols-1 lg:grid-cols-7" : "grid-cols-1")}>
            {days.map((date) => {
              const day = dateKey(date);
              const dayItems = itemsForDay(calendar.items, day);
              const outsideMonth = view === "month" && date.getMonth() !== activeMonth;
              const isAnchor = day === anchorDate;

              return (
                <div
                  key={day}
                  id={`day-${day}`}
                  className={cn(
                    "min-h-36 rounded-xl border bg-card p-2 shadow-sm",
                    outsideMonth && "bg-secondary/25 text-muted-foreground",
                    isAnchor && "ring-2 ring-primary/40"
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Link href={`/calendar?view=day&date=${day}`} className="rounded-md px-1.5 py-1 text-sm font-medium hover:bg-secondary">
                      {day}
                    </Link>
                    <Badge variant="secondary">{dayItems.length}</Badge>
                  </div>
                  <div className="grid gap-1.5">
                    {(view === "month" ? dayItems.slice(0, 4) : dayItems).map((item) => (
                      <EventChip key={`${item.type}-${item.id}-${day}`} item={item} compact={view === "month"} />
                    ))}
                    {view === "month" && dayItems.length > 4 && (
                      <Link href={`/calendar?view=day&date=${day}`} className="text-xs font-medium text-primary hover:underline">
                        +{dayItems.length - 4} more
                      </Link>
                    )}
                    {!dayItems.length && <p className="text-xs text-muted-foreground">No records</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Selected day details</CardTitle>
          <CardDescription>{anchorDate}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {selectedDayItems.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              id={item.type === "day_off" || item.type === "sick_leave" ? `time-off-${item.id}` : undefined}
              className="rounded-xl border bg-secondary/25 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatCairoDateTime(item.startsAt)} to {formatCairoDateTime(item.endsAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={eventStyles[item.type]}>
                    {item.type.replace("_", " ")}
                  </Badge>
                  <Badge variant="secondary">{item.status}</Badge>
                </div>
              </div>
              {item.owner && <p className="mt-2 text-sm text-muted-foreground">{item.owner}</p>}
              {item.href && (
                <Link href={item.href} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}>
                  Open record
                </Link>
              )}
              {canReviewTimeOff && (item.type === "day_off" || item.type === "sick_leave") && item.status === "pending" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["approved", "rejected"] as const).map((decision) => (
                    <form key={decision} action={reviewTimeOffRequestAction}>
                      <input type="hidden" name="requestId" value={item.id} />
                      <input type="hidden" name="decision" value={decision} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <Button type="submit" variant={decision === "approved" ? "default" : "outline"} size="sm">
                        {decision === "approved" ? "Approve" : "Reject"}
                      </Button>
                    </form>
                  ))}
                </div>
              )}
            </div>
          ))}

          {!selectedDayItems.length && (
            <div className="rounded-xl border border-dashed py-10 text-center text-muted-foreground">
              No calendar records exist for this day.
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
