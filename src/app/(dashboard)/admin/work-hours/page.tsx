import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";

import {
  getCompanyBreakSessions,
  getCompanyWorkDays,
} from "@/lib/admin/queries";
import { requirePermission } from "@/lib/auth/context";
import {
  CONTENTO_TIME_ZONE,
  formatCairoTime,
  getCairoDate,
  minutesLabel,
} from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = {
  title: "Admin work hours",
};

export default async function AdminWorkHoursPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("work_hours.view_company", "view");
  const selectedDate = params.date || getCairoDate();
  const [workDays, breakSessions] = await Promise.all([
    getCompanyWorkDays(context, selectedDate),
    getCompanyBreakSessions(context, selectedDate),
  ]);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Company work hours</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Review company working-hour summaries by Cairo work date ({CONTENTO_TIME_ZONE}).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Date filter</CardTitle>
          <CardDescription>Only real work-day rows are shown for the selected date.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/admin/work-hours" className="flex max-w-md flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="date" name="date" type="date" defaultValue={selectedDate} className="pl-9" />
              </div>
            </div>
            <Button type="submit" className="w-fit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily attendance</CardTitle>
          <CardDescription>{workDays.length} work-day records found.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="border-b px-3 py-2 font-medium">User</th>
                  <th className="border-b px-3 py-2 font-medium">User status</th>
                  <th className="border-b px-3 py-2 font-medium">Date</th>
                  <th className="border-b px-3 py-2 font-medium">First sign-in</th>
                  <th className="border-b px-3 py-2 font-medium">Last sign-out</th>
                  <th className="border-b px-3 py-2 font-medium">Worked</th>
                  <th className="border-b px-3 py-2 font-medium">Break</th>
                  <th className="border-b px-3 py-2 font-medium">Missing</th>
                  <th className="border-b px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {workDays.map((workDay) => (
                  <tr key={workDay.id}>
                    <td className="border-b px-3 py-4">
                      <div className="font-medium">{workDay.userName}</div>
                      <div className="text-muted-foreground">{workDay.userEmail}</div>
                    </td>
                    <td className="border-b px-3 py-4">
                      <Badge variant={workDay.userStatus === "active" ? "default" : "secondary"}>
                        {workDay.userStatus ?? "unknown"}
                      </Badge>
                    </td>
                    <td className="border-b px-3 py-4">{workDay.work_date}</td>
                    <td className="border-b px-3 py-4">{formatCairoTime(workDay.first_sign_in_at)}</td>
                    <td className="border-b px-3 py-4">{formatCairoTime(workDay.last_sign_out_at)}</td>
                    <td className="border-b px-3 py-4">{minutesLabel(workDay.total_worked_minutes)}</td>
                    <td className="border-b px-3 py-4">{minutesLabel(workDay.total_break_minutes)}</td>
                    <td className="border-b px-3 py-4">{minutesLabel(workDay.total_missing_minutes)}</td>
                    <td className="border-b px-3 py-4">
                      <Badge variant={workDay.status === "active" ? "default" : "secondary"}>
                        {workDay.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {!workDays.length && (
                  <tr>
                    <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                      No work-hour records exist for this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Break history</CardTitle>
          <CardDescription>{breakSessions.length} break records found for the selected Cairo date.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="border-b px-3 py-2 font-medium">User</th>
                  <th className="border-b px-3 py-2 font-medium">Work date</th>
                  <th className="border-b px-3 py-2 font-medium">Start</th>
                  <th className="border-b px-3 py-2 font-medium">End</th>
                  <th className="border-b px-3 py-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {breakSessions.map((breakSession) => (
                  <tr key={breakSession.id}>
                    <td className="border-b px-3 py-4">
                      <div className="font-medium">{breakSession.userName}</div>
                      <div className="text-muted-foreground">{breakSession.userEmail}</div>
                    </td>
                    <td className="border-b px-3 py-4">{breakSession.workDate}</td>
                    <td className="border-b px-3 py-4">{formatCairoTime(breakSession.started_at)}</td>
                    <td className="border-b px-3 py-4">{formatCairoTime(breakSession.ended_at)}</td>
                    <td className="border-b px-3 py-4">{minutesLabel(breakSession.duration_minutes)}</td>
                  </tr>
                ))}
                {!breakSessions.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                      No breaks were recorded for this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
