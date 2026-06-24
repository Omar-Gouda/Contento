import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth/permissions";
import type { Json } from "@/types/database";

export type DashboardWidgetId = "summary" | "focus" | "shortcuts";

export const defaultDashboardWidgets: DashboardWidgetId[] = ["summary", "focus", "shortcuts"];

function parseWidgets(value: Json): DashboardWidgetId[] {
  if (!Array.isArray(value)) {
    return defaultDashboardWidgets;
  }

  const widgets = value.filter((item): item is DashboardWidgetId =>
    item === "summary" || item === "focus" || item === "shortcuts"
  );

  return widgets.length ? widgets : defaultDashboardWidgets;
}

export async function getDashboardWidgets(context: AuthContext) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("dashboard_preferences")
    .select("widgets_json")
    .eq("company_id", context.companyId)
    .eq("user_id", context.userId)
    .eq("role", context.role)
    .maybeSingle();

  return parseWidgets(data?.widgets_json ?? defaultDashboardWidgets);
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function updateDashboardWidgetsAction(formData: FormData) {
  "use server";

  const context = await requirePermission("dashboard.customize", "limited");
  const widgets = formData.getAll("widgets").filter((value): value is DashboardWidgetId =>
    value === "summary" || value === "focus" || value === "shortcuts"
  );
  const redirectTo = formString(formData, "redirectTo") || `/${context.role}`;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("dashboard_preferences").upsert({
    company_id: context.companyId,
    user_id: context.userId,
    role: context.role,
    widgets_json: widgets.length ? widgets : defaultDashboardWidgets,
  }, {
    onConflict: "user_id,role",
  });

  if (error) {
    redirect(`${redirectTo}?error=${encodeURIComponent("Dashboard preferences could not be saved.")}`);
  }

  redirect(`${redirectTo}?notice=${encodeURIComponent("Dashboard preferences saved.")}`);
}

export async function resetDashboardWidgetsAction(formData: FormData) {
  "use server";

  const context = await requirePermission("dashboard.customize", "limited");
  const redirectTo = formString(formData, "redirectTo") || `/${context.role}`;
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("dashboard_preferences")
    .delete()
    .eq("company_id", context.companyId)
    .eq("user_id", context.userId)
    .eq("role", context.role);

  redirect(`${redirectTo}?notice=${encodeURIComponent("Dashboard preferences reset.")}`);
}
