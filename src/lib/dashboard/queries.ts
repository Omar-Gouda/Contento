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

  if (context.role === "admin") {
    const [
      totalUsers,
      activeUsers,
      teams,
      openTasks,
      approvedContent,
      reviewedContent,
      reports,
      activeWorkDays,
    ] = await Promise.all([
      safeCount(supabase.from("users").select("id", { count: "exact", head: true }).eq("company_id", context.companyId)),
      safeCount(supabase.from("users").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).eq("status", "active")),
      safeCount(supabase.from("teams").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).eq("status", "active")),
      safeCount(supabase.from("tasks").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).in("status", ["pending", "assigned", "in_progress", "under_review"])),
      safeCount(supabase.from("content_items").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).in("status", ["approved", "scheduled", "published"])),
      safeCount(supabase.from("content_items").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).neq("status", "draft")),
      safeCount(supabase.from("reports").select("id", { count: "exact", head: true }).eq("company_id", context.companyId)),
      safeCount(supabase.from("work_days").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).eq("work_date", today).eq("status", "active")),
    ]);
    const approvalRate = reviewedContent ? `${Math.round((approvedContent / reviewedContent) * 100)}%` : "0%";

    return [
      { label: "Total users", value: totalUsers, description: "All company user profiles." },
      { label: "Active users", value: activeUsers, description: "Users currently allowed into the workspace." },
      { label: "Teams", value: teams, description: "Active operating teams." },
      { label: "Open tasks", value: openTasks, description: "Tasks not yet completed or closed." },
      { label: "Approval rate", value: approvalRate, description: "Approved, scheduled, or published content against reviewed content." },
      { label: "Reports", value: reports, description: "Submitted company report records." },
      { label: "Working now", value: activeWorkDays, description: "Active Cairo work-day records today." },
    ];
  }

  if (context.role === "supervisor" || context.role === "team-lead") {
    const [openTasks, pendingReviews, approvedContent, reports, activeWorkDays] = await Promise.all([
      safeCount(supabase.from("tasks").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).in("status", ["assigned", "in_progress", "under_review"])),
      safeCount(supabase.from("content_items").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).in("status", context.role === "team-lead" ? ["submitted_to_team_lead", "changes_requested_by_supervisor"] : ["sent_to_supervisor"])),
      safeCount(supabase.from("content_items").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).in("status", ["approved", "scheduled", "published"])),
      safeCount(supabase.from("reports").select("id", { count: "exact", head: true }).eq("company_id", context.companyId)),
      safeCount(supabase.from("work_days").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).eq("work_date", today).eq("status", "active")),
    ]);

    return [
      { label: "Scoped tasks", value: openTasks, description: "Visible tasks currently in motion." },
      { label: "Pending reviews", value: pendingReviews, description: "Content waiting on your review lane." },
      { label: "Approved content", value: approvedContent, description: "Approved, scheduled, or published visible content." },
      { label: "Reports", value: reports, description: "Visible submitted report records." },
      { label: "Working now", value: activeWorkDays, description: "Visible active Cairo work-day records today." },
    ];
  }

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
