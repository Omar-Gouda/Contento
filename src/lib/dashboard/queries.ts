import type { AuthContext } from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCairoDate } from "@/lib/time";

export type DashboardSummaryMetric = {
  label: string;
  value: number | string;
  description: string;
};

async function safeCount(query: PromiseLike<{ count: number | null; error: unknown }>) {
  const result = await query;
  return result.error ? 0 : result.count ?? 0;
}

export async function getDashboardSummary(context: AuthContext): Promise<DashboardSummaryMetric[]> {
  const supabase = await createSupabaseServerClient();
  const today = getCairoDate();
  const nextWeek = new Date(`${today}T00:00:00`);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekDate = nextWeek.toISOString().slice(0, 10);

  const [
    myOpenTasks,
    dueSoonTasks,
    myContent,
    mySubmittedContent,
    myReports,
    todayWorkDay,
  ] = await Promise.all([
    safeCount(
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("company_id", context.companyId)
        .eq("assigned_to", context.userId)
        .in("status", ["assigned", "in_progress", "under_review"])
    ),
    safeCount(
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("company_id", context.companyId)
        .eq("assigned_to", context.userId)
        .not("due_date", "is", null)
        .lte("due_date", nextWeekDate)
        .neq("status", "closed")
    ),
    safeCount(
      supabase
        .from("content_items")
        .select("id", { count: "exact", head: true })
        .eq("company_id", context.companyId)
        .eq("creator_id", context.userId)
        .neq("status", "archived")
    ),
    safeCount(
      supabase
        .from("content_items")
        .select("id", { count: "exact", head: true })
        .eq("company_id", context.companyId)
        .eq("creator_id", context.userId)
        .in("status", ["submitted_to_team_lead", "sent_to_supervisor", "changes_requested_by_team_lead", "changes_requested_by_supervisor"])
    ),
    safeCount(
      supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("company_id", context.companyId)
        .eq("user_id", context.userId)
    ),
    supabase
      .from("work_days")
      .select("status")
      .eq("company_id", context.companyId)
      .eq("user_id", context.userId)
      .eq("work_date", today)
      .maybeSingle(),
  ]);

  return [
    { label: "My tasks", value: myOpenTasks, description: "Assigned tasks currently in motion." },
    { label: "Due soon", value: dueSoonTasks, description: "Your assigned tasks due within seven days." },
    { label: "My content", value: myContent, description: "Non-archived content items assigned to you." },
    { label: "My submissions", value: mySubmittedContent, description: "Your content currently in review or awaiting changes." },
    { label: "My reports", value: myReports, description: "Reports submitted by your account." },
    {
      label: "Today",
      value: todayWorkDay.data?.status ?? "not started",
      description: "Your Cairo work-day status.",
    },
  ];
}
