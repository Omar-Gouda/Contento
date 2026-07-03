import type { CalendarItem } from "@/lib/workflows/queries";
import { CONTENTO_TIME_ZONE, formatCairoTime } from "@/lib/time";
import type { CalendarRange, CalendarView } from "./calendar-types";

export const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const viewOptions: CalendarView[] = ["month", "week", "day"];
export const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function normalizeCalendarView(view: string | undefined): CalendarView {
  return view === "week" || view === "day" ? view : "month";
}

export function dateKey(date: Date) {
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

export function shiftAnchor(anchorDate: string, view: CalendarView, direction: -1 | 1) {
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

export function calendarDays(view: CalendarView, range: CalendarRange) {
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

export function calendarHref(view: CalendarView, date: string) {
  return `/calendar?view=${view}&date=${date}`;
}

export function itemsForDay(items: CalendarItem[], day: string) {
  return items.filter((item) => item.startsAt.slice(0, 10) <= day && item.endsAt.slice(0, 10) >= day);
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CONTENTO_TIME_ZONE,
    ...options,
  }).format(new Date(`${value}T12:00:00`));
}

export function formatRange(range: CalendarRange, view: CalendarView) {
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

export function eventLabel(type: CalendarItem["type"]) {
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

export function eventGroup(type: CalendarItem["type"]) {
  if (type === "task") {
    return "tasks";
  }

  if (type === "day_off" || type === "sick_leave") {
    return "timeOff";
  }

  return "publishing";
}

export function eventTone(item: CalendarItem, today: string) {
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

export function itemTime(item: CalendarItem) {
  if (item.type === "task") {
    return "Due";
  }

  if (item.type === "day_off" || item.type === "sick_leave") {
    return "All day";
  }

  return formatCairoTime(item.startsAt);
}
