import type { ReactNode } from "react";
import { CalendarCheck2, CalendarDays, Clock3, ListFilter } from "lucide-react";

import { CalendarToolbar } from "@/components/calendar/calendar-toolbar";
import { DayView } from "@/components/calendar/day-view";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { Badge } from "@/components/ui/badge";
import { CONTENTO_TIME_ZONE } from "@/lib/time";
import type { CalendarItem } from "@/lib/workflows/queries";
import { calendarDays, normalizeCalendarView } from "./calendar-utils";
import type { CalendarRange, CalendarView } from "./calendar-types";

export { normalizeCalendarView };
export type { CalendarRange, CalendarView };

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
        </div>
        <div className="grid gap-2 border-t bg-secondary/20 p-4 sm:grid-cols-3">
          <CalendarStat icon={<ListFilter className="size-4 text-indigo-600 dark:text-indigo-300" />} value={counts.tasks} label="Task due dates" />
          <CalendarStat icon={<CalendarDays className="size-4 text-emerald-600 dark:text-emerald-300" />} value={counts.publishing} label="Publishing items" />
          <CalendarStat icon={<Clock3 className="size-4 text-amber-600 dark:text-amber-300" />} value={counts.timeOff} label="Time off records" />
        </div>
      </div>

      <CalendarToolbar view={view} anchorDate={anchorDate} today={today} range={range} canRequestTimeOff={canRequestTimeOff} />

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
        <DayView
          anchorDate={anchorDate}
          today={today}
          items={items}
          canReviewTimeOff={canReviewTimeOff}
        />
      )}
    </div>
  );
}

function CalendarStat({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-background p-3">
      {icon}
      <div>
        <Badge variant="secondary" className="mb-1">{value}</Badge>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
