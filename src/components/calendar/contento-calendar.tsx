import Link from "next/link";
import {
  CalendarCheck2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListFilter,
  Send,
} from "lucide-react";

import { FormSheet } from "@/components/dashboard/form-sheet";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createTimeOffRequestAction, reviewTimeOffRequestAction } from "@/lib/workflows/actions";
import type { CalendarItem } from "@/lib/workflows/queries";
import { CONTENTO_TIME_ZONE, formatCairoDateTime, formatCairoTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export type CalendarView = "month" | "week" | "day";

type CalendarRange = {
  view: CalendarView;
  start: Date;
  end: Date;
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const viewOptions: CalendarView[] = ["month", "week", "day"];
const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function normalizeCalendarView(view: string | undefined): CalendarView {
  return view === "week" || view === "day" ? view : "month";
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function shiftAnchor(anchorDate: string, view: CalendarView, direction: -1 | 1) {
  const date = new Date(`${anchorDate}T12:00:00`);

  if (view === "month") {
    date.setMonth(date.getMonth() + direction);
  } else if (view === "week") {
    date.setDate(date.getDate() + direction * 7);
  } else {
    date.setDate(date.getDate() + direction);
  }

  return dateKey(date);
}

function calendarDays(view: CalendarView, range: CalendarRange) {
  if (view === "day") {
    return [new Date(`${dateKey(range.start)}T12:00:00`)];
  }

  if (view === "week") {
    return Array.from({ length: 7 }, (_, index) => addDays(range.start, index));
  }

  const gridStart = new Date(range.start);
  gridStart.setDate(range.start.getDate() - range.start.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

function calendarHref(view: CalendarView, date: string) {
  return `/calendar?view=${view}&date=${date}`;
}

function itemsForDay(items: CalendarItem[], day: string) {
  return items.filter((item) => item.startsAt.slice(0, 10) <= day && item.endsAt.slice(0, 10) >= day);
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CONTENTO_TIME_ZONE,
    ...options,
  }).format(new Date(`${value}T12:00:00`));
}

function formatRange(range: CalendarRange, view: CalendarView) {
  const start = dateKey(range.start);
  const end = dateKey(range.end);

  if (view === "month") {
    return formatDate(start, { month: "long", year: "numeric" });
  }

  if (view === "day") {
    return formatDate(start, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }

  return `${formatDate(start, { month: "short", day: "numeric" })} - ${formatDate(end, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function eventLabel(type: CalendarItem["type"]) {
  if (type === "task") {
    return "Task";
  }

  if (type === "idea") {
    return "Publishing idea";
  }

  if (type === "content") {
    return "Scheduled content";
  }

  return type === "sick_leave" ? "Sick leave" : "Day off";
}

function eventGroup(type: CalendarItem["type"]) {
  if (type === "task") {
    return "tasks";
  }

  if (type === "day_off" || type === "sick_leave") {
    return "timeOff";
  }

  return "publishing";
}

function eventTone(item: CalendarItem, today: string) {
  const overdue = item.type === "task" && item.startsAt.slice(0, 10) < today && !["completed", "closed"].includes(item.status);

  if (overdue) {
    return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-200";
  }

  if (item.type === "task") {
    return "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200";
  }

  if (item.type === "idea" || item.type === "content") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
  }

  return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200";
}

function itemTime(item: CalendarItem) {
  if (item.type === "task") {
    return "Due";
  }

  if (item.type === "day_off" || item.type === "sick_leave") {
    return "All day";
  }

  return formatCairoTime(item.startsAt);
}

function EventChip({ item, today, compact = false }: { item: CalendarItem; today: string; compact?: boolean }) {
  const content = (
    <span
      className={cn(
        "block min-w-0 rounded-lg border px-2 py-1.5 text-left text-[11px] leading-4 shadow-sm transition hover:ring-2 hover:ring-primary/20",
        eventTone(item, today)
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="size-1.5 shrink-0 rounded-full bg-current" />
        <span className="truncate font-semibold">{item.title}</span>
      </span>
      {!compact && (
        <span className="mt-0.5 block truncate opacity-80">
          {[itemTime(item), item.clientName].filter(Boolean).join(" / ")}
        </span>
      )}
    </span>
  );

  return item.href ? (
    <Link href={item.href} aria-label={`Open ${item.title}`}>
      {content}
    </Link>
  ) : content;
}

function DayAgenda({
  day,
  items,
  today,
  canReviewTimeOff,
}: {
  day: string;
  items: CalendarItem[];
  today: string;
  canReviewTimeOff: boolean;
}) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        No task due dates, publishing dates, day off, or sick leave records for this day.
      </div>
    );
  }

  const groups = [
    { id: "tasks", title: "Tasks", items: items.filter((item) => eventGroup(item.type) === "tasks") },
    { id: "publishing", title: "Publishing", items: items.filter((item) => eventGroup(item.type) === "publishing") },
    { id: "timeOff", title: "Time off", items: items.filter((item) => eventGroup(item.type) === "timeOff") },
  ];

  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <section key={group.id} className="rounded-2xl border bg-card/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{group.title}</h3>
            <Badge variant="secondary">{group.items.length}</Badge>
          </div>
          <div className="grid gap-2">
            {group.items.map((item) => (
              <div key={`${item.type}-${item.id}`} className="rounded-xl border bg-background p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatCairoDateTime(item.startsAt)}
                      {item.endsAt !== item.startsAt ? ` to ${formatCairoDateTime(item.endsAt)}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className={eventTone(item, today)}>
                    {eventLabel(item.type)}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {item.clientName && <span>Client: {item.clientName}</span>}
                  {item.owner && <span>Owner: {item.owner}</span>}
                  <span>Status: {item.status.replaceAll("_", " ")}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {item.href && (
                    <Link href={item.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      Open record
                    </Link>
                  )}
                  {canReviewTimeOff && (item.type === "day_off" || item.type === "sick_leave") && item.status === "pending" && (
                    <>
                      {(["approved", "rejected"] as const).map((decision) => (
                        <form key={decision} action={reviewTimeOffRequestAction}>
                          <input type="hidden" name="requestId" value={item.id} />
                          <input type="hidden" name="decision" value={decision} />
                          <input type="hidden" name="redirectTo" value={calendarHref("day", day)} />
                          <Button type="submit" variant={decision === "approved" ? "default" : "outline"} size="sm">
                            {decision === "approved" ? "Approve" : "Reject"}
                          </Button>
                        </form>
                      ))}
                    </>
                  )}
                </div>
              </div>
            ))}
            {!group.items.length && (
              <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                No {group.title.toLowerCase()}.
              </p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function DaySheet({ day, items, today, canReviewTimeOff }: { day: string; items: CalendarItem[]; today: string; canReviewTimeOff: boolean }) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <button
            type="button"
            className="inline-flex min-h-9 items-center rounded-full px-2 text-left text-xs font-semibold transition hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        {formatDate(day, { weekday: "short", month: "short", day: "numeric" })}
      </SheetTrigger>
      <SheetContent side="right" className="inset-0 h-full w-full overflow-y-auto p-0 sm:inset-y-0 sm:left-auto sm:w-[min(40rem,94vw)] sm:max-w-none">
        <SheetHeader className="border-b px-5 py-5">
          <SheetTitle>{formatDate(day, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</SheetTitle>
          <SheetDescription>
            {items.length} scheduled item{items.length === 1 ? "" : "s"} in {CONTENTO_TIME_ZONE}.
          </SheetDescription>
        </SheetHeader>
        <div className="p-5">
          <DayAgenda day={day} items={items} today={today} canReviewTimeOff={canReviewTimeOff} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CalendarToolbar({ view, anchorDate, today, range }: { view: CalendarView; anchorDate: string; today: string; range: CalendarRange }) {
  const previousDate = shiftAnchor(anchorDate, view, -1);
  const nextDate = shiftAnchor(anchorDate, view, 1);

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border bg-background p-1">
            {viewOptions.map((option) => (
              <Link
                key={option}
                href={calendarHref(option, anchorDate)}
                className={cn(
                  "inline-flex min-h-8 items-center justify-center rounded-md px-3 text-sm font-medium capitalize transition",
                  view === option ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {option}
              </Link>
            ))}
          </div>
          <Badge variant="secondary" className="min-h-8 px-3">
            {formatRange(range, view)}
          </Badge>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <form action="/calendar" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="view" value={view} />
            <div className="space-y-1.5">
              <Label htmlFor="calendar-date" className="text-xs">Jump to date</Label>
              <Input id="calendar-date" name="date" type="date" defaultValue={anchorDate} className="h-9 w-[10.5rem]" />
            </div>
            <Button type="submit" variant="outline" className="min-h-9">
              <CalendarDays />
              Apply
            </Button>
          </form>
          <Link href={calendarHref(view, previousDate)} className={buttonVariants({ variant: "outline", size: "icon-lg" })}>
            <ChevronLeft />
            <span className="sr-only">Previous</span>
          </Link>
          <Link href={calendarHref(view, today)} className={buttonVariants({ variant: "secondary", size: "lg" })}>
            Today
          </Link>
          <Link href={calendarHref(view, nextDate)} className={buttonVariants({ variant: "outline", size: "icon-lg" })}>
            <ChevronRight />
            <span className="sr-only">Next</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function RequestTimeOffButton({ anchorDate, redirectTo }: { anchorDate: string; redirectTo: string }) {
  return (
    <FormSheet
      title="Request time off"
      description="Submit a day off or sick leave request for the selected Cairo calendar date."
      triggerLabel="Request time off"
      triggerClassName="fixed bottom-5 right-5 z-20 shadow-lg sm:static sm:shadow-none"
    >
      <form action={createTimeOffRequestAction} className="grid gap-4 lg:grid-cols-2">
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
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="reason">Reason</Label>
          <textarea
            id="reason"
            name="reason"
            required
            className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <div className="lg:col-span-2">
          <Button type="submit">
            <Send />
            Submit request
          </Button>
        </div>
      </form>
    </FormSheet>
  );
}

function MonthView({
  days,
  activeMonth,
  anchorDate,
  today,
  items,
  canReviewTimeOff,
}: {
  days: Date[];
  activeMonth: number;
  anchorDate: string;
  today: string;
  items: CalendarItem[];
  canReviewTimeOff: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="hidden h-11 grid-cols-7 border-b bg-secondary/30 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:grid">
        {weekdays.map((day) => (
          <div key={day} className="flex items-center justify-center px-2">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-7">
        {days.map((date) => {
          const day = dateKey(date);
          const records = itemsForDay(items, day);
          const visibleRecords = records.slice(0, 3);
          const outsideMonth = date.getMonth() !== activeMonth;
          const isToday = day === today;
          const isSelected = day === anchorDate;

          return (
            <div
              key={day}
              className={cn(
                "min-h-36 overflow-hidden border-b p-3 transition-colors sm:border-r sm:p-2",
                outsideMonth && "bg-secondary/20 text-muted-foreground",
                isSelected && "bg-primary/5",
                isToday && "ring-1 ring-inset ring-primary/40"
              )}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <DaySheet day={day} items={records} today={today} canReviewTimeOff={canReviewTimeOff} />
                <Badge variant={records.length ? "secondary" : "outline"} className="h-5 px-1.5 text-[10px]">
                  {records.length}
                </Badge>
              </div>
              <div className="grid gap-1.5">
                {visibleRecords.map((item) => (
                  <EventChip key={`${item.type}-${item.id}-${day}`} item={item} today={today} compact />
                ))}
                {records.length > visibleRecords.length && (
                  <Link href={calendarHref("day", day)} className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10">
                    +{records.length - visibleRecords.length} more
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  days,
  anchorDate,
  today,
  items,
  canReviewTimeOff,
}: {
  days: Date[];
  anchorDate: string;
  today: string;
  items: CalendarItem[];
  canReviewTimeOff: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-7">
        {days.map((date) => {
          const day = dateKey(date);
          const records = itemsForDay(items, day);

          return (
            <div key={day} className={cn("min-h-72 border-b p-3 md:border-r", day === anchorDate && "bg-primary/5", day === today && "ring-1 ring-inset ring-primary/40")}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <DaySheet day={day} items={records} today={today} canReviewTimeOff={canReviewTimeOff} />
                <Badge variant="secondary">{records.length}</Badge>
              </div>
              <div className="grid gap-2">
                {records.map((item) => (
                  <EventChip key={`${item.type}-${item.id}-${day}`} item={item} today={today} />
                ))}
                {!records.length && (
                  <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No events
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ContentoCalendar({
  view,
  anchorDate,
  today,
  range,
  items,
  canRequestTimeOff,
  canReviewTimeOff,
}: {
  view: CalendarView;
  anchorDate: string;
  today: string;
  range: CalendarRange;
  items: CalendarItem[];
  canRequestTimeOff: boolean;
  canReviewTimeOff: boolean;
}) {
  const days = calendarDays(view, range);
  const activeMonth = range.start.getMonth();
  const selectedItems = itemsForDay(items, anchorDate);
  const counts = {
    tasks: items.filter((item) => item.type === "task").length,
    publishing: items.filter((item) => item.type === "idea" || item.type === "content").length,
    timeOff: items.filter((item) => item.type === "day_off" || item.type === "sick_leave").length,
  };

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <CalendarCheck2 className="size-4" />
              Calendar
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">Content calendar</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Plan task due dates, publishing moments, scheduled content, and availability in {CONTENTO_TIME_ZONE}.
            </p>
          </div>
          {canRequestTimeOff && <RequestTimeOffButton anchorDate={anchorDate} redirectTo={calendarHref(view, anchorDate)} />}
        </div>
        <div className="grid gap-2 border-t bg-secondary/20 p-4 sm:grid-cols-3">
          <div className="flex items-center gap-2 rounded-xl border bg-background p-3">
            <ListFilter className="size-4 text-indigo-600 dark:text-indigo-300" />
            <div>
              <p className="text-sm font-semibold">{counts.tasks}</p>
              <p className="text-xs text-muted-foreground">Task due dates</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border bg-background p-3">
            <CalendarDays className="size-4 text-emerald-600 dark:text-emerald-300" />
            <div>
              <p className="text-sm font-semibold">{counts.publishing}</p>
              <p className="text-xs text-muted-foreground">Publishing items</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border bg-background p-3">
            <Clock3 className="size-4 text-amber-600 dark:text-amber-300" />
            <div>
              <p className="text-sm font-semibold">{counts.timeOff}</p>
              <p className="text-xs text-muted-foreground">Time off records</p>
            </div>
          </div>
        </div>
      </div>

      <CalendarToolbar view={view} anchorDate={anchorDate} today={today} range={range} />

      {view === "month" && (
        <MonthView
          days={days}
          activeMonth={activeMonth}
          anchorDate={anchorDate}
          today={today}
          items={items}
          canReviewTimeOff={canReviewTimeOff}
        />
      )}

      {view === "week" && (
        <WeekView
          days={days}
          anchorDate={anchorDate}
          today={today}
          items={items}
          canReviewTimeOff={canReviewTimeOff}
        />
      )}

      {view === "day" && (
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{formatDate(anchorDate, { weekday: "long", month: "long", day: "numeric" })}</p>
              <p className="text-xs text-muted-foreground">{selectedItems.length} scheduled item{selectedItems.length === 1 ? "" : "s"}</p>
            </div>
            <DaySheet day={anchorDate} items={selectedItems} today={today} canReviewTimeOff={canReviewTimeOff} />
          </div>
          <DayAgenda day={anchorDate} items={selectedItems} today={today} canReviewTimeOff={canReviewTimeOff} />
        </div>
      )}
    </div>
  );
}
