import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CONTENTO_TIME_ZONE, formatCairoDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { reviewTimeOffRequestAction } from "@/lib/workflows/actions";
import type { CalendarItem } from "@/lib/workflows/queries";
import { calendarHref, eventGroup, eventLabel, eventTone, formatDate } from "./calendar-utils";

export function DayAgenda({
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

export function DaySheet({
  day,
  items,
  today,
  canReviewTimeOff,
  compactOnMobile = false,
}: {
  day: string;
  items: CalendarItem[];
  today: string;
  canReviewTimeOff: boolean;
  compactOnMobile?: boolean;
}) {
  const fullLabel = formatDate(day, { weekday: "short", month: "short", day: "numeric" });
  const mobileLabel = formatDate(day, { day: "numeric" });

  return (
    <Sheet>
      <SheetTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex min-h-9 items-center rounded-full px-2 text-left text-xs font-semibold transition hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring",
              compactOnMobile && "min-h-6 px-1 text-[11px] sm:min-h-9 sm:px-2 sm:text-xs"
            )}
          />
        }
      >
        {compactOnMobile ? (
          <>
            <span className="sm:hidden">{mobileLabel}</span>
            <span className="hidden sm:inline">{fullLabel}</span>
          </>
        ) : fullLabel}
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl p-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-[min(40rem,94vw)] sm:max-w-none sm:rounded-none sm:border-l sm:border-t-0"
      >
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
