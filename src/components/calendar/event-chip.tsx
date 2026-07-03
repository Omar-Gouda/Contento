import Link from "next/link";

import type { CalendarItem } from "@/lib/workflows/queries";
import { cn } from "@/lib/utils";
import { eventTone, itemTime } from "./calendar-utils";

export function EventChip({
  item,
  today,
  compact = false,
  tiny = false,
}: {
  item: CalendarItem;
  today: string;
  compact?: boolean;
  tiny?: boolean;
}) {
  const content = (
    <span
      className={cn(
        "block min-w-0 rounded-lg border px-2 py-1.5 text-left text-[11px] leading-4 shadow-sm transition hover:ring-2 hover:ring-primary/20",
        tiny && "rounded-md px-1 py-0.5 text-[9px] leading-3",
        eventTone(item, today)
      )}
    >
      <span className={cn("flex min-w-0 items-center gap-1.5", tiny && "gap-1")}>
        <span className={cn("size-1.5 shrink-0 rounded-full bg-current", tiny && "size-1")} />
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
