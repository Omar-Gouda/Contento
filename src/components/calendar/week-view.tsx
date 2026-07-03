import { Badge } from "@/components/ui/badge";
import type { CalendarItem } from "@/lib/workflows/queries";
import { cn } from "@/lib/utils";
import { dateKey, itemsForDay } from "./calendar-utils";
import { DaySheet } from "./day-agenda";
import { EventChip } from "./event-chip";

export function WeekView({
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
