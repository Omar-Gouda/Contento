import type { Metadata } from "next";

import { PageMessage } from "@/components/admin/page-message";
import { ContentoCalendar, normalizeCalendarView } from "@/components/calendar/contento-calendar";
import { requirePermission } from "@/lib/auth/context";
import { hasPermission } from "@/lib/auth/permissions";
import { getCairoDate } from "@/lib/time";
import { getCalendarItems } from "@/lib/workflows/queries";

export const metadata: Metadata = {
  title: "Calendar",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const view = normalizeCalendarView(params.view);
  const anchorDate = params.date || getCairoDate();
  const today = getCairoDate();
  const context = await requirePermission("calendar.view", "view");
  const calendar = await getCalendarItems(context, { view, date: anchorDate });

  return (
    <section className="space-y-6">
      <PageMessage error={params.error} status={params.notice} />
      <ContentoCalendar
        view={view}
        anchorDate={anchorDate}
        today={today}
        range={calendar.range}
        items={calendar.items}
        canRequestTimeOff={hasPermission(context, "day_off.submit", "limited")}
        canReviewTimeOff={hasPermission(context, "day_off.approve", "limited")}
      />
    </section>
  );
}
