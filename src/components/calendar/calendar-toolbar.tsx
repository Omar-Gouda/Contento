import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Send } from "lucide-react";

import { FormSheet } from "@/components/dashboard/form-sheet";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTimeOffRequestAction } from "@/lib/workflows/actions";
import { cn } from "@/lib/utils";
import {
  calendarHref,
  formatRange,
  selectClass,
  shiftAnchor,
  viewOptions,
} from "./calendar-utils";
import type { CalendarRange, CalendarView } from "./calendar-types";

export function CalendarToolbar({
  view,
  anchorDate,
  today,
  range,
  canRequestTimeOff,
}: {
  view: CalendarView;
  anchorDate: string;
  today: string;
  range: CalendarRange;
  canRequestTimeOff: boolean;
}) {
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
          {canRequestTimeOff && <RequestTimeOffButton anchorDate={anchorDate} redirectTo={calendarHref(view, anchorDate)} />}
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
