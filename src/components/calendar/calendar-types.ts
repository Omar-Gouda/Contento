import type { CalendarItem } from "@/lib/workflows/queries";

export type CalendarView = "month" | "week" | "day";

export type CalendarRange = {
  view: CalendarView;
  start: Date;
  end: Date;
};

export type CalendarViewProps = {
  anchorDate: string;
  today: string;
  items: CalendarItem[];
  canReviewTimeOff: boolean;
};
