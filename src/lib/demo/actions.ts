"use server";

import { redirect } from "next/navigation";

import { resolveAuthProfile } from "@/lib/auth/context";
import { cleanupCurrentDemoSession, createDemoSessionForCurrentUser, seedDemoData, setDemoCookies } from "@/lib/demo/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDefaultDashboardPath, type UserRole } from "@/types/roles";
import { demoRoles, getDemoRoleConfig } from "./config";

function formRole(formData: FormData): UserRole | null {
  const value = formData.get("role");

  if (typeof value !== "string") {
    return null;
  }

  return demoRoles.some((demoRole) => demoRole.role === value) ? value as UserRole : null;
}

export async function selectDemoRoleAction(formData: FormData) {
  const selectedRole = formRole(formData);

  if (!selectedRole || !getDemoRoleConfig(selectedRole)) {
    redirect("/demo/choose-role?error=invalid-role");
  }

  const supabase = await createSupabaseServerClient();
  const resolution = await resolveAuthProfile();

  if (resolution.state !== "active" && resolution.state !== "demo_needs_role") {
    redirect("/sign-in");
  }

  const context = resolution.state === "active" ? resolution.context : null;
  const isDemo = resolution.state === "demo_needs_role" || context?.isDemo;

  if (!isDemo) {
    redirect(context ? getDefaultDashboardPath(context.role) : "/sign-in");
  }

  const sessionId = resolution.state === "demo_needs_role"
    ? await createDemoSessionForCurrentUser(supabase)
    : context?.demoSessionId ?? await createDemoSessionForCurrentUser(supabase);

  if (!sessionId) {
    redirect("/demo/choose-role?error=session");
  }

  await setDemoCookies(sessionId, selectedRole);
  await seedDemoData(sessionId, selectedRole);
  redirect(getDefaultDashboardPath(selectedRole));
}

export async function resetDemoSessionAction() {
  const resolution = await resolveAuthProfile();

  if (resolution.state !== "active" || !resolution.context.isDemo || !resolution.context.demoSessionId) {
    redirect("/sign-in");
  }

  const role = resolution.context.role;
  await seedDemoData(resolution.context.demoSessionId, role);
  redirect(getDefaultDashboardPath(role));
}

export async function cleanupDemoSessionAction() {
  await cleanupCurrentDemoSession();
}
