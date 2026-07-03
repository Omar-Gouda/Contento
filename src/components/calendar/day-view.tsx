import { Badge } from "@/components/ui/badge";
import type { CalendarItem } from "@/lib/workflows/queries";
import { formatDate, itemsForDay } from "./calendar-utils";
import { DayAgenda, DaySheet } from "./day-agenda";

export function DayView({
  anchorDate,
  today,
  items,
  canReviewTimeOff,
}: {
  anchorDate: string;
  today: string;
  items: CalendarItem[];
  canReviewTimeOff: boolean;
}) {
  const selectedItems = itemsForDay(items, anchorDate);

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{formatDate(anchorDate, { weekday: "long", month: "long", day: "numeric" })}</p>
          <p className="text-xs text-muted-foreground">{selectedItems.length} scheduled item{selectedItems.length === 1 ? "" : "s"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{selectedItems.length}</Badge>
          <DaySheet day={anchorDate} items={selectedItems} today={today} canReviewTimeOff={canReviewTimeOff} />
        </div>
      </div>
      <DayAgenda day={anchorDate} items={selectedItems} today={today} canReviewTimeOff={canReviewTimeOff} />
    </div>
  );
}
