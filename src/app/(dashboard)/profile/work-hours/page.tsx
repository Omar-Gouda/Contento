import type { Metadata } from "next";
import { Clock, Coffee, LogOut, TimerReset } from "lucide-react";

import {
  clockInAndRefreshAction,
  clockOutAndRefreshAction,
  endBreakAndRefreshAction,
  startBreakAndRefreshAction,
} from "@/lib/work-hours/actions";
import { getCurrentUserWorkHours } from "@/lib/work-hours/queries";
import { requirePermission } from "@/lib/auth/context";
import {
  CONTENTO_TIME_ZONE,
  formatCairoTime,
  minutesLabel,
} from "@/lib/time";
import { PageMessage } from "@/components/admin/page-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignOutButton } from "@/components/forms/sign-out-button";

export const metadata: Metadata = {
  title: "Work hours",
};

export default async function ProfileWorkHoursPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const params = await searchParams;
  const context = await requirePermission("work_hours.view_own", "view");
  const workHours = await getCurrentUserWorkHours(context);
  const activeBreak = Boolean(workHours.activeBreakSession);
  const activeWork = Boolean(workHours.activeWorkSession);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Profile</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">Work hours</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Today&apos;s working time uses the {CONTENTO_TIME_ZONE} calendar date, regardless of device timezone.
        </p>
      </div>

      <PageMessage
        error={params.error === "active-break" ? "End your active break before signing out." : undefined}
        status={params.notice}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <Clock className="size-5 text-primary" />
            <CardTitle>Clock in</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCairoTime(workHours.workDay?.first_sign_in_at)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <TimerReset className="size-5 text-primary" />
            <CardTitle>Worked</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {minutesLabel(workHours.workedMinutes)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Coffee className="size-5 text-primary" />
            <CardTitle>Break used</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {minutesLabel(workHours.breakMinutes)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <LogOut className="size-5 text-primary" />
            <CardTitle>Missing time</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {minutesLabel(workHours.missingMinutes)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current session</CardTitle>
          <CardDescription>Break allowance is 90 minutes per day and can be split.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant={activeWork ? "default" : "secondary"}>
              {activeWork ? "Work session active" : "No active work session"}
            </Badge>
            <Badge variant={activeBreak ? "secondary" : "outline"}>
              {activeBreak ? "Break active" : "No active break"}
            </Badge>
            <Badge variant="outline">
              {minutesLabel(workHours.remainingBreakMinutes)} break remaining
            </Badge>
            <Badge variant="outline">
              Status: {workHours.workDay?.status ?? "incomplete"}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-3">
            {activeBreak ? (
              <form action={endBreakAndRefreshAction}>
                <Button type="submit">
                  <Coffee />
                  End break
                </Button>
              </form>
            ) : !activeWork ? (
              <form action={clockInAndRefreshAction}>
                <Button type="submit">
                  <Clock />
                  Clock in
                </Button>
              </form>
            ) : (
              <form action={startBreakAndRefreshAction}>
                <Button type="submit" variant="outline" disabled={!activeWork}>
                  <Coffee />
                  Start break
                </Button>
              </form>
            )}
            {activeWork && !activeBreak && (
              <form action={clockOutAndRefreshAction}>
                <Button type="submit" variant="outline">
                  <LogOut />
                  Clock out
                </Button>
              </form>
            )}
            <SignOutButton hasActiveWorkSession={activeWork} hasActiveBreak={activeBreak} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Break history</CardTitle>
          <CardDescription>Saved break records for today in Cairo time.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="border-b px-3 py-2 font-medium">Work date</th>
                  <th className="border-b px-3 py-2 font-medium">Start</th>
                  <th className="border-b px-3 py-2 font-medium">End</th>
                  <th className="border-b px-3 py-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {workHours.breakSessions.map((breakSession) => (
                  <tr key={breakSession.id}>
                    <td className="border-b px-3 py-4">{workHours.workDay?.work_date ?? "Today"}</td>
                    <td className="border-b px-3 py-4">{formatCairoTime(breakSession.started_at)}</td>
                    <td className="border-b px-3 py-4">{formatCairoTime(breakSession.ended_at)}</td>
                    <td className="border-b px-3 py-4">{minutesLabel(breakSession.displayDurationMinutes)}</td>
                  </tr>
                ))}
                {!workHours.breakSessions.length && (
                  <tr>
                    <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                      No breaks have been recorded for today.
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
