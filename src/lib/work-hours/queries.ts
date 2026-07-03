import { unstable_noStore as noStore } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth/permissions";
import {
  DAILY_BREAK_ALLOWANCE_MINUTES,
  getCairoDate,
} from "@/lib/time";
import type { Database } from "@/types/database";

export type CurrentWorkHours = {
  workDay: Database["public"]["Tables"]["work_days"]["Row"] | null;
  activeWorkSession: Database["public"]["Tables"]["work_sessions"]["Row"] | null;
  activeBreakSession: Database["public"]["Tables"]["break_sessions"]["Row"] | null;
  breakSessions: Array<
    Database["public"]["Tables"]["break_sessions"]["Row"] & {
      displayDurationMinutes: number;
    }
  >;
  workedMinutes: number;
  breakMinutes: number;
  remainingBreakMinutes: number;
  missingMinutes: number;
};

function elapsedMinutes(startedAt: string | null) {
  if (!startedAt) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
}

export async function getCurrentUserWorkHours(context: AuthContext): Promise<CurrentWorkHours> {
  noStore();

  const supabase = await createSupabaseServerClient();
  const today = getCairoDate();
  const { data: workDay, error: workDayError } = await supabase
    .from("work_days")
    .select("id, company_id, user_id, work_date, first_sign_in_at, last_sign_out_at, total_worked_minutes, total_break_minutes, total_missing_minutes, status, created_at, updated_at")
    .eq("company_id", context.companyId)
    .eq("user_id", context.userId)
    .eq("work_date", today)
    .maybeSingle();

  if (workDayError) {
    throw new Error("Unable to load today's work hours.");
  }

  const workDayRow = workDay as Database["public"]["Tables"]["work_days"]["Row"] | null;

  if (!workDayRow) {
    return {
      workDay: null,
      activeWorkSession: null,
      activeBreakSession: null,
      breakSessions: [],
      workedMinutes: 0,
      breakMinutes: 0,
      remainingBreakMinutes: DAILY_BREAK_ALLOWANCE_MINUTES,
      missingMinutes: 0,
    };
  }

  const [
    { data: activeWorkSession, error: activeWorkSessionError },
    { data: breakSessions, error: breakSessionsError },
  ] = await Promise.all([
    supabase
      .from("work_sessions")
      .select("id, company_id, user_id, work_day_id, sign_in_at, sign_out_at, duration_minutes, created_at")
      .eq("work_day_id", workDayRow.id)
      .is("sign_out_at", null)
      .order("sign_in_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("break_sessions")
      .select("id, company_id, user_id, work_day_id, started_at, ended_at, duration_minutes, created_at")
      .eq("work_day_id", workDayRow.id)
      .order("started_at", { ascending: false }),
  ]);

  if (activeWorkSessionError) {
    throw new Error("Unable to load active work session.");
  }

  if (breakSessionsError) {
    throw new Error("Unable to load break history.");
  }

  const activeWorkSessionRow =
    activeWorkSession as Database["public"]["Tables"]["work_sessions"]["Row"] | null;
  const breakSessionRows =
    (breakSessions as Database["public"]["Tables"]["break_sessions"]["Row"][] | null) ?? [];
  const activeBreakSessionRow =
    breakSessionRows.find((breakSession) => !breakSession.ended_at) ?? null;
  const breakSessionsWithDurations = breakSessionRows.map((breakSession) => ({
    ...breakSession,
    displayDurationMinutes: breakSession.ended_at
      ? breakSession.duration_minutes
      : elapsedMinutes(breakSession.started_at),
  }));
  const liveWorkMinutes = activeWorkSessionRow ? elapsedMinutes(activeWorkSessionRow.sign_in_at) : 0;
  const liveBreakMinutes = activeBreakSessionRow ? elapsedMinutes(activeBreakSessionRow.started_at) : 0;
  const savedActiveSessionBreakMinutes = activeWorkSessionRow
    ? breakSessionRows.reduce((total, breakSession) => {
        const breakStartedAt = new Date(breakSession.started_at).getTime();
        const workStartedAt = new Date(activeWorkSessionRow.sign_in_at).getTime();

        if (breakStartedAt < workStartedAt) {
          return total;
        }

        return total + breakSession.duration_minutes;
      }, 0)
    : 0;
  const activeSessionBreakMinutes = savedActiveSessionBreakMinutes + liveBreakMinutes;
  const breakMinutes = workDayRow.total_break_minutes + liveBreakMinutes;
  const workedMinutes =
    workDayRow.total_worked_minutes + Math.max(0, liveWorkMinutes - activeSessionBreakMinutes);
  const missingMinutes = Math.max(
    workDayRow.total_missing_minutes,
    breakMinutes - DAILY_BREAK_ALLOWANCE_MINUTES,
    0
  );

  return {
    workDay: workDayRow,
    activeWorkSession: activeWorkSessionRow,
    activeBreakSession: activeBreakSessionRow,
    breakSessions: breakSessionsWithDurations,
    workedMinutes,
    breakMinutes,
    remainingBreakMinutes: Math.max(0, DAILY_BREAK_ALLOWANCE_MINUTES - breakMinutes),
    missingMinutes,
  };
}
