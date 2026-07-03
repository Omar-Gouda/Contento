"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type WorkHoursActionResult = {
  success: boolean;
  message: string;
  state?: "not_clocked_in" | "working" | "on_break" | "clocked_out";
};

export async function clockInForSupabaseClient(supabase: SupabaseClient<Database>) {
  try {
    const { data, error } = await supabase.rpc("record_work_sign_in", {});

    if (error) {
      console.warn("Contento work-hours sign-in tracking failed", error.message);
      return false;
    }

    return data === true;
  } catch (error) {
    console.warn("Contento work-hours sign-in tracking failed", error);
    return false;
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

function formRedirectTo(formData: FormData | undefined, fallback = "/profile/work-hours") {
  const value = formData?.get("redirectTo");
  return value === "/profile/work-hours" ? value : fallback;
}

function redirectWithNotice(pathname: string, key: "notice" | "error", value: string): never {
  const separator = pathname.includes("?") ? "&" : "?";
  redirect(`${pathname}${separator}${key}=${encodeURIComponent(value)}`);
}

function revalidateWorkHoursPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/profile/work-hours");
}

export async function clockInAction(): Promise<WorkHoursActionResult> {
  const supabase = await createSupabaseServerClient();
  const clockedIn = await clockInForSupabaseClient(supabase);
  revalidateWorkHoursPaths();

  if (!clockedIn) {
    return {
      success: false,
      message: "Clock-in could not be recorded. Check your account status and try again.",
    };
  }

  return {
    success: true,
    message: "You are clocked in.",
    state: "working",
  };
}

export async function clockOutAction(): Promise<WorkHoursActionResult> {
  const supabase = await createSupabaseServerClient();
  const status = await clockOutForSupabaseClient(supabase);
  revalidateWorkHoursPaths();

  if (status === "active_break") {
    return {
      success: false,
      message: "End your active break before clocking out.",
      state: "on_break",
    };
  }

  if (status === "tracking_failed") {
    return {
      success: false,
      message: "Clock-out could not be recorded. Please try again.",
    };
  }

  return {
    success: true,
    message: status === "no_active_session" ? "No active work session was open." : "You are clocked out.",
    state: "clocked_out",
  };
}

export async function clockInAndRefreshAction(formData?: FormData) {
  const redirectTo = formRedirectTo(formData);
  const result = await clockInAction();

  if (!result.success) {
    redirectWithNotice(redirectTo, "error", result.message);
  }

  redirectWithNotice(redirectTo, "notice", "clocked-in");
}

export async function clockOutAndRefreshAction(formData?: FormData) {
  const redirectTo = formRedirectTo(formData);
  const result = await clockOutAction();

  if (!result.success) {
    redirectWithNotice(redirectTo, "error", result.message);
  }

  redirectWithNotice(redirectTo, "notice", "clocked-out");
}

export async function startBreakAction(): Promise<WorkHoursActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("start_break_session", {});
  revalidateWorkHoursPaths();

  if (error) {
    return { success: false, message: "We could not start your break right now." };
  }

  if (data === "started") {
    return { success: true, message: "Break started.", state: "on_break" };
  }

  if (data === "break_already_active") {
    return { success: false, message: "You already have an active break.", state: "on_break" };
  }

  return { success: false, message: "You need an active work session before starting a break.", state: "clocked_out" };
}

export async function endBreakAction(): Promise<WorkHoursActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("end_break_session", {});
  revalidateWorkHoursPaths();

  if (error) {
    return { success: false, message: "We could not end your break right now." };
  }

  if (data === "ended") {
    return { success: true, message: "Break ended.", state: "working" };
  }

  return { success: false, message: "There is no active break to end.", state: "working" };
}

export async function startBreakAndRefreshAction(formData?: FormData) {
  const redirectTo = formRedirectTo(formData);
  const result = await startBreakAction();

  if (!result.success) {
    redirectWithNotice(redirectTo, "error", result.message);
  }

  redirectWithNotice(redirectTo, "notice", "break-started");
}

export async function endBreakAndRefreshAction(formData?: FormData) {
  const redirectTo = formRedirectTo(formData);
  const result = await endBreakAction();

  if (!result.success) {
    redirectWithNotice(redirectTo, "error", result.message);
  }

  redirectWithNotice(redirectTo, "notice", "break-ended");
}
