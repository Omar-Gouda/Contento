import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { CalendarItem } from "@/lib/workflows/queries";
import { cn } from "@/lib/utils";
import { calendarHref, dateKey, itemsForDay, weekdays } from "./calendar-utils";
import { DaySheet } from "./day-agenda";
import { EventChip } from "./event-chip";

export function MonthView({
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
      <div className="grid h-8 grid-cols-7 border-b bg-secondary/30 text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:h-11 sm:text-[11px] sm:tracking-[0.14em]">
        {weekdays.map((day) => (
          <div key={day} className="flex items-center justify-center px-1 sm:px-2">
            <span className="sm:hidden">{day[0]}</span>
            <span className="hidden sm:inline">{day}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date) => {
          const day = dateKey(date);
          const records = itemsForDay(items, day);
          const mobileRecord = records[0] ?? null;
          const visibleRecords = records.slice(0, 3);
          const outsideMonth = date.getMonth() !== activeMonth;
          const isToday = day === today;
          const isSelected = day === anchorDate;

          return (
            <div
              key={day}
              className={cn(
                "min-h-16 overflow-hidden border-b border-r p-1 transition-colors sm:min-h-36 sm:p-2",
                outsideMonth && "bg-secondary/20 text-muted-foreground",
                isSelected && "bg-primary/5",
                isToday && "ring-1 ring-inset ring-primary/40"
              )}
            >
              <div className="mb-1 flex min-w-0 items-center justify-between gap-0.5 sm:mb-2 sm:gap-2">
                <DaySheet day={day} items={records} today={today} canReviewTimeOff={canReviewTimeOff} compactOnMobile />
                {records.length ? (
                  <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[9px] sm:h-5 sm:px-1.5 sm:text-[10px]">
                    {records.length}
                  </Badge>
                ) : (
                  <span className="size-4 shrink-0" aria-hidden="true" />
                )}
              </div>
              <div className="grid gap-1 sm:hidden">
                {mobileRecord && <EventChip item={mobileRecord} today={today} compact tiny />}
                {records.length > 1 && (
                  <Link href={calendarHref("day", day)} className="truncate rounded px-1 text-[9px] font-semibold leading-3 text-primary hover:bg-primary/10">
                    +{records.length - 1}
                  </Link>
                )}
              </div>
              <div className="hidden gap-1.5 sm:grid">
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
