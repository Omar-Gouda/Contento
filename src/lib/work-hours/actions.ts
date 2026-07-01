"use server";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type WorkHoursActionResult = {
  success: boolean;
  message: string;
};

export async function clockInForSupabaseClient(supabase: SupabaseClient<Database>) {
  try {
    const { error } = await supabase.rpc("record_work_sign_in", {});

    if (error) {
      console.warn("Contento work-hours sign-in tracking failed", error.message);
    }
  } catch (error) {
    console.warn("Contento work-hours sign-in tracking failed", error);
  }
}

export async function clockOutForSupabaseClient(supabase: SupabaseClient<Database>) {
  try {
    const { data, error } = await supabase.rpc("record_work_sign_out", {});

    if (error) {
      console.warn("Contento work-hours sign-out tracking failed", error.message);
      return "tracking_failed";
    }

    return data ?? "no_active_session";
  } catch (error) {
    console.warn("Contento work-hours sign-out tracking failed", error);
    return "tracking_failed";
  }
}

export async function recordSignInForSupabaseClient(supabase: SupabaseClient<Database>) {
  return clockInForSupabaseClient(supabase);
}

export async function recordSignOutForSupabaseClient(supabase: SupabaseClient<Database>) {
  return clockOutForSupabaseClient(supabase);
}

export async function clockInAndRefreshAction() {
  const supabase = await createSupabaseServerClient();
  await clockInForSupabaseClient(supabase);
  redirect("/profile/work-hours?notice=clocked-in");
}

export async function clockOutAndRefreshAction() {
  const supabase = await createSupabaseServerClient();
  const status = await clockOutForSupabaseClient(supabase);

  if (status === "active_break") {
    redirect("/profile/work-hours?error=active-break");
  }

  redirect("/profile/work-hours?notice=clocked-out");
}

export async function startBreakAction(): Promise<WorkHoursActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("start_break_session", {});

  if (error) {
    return { success: false, message: "We could not start your break right now." };
  }

  if (data === "started") {
    return { success: true, message: "Break started." };
  }

  if (data === "break_already_active") {
    return { success: false, message: "You already have an active break." };
  }

  return { success: false, message: "You need an active work session before starting a break." };
}

export async function endBreakAction(): Promise<WorkHoursActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("end_break_session", {});

  if (error) {
    return { success: false, message: "We could not end your break right now." };
  }

  if (data === "ended") {
    return { success: true, message: "Break ended." };
  }

  return { success: false, message: "There is no active break to end." };
}

export async function startBreakAndRefreshAction() {
  await startBreakAction();
  redirect("/profile/work-hours?notice=break-started");
}

export async function endBreakAndRefreshAction() {
  await endBreakAction();
  redirect("/profile/work-hours?notice=break-ended");
}
