"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Clock, Coffee, Play, Square } from "lucide-react";

import {
  clockInAndRefreshAction,
  clockOutAndRefreshAction,
  endBreakAndRefreshAction,
  startBreakAndRefreshAction,
} from "@/lib/work-hours/actions";
import type { CurrentWorkHours } from "@/lib/work-hours/queries";
import { minutesLabel } from "@/lib/time";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const promptDismissKey = "contento-work-hours-clock-prompt-dismissed";

function workStatus(workHours: CurrentWorkHours | null) {
  if (!workHours?.workDay) {
    return "Not clocked in";
  }

  if (workHours.activeBreakSession) {
    return "On break";
  }

  if (workHours.activeWorkSession) {
    return "Working";
  }

  return "Clocked out";
}

function statusTone(status: string) {
  if (status === "Working") {
    return "bg-emerald-500";
  }

  if (status === "On break") {
    return "bg-amber-500";
  }

  return "bg-muted-foreground";
}

function ActionForm({
  action,
  children,
  variant = "outline",
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  variant?: "default" | "outline";
}) {
  return (
    <form action={action}>
      <Button type="submit" variant={variant} size="sm" className="w-full justify-start">
        {children}
      </Button>
    </form>
  );
}

export function WorkHoursStatusMenu({ workHours }: { workHours: CurrentWorkHours | null }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const status = workStatus(workHours);
  const activeWork = Boolean(workHours?.activeWorkSession);
  const activeBreak = Boolean(workHours?.activeBreakSession);
  const canClockIn = !activeWork;
  const canClockOut = activeWork && !activeBreak;
  const promptKey = useMemo(() => {
    const workDate = workHours?.workDay?.work_date ?? new Date().toISOString().slice(0, 10);
    return `${promptDismissKey}:${workDate}`;
  }, [workHours?.workDay?.work_date]);

  useEffect(() => {
    if (status !== "Not clocked in" || window.sessionStorage.getItem(promptKey) === "true") {
      return;
    }

    const promptTimer = window.setTimeout(() => setShowPrompt(true), 0);
    return () => window.clearTimeout(promptTimer);
  }, [promptKey, status]);

  function dismissPrompt() {
    window.sessionStorage.setItem(promptKey, "true");
    setShowPrompt(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button type="button" variant="outline" size="sm" className="gap-2" aria-label={`Work status: ${status}`} />
          }
        >
          <span className={`size-2 rounded-full ${statusTone(status)}`} />
          <Clock className="size-4" />
          <span className="hidden lg:inline">{status}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-72 p-2">
          <div className="px-2 py-1.5 text-sm font-semibold">
            Work hours
          </div>
          <div className="grid gap-2 rounded-lg bg-secondary/35 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">{status}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Worked</span>
              <span className="font-medium">{minutesLabel(workHours?.workedMinutes ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Break</span>
              <span className="font-medium">{minutesLabel(workHours?.breakMinutes ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Missing</span>
              <span className="font-medium">{minutesLabel(workHours?.missingMinutes ?? 0)}</span>
            </div>
          </div>
          <DropdownMenuSeparator />
          <div className="grid gap-2">
            {canClockIn && (
              <ActionForm action={clockInAndRefreshAction} variant="default">
                <Play />
                Clock in
              </ActionForm>
            )}
            {activeWork && !activeBreak && (
              <ActionForm action={startBreakAndRefreshAction}>
                <Coffee />
                Start break
              </ActionForm>
            )}
            {activeBreak && (
              <ActionForm action={endBreakAndRefreshAction} variant="default">
                <Coffee />
                End break
              </ActionForm>
            )}
            {canClockOut && (
              <ActionForm action={clockOutAndRefreshAction}>
                <Square />
                Clock out
              </ActionForm>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {showPrompt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clock-in-title"
          className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-xl border bg-card p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="size-5" />
              </div>
              <div>
                <h2 id="clock-in-title" className="text-lg font-semibold">Clock in for today?</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  You are signed in, but working time starts only after you clock in.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={dismissPrompt}>
                Later
              </Button>
              <form action={clockInAndRefreshAction}>
                <Button type="submit">
                  <Play />
                  Clock in
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
