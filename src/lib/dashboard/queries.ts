import type { AuthContext } from "@/lib/auth/permissions";
import { getClients } from "@/lib/clients/queries";
import { getRecentNotifications, type NotificationRow } from "@/lib/notifications/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCairoDate } from "@/lib/time";
import {
  getWorkflowContent,
  getWorkflowIdeas,
  getWorkflowReports,
  getWorkflowTasks,
} from "@/lib/workflows/queries";
import { getVisibleTeamIds } from "@/lib/workflows/scope";
import { routes } from "@/constants/routes";

export type DashboardSummaryMetric = {
  label: string;
  value: number | string;
  description: string;
};

export type DashboardChartDatum = {
  label: string;
  value: number;
  description?: string;
};

export type DashboardChartSection = {
  title: string;
  description: string;
  data: DashboardChartDatum[];
};

export type DashboardClientCard = {
  id: string;
  name: string;
  logoUrl: string | null;
  status: string;
  accountManagerName: string | null;
  briefDriveLink: string | null;
  contactEmail: string | null;
  openIdeas: number;
  openTasks: number;
  upcomingPublishingAt: string | null;
  href: string;
};

export type DashboardWorkItem = {
  id: string;
  title: string;
  href: string;
  status: string;
  label: string;
  clientName: string | null;
  date: string | null;
  actionLabel?: string;
};

export type DashboardSections = {
  clients: DashboardClientCard[];
  workItems: DashboardWorkItem[];
  reviewItems: DashboardWorkItem[];
  reports: DashboardWorkItem[];
  notifications: NotificationRow[];
};

const taskStatusLabels: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In progress",
  under_review: "Under review",
  completed: "Completed",
  closed: "Closed",
};

const contentStatusLabels: Record<string, string> = {
  draft: "Draft",
  submitted_to_team_lead: "Team Lead review",
  changes_requested_by_team_lead: "TL changes",
  sent_to_supervisor: "Account Manager review",
  changes_requested_by_supervisor: "Account Manager changes",
  approved: "Approved",
  rejected: "Rejected",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

function countBy<T>(rows: T[], getKey: (row: T) => string | null | undefined) {
  return rows.reduce((counts, row) => {
    const key = getKey(row);

    if (!key) {
      return counts;
    }

    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
}

function countsToData(counts: Map<string, number>, labels: Record<string, string>, order?: string[]) {
  const keys = order ?? Array.from(counts.keys());
  return keys
    .map((key) => ({ label: labels[key] ?? key, value: counts.get(key) ?? 0 }))
    .filter((item) => item.value > 0);
}

function emptyData(label: string): DashboardChartDatum[] {
  return [{ label, value: 0, description: "No records yet" }];
}

function activeTask(status: string) {
  return !["completed", "closed"].includes(status);
}

function activeIdea(status: string) {
  return !["approved", "rejected", "archived"].includes(status);
}

function taskDate(value: string | null) {
  return value ? value : null;
}

function itemLimit<T>(items: T[], limit = 5) {
  return items.slice(0, limit);
}

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
      clients,
      openTasks,
      approvedContent,
      reviewedContent,
      reports,
      activeWorkDays,
    ] = await Promise.all([
      safeCount(supabase.from("users").select("id", { count: "exact", head: true }).eq("company_id", context.companyId)),
      safeCount(supabase.from("users").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).eq("status", "active")),
      safeCount(supabase.from("teams").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).eq("status", "active")),
      safeCount(supabase.from("clients").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).neq("status", "archived")),
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
      { label: "Clients", value: clients, description: "Active client workspaces." },
      { label: "Open tasks", value: openTasks, description: "Tasks not yet completed or closed." },
      { label: "Approval rate", value: approvalRate, description: "Approved, scheduled, or published content against reviewed content." },
      { label: "Reports", value: reports, description: "Submitted company report records." },
      { label: "Working now", value: activeWorkDays, description: "Active Cairo work-day records today." },
    ];
  }

  if (context.role === "supervisor" || context.role === "team-lead") {
    const [openTasks, pendingReviews, approvedContent, reports, clients, activeWorkDays] = await Promise.all([
      safeCount(supabase.from("tasks").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).in("status", ["assigned", "in_progress", "under_review"])),
      safeCount(supabase.from("content_items").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).in("status", context.role === "team-lead" ? ["submitted_to_team_lead", "changes_requested_by_supervisor"] : ["sent_to_supervisor"])),
      safeCount(supabase.from("content_items").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).in("status", ["approved", "scheduled", "published"])),
      safeCount(supabase.from("reports").select("id", { count: "exact", head: true }).eq("company_id", context.companyId)),
      safeCount(supabase.from("clients").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).neq("status", "archived")),
      safeCount(supabase.from("work_days").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).eq("work_date", today).eq("status", "active")),
    ]);

    return [
      { label: "Scoped tasks", value: openTasks, description: "Visible tasks currently in motion." },
      { label: "Pending reviews", value: pendingReviews, description: "Content waiting on your review lane." },
      { label: "Approved content", value: approvedContent, description: "Approved, scheduled, or published visible content." },
      { label: "Reports", value: reports, description: "Visible submitted report records." },
      { label: "Clients", value: clients, description: "Visible client workspaces." },
      { label: "Working now", value: activeWorkDays, description: "Visible active Cairo work-day records today." },
    ];
  }

  if (context.role === "client") {
    const [clients, visibleContent, visibleReports] = await Promise.all([
      safeCount(supabase.from("clients").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).neq("status", "archived")),
      safeCount(supabase.from("content_items").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).neq("status", "archived")),
      safeCount(supabase.from("reports").select("id", { count: "exact", head: true }).eq("company_id", context.companyId)),
    ]);

    return [
      { label: "Accessible clients", value: clients, description: "Client workspaces available to you." },
      { label: "Visible content", value: visibleContent, description: "Client-facing content items." },
      { label: "Reports", value: visibleReports, description: "Shared report records." },
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

export async function getDashboardCharts(context: AuthContext): Promise<DashboardChartSection[]> {
  const supabase = await createSupabaseServerClient();
  const today = getCairoDate();
  const nextWeek = new Date(`${today}T00:00:00`);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekDate = nextWeek.toISOString().slice(0, 10);
  const visibleTeamIds = await getVisibleTeamIds(context);

  const [
    { data: tasksData },
    { data: contentData },
    { data: teamsData },
    { data: reportsData },
    { data: workDaysData },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, status, team_id, due_date, assigned_to")
      .eq("company_id", context.companyId),
    supabase
      .from("content_items")
      .select("id, status, team_id, creator_id")
      .eq("company_id", context.companyId),
    supabase
      .from("teams")
      .select("id, name")
      .eq("company_id", context.companyId)
      .eq("status", "active")
      .order("name", { ascending: true }),
    supabase
      .from("reports")
      .select("id, report_type")
      .eq("company_id", context.companyId),
    supabase
      .from("work_days")
      .select("id, user_id, status, total_worked_minutes, total_break_minutes, total_missing_minutes")
      .eq("company_id", context.companyId)
      .eq("work_date", today),
  ]);

  const tasks = ((tasksData as Array<{
    id: string;
    status: string;
    team_id: string | null;
    due_date: string | null;
    assigned_to: string | null;
  }> | null) ?? []).filter((task) => {
    if (context.role === "creator") {
      return task.assigned_to === context.userId;
    }

    if (!visibleTeamIds) {
      return true;
    }

    return Boolean(task.team_id && visibleTeamIds.includes(task.team_id));
  });

  const content = ((contentData as Array<{
    id: string;
    status: string;
    team_id: string | null;
    creator_id: string | null;
  }> | null) ?? []).filter((item) => {
    if (context.role === "creator") {
      return item.creator_id === context.userId;
    }

    if (!visibleTeamIds) {
      return true;
    }

    return Boolean(item.team_id && visibleTeamIds.includes(item.team_id));
  });

  const teams = ((teamsData as Array<{ id: string; name: string }> | null) ?? []).filter((team) => {
    if (!visibleTeamIds) {
      return true;
    }

    return visibleTeamIds.includes(team.id);
  });
  const reports = ((reportsData as Array<{ id: string; report_type: string }> | null) ?? []);

  const workDays = ((workDaysData as Array<{
    id: string;
    user_id: string;
    status: string;
    total_worked_minutes: number;
    total_break_minutes: number;
    total_missing_minutes: number;
  }> | null) ?? []).filter((day) => (context.role === "creator" ? day.user_id === context.userId : true));

  const tasksByStatus = countsToData(
    countBy(tasks, (task) => task.status),
    taskStatusLabels,
    ["pending", "assigned", "in_progress", "under_review", "completed", "closed"]
  );
  const contentByStatus = countsToData(
    countBy(content, (item) => item.status),
    contentStatusLabels,
    [
      "draft",
      "submitted_to_team_lead",
      "sent_to_supervisor",
      "changes_requested_by_team_lead",
      "changes_requested_by_supervisor",
      "approved",
      "rejected",
      "scheduled",
      "published",
    ]
  );
  const workHoursOverview = [
    {
      label: "Worked",
      value: workDays.reduce((total, day) => total + day.total_worked_minutes, 0),
      description: "Minutes today",
    },
    {
      label: "Break",
      value: workDays.reduce((total, day) => total + day.total_break_minutes, 0),
      description: "Minutes today",
    },
    {
      label: "Missing",
      value: workDays.reduce((total, day) => total + day.total_missing_minutes, 0),
      description: "Minutes today",
    },
  ];
  const dueSoon = tasks.filter((task) => {
    if (!task.due_date) {
      return false;
    }

    return task.due_date >= today && task.due_date <= nextWeekDate && task.status !== "closed";
  });
  const dueSoonData = [
    { label: "Today", value: dueSoon.filter((task) => task.due_date === today).length },
    { label: "This week", value: dueSoon.filter((task) => task.due_date !== today).length },
  ];
  const teamTaskData = teams
    .map((team) => ({
      label: team.name,
      value: tasks.filter((task) => task.team_id === team.id && !["completed", "closed"].includes(task.status)).length,
      description: "Open tasks",
    }))
    .filter((item) => item.value > 0)
    .slice(0, 8);
  const teamCompletionData = teams
    .map((team) => ({
      label: team.name,
      value: tasks.filter((task) => task.team_id === team.id && ["completed", "closed"].includes(task.status)).length,
      description: "Completed tasks",
    }))
    .filter((item) => item.value > 0)
    .slice(0, 8);

  if (context.role === "admin") {
    return [
      {
        title: "Tasks by status",
        description: "Company task distribution across the active workflow.",
        data: tasksByStatus.length ? tasksByStatus : emptyData("No tasks"),
      },
      {
        title: "Content review pipeline",
        description: "Content items grouped by review and publishing state.",
        data: contentByStatus.length ? contentByStatus : emptyData("No content"),
      },
      {
        title: "Team productivity",
        description: "Completed and closed task volume by active team.",
        data: teamCompletionData.length ? teamCompletionData : emptyData("No completed team tasks"),
      },
      {
        title: "Work-hours overview",
        description: "Worked, break, and missing minutes recorded today.",
        data: workHoursOverview,
      },
    ];
  }

  if (context.role === "supervisor") {
    return [
      {
        title: "Team workload",
        description: "Open visible tasks by team.",
        data: teamTaskData.length ? teamTaskData : emptyData("No open team tasks"),
      },
      {
        title: "Pending reviews",
        description: "Visible content waiting in review states.",
        data: contentByStatus.filter((item) => item.label.includes("review") || item.label.includes("changes")).length
          ? contentByStatus.filter((item) => item.label.includes("review") || item.label.includes("changes"))
          : emptyData("No pending reviews"),
      },
      {
        title: "Team completion trends",
        description: "Completed visible tasks by team.",
        data: teamCompletionData.length ? teamCompletionData : emptyData("No team completions"),
      },
    ];
  }

  if (context.role === "team-lead") {
    return [
      {
        title: "Team progress",
        description: "Visible team tasks by status.",
        data: tasksByStatus.length ? tasksByStatus : emptyData("No team tasks"),
      },
      {
        title: "Tasks due soon",
        description: "Visible tasks due in the next seven Cairo calendar days.",
        data: dueSoonData.some((item) => item.value > 0) ? dueSoonData : emptyData("No due tasks"),
      },
      {
        title: "Content awaiting review",
        description: "Visible content in Team Lead review states.",
        data: contentByStatus.filter((item) => item.label.includes("Team Lead") || item.label.includes("TL")).length
          ? contentByStatus.filter((item) => item.label.includes("Team Lead") || item.label.includes("TL"))
          : emptyData("No content waiting"),
      },
    ];
  }

  if (context.role === "client") {
    const clientDeliveryData = countsToData(
      countBy(
        content.filter((item) => ["submitted_to_team_lead", "sent_to_supervisor", "approved", "scheduled", "published"].includes(item.status)),
        (item) => item.status
      ),
      contentStatusLabels,
      ["submitted_to_team_lead", "sent_to_supervisor", "approved", "scheduled", "published"]
    );
    const reportHistoryData = countsToData(
      countBy(reports, (report) => report.report_type),
      {
        daily: "Daily",
        weekly: "Weekly",
        creator: "Creator",
        team: "Team",
        company: "Company",
      },
      ["daily", "weekly", "creator", "team", "company"]
    );

    return [
      {
        title: "Client content",
        description: "Visible content items by status.",
        data: contentByStatus.length ? contentByStatus : emptyData("No content"),
      },
      {
        title: "Report history",
        description: "Reports shared with this client workspace.",
        data: reportHistoryData.length ? reportHistoryData : emptyData("No reports"),
      },
      {
        title: "Delivery status",
        description: "Published and in-review client deliverables.",
        data: clientDeliveryData.length ? clientDeliveryData : emptyData("No delivery items"),
      },
    ];
  }

  return [
    {
      title: "My tasks",
      description: "Your assigned tasks by status.",
      data: tasksByStatus.length ? tasksByStatus : emptyData("No tasks"),
    },
    {
      title: "My content status",
      description: "Your content items by lifecycle state.",
      data: contentByStatus.length ? contentByStatus : emptyData("No content"),
    },
    {
      title: "My work-hours",
      description: "Worked, break, and missing minutes recorded today.",
      data: workHoursOverview,
    },
  ];
}

export async function getDashboardSections(context: AuthContext): Promise<DashboardSections> {
  const [clients, tasks, ideas, content, reports, notifications] = await Promise.all([
    getClients(context),
    getWorkflowTasks(context, { status: "all" }),
    getWorkflowIdeas(context, { status: "all" }),
    getWorkflowContent(context, { status: "all" }),
    getWorkflowReports(context),
    getRecentNotifications(context, 5),
  ]);

  const clientCards = clients.map((client) => {
    const clientTasks = tasks.filter((task) => task.client_id === client.id);
    const clientIdeas = ideas.filter((idea) => idea.client_id === client.id);
    const clientContent = content.filter((item) => item.client_id === client.id);
    const upcomingPublishingAt = clientContent
      .map((item) => item.scheduled_at)
      .filter((value): value is string => Boolean(value))
      .sort()[0] ?? null;

    return {
      id: client.id,
      name: client.name,
      logoUrl: client.logo_url,
      status: client.status,
      accountManagerName: client.accountManagerName,
      briefDriveLink: client.brief_drive_link,
      contactEmail: client.contact_email,
      openIdeas: clientIdeas.filter((idea) => activeIdea(idea.status)).length,
      openTasks: clientTasks.filter((task) => activeTask(task.status)).length,
      upcomingPublishingAt,
      href: routes.clients.detail(client.id),
    };
  });

  const assignedTasks = tasks
    .filter((task) => context.role === "admin" || task.assigned_to === context.userId || task.assigned_by === context.userId || task.created_by === context.userId)
    .filter((task) => activeTask(task.status))
    .map((task) => ({
      id: task.id,
      title: task.title,
      href: `${routes.tasks}/${task.id}`,
      status: task.status,
      label: task.priority,
      clientName: task.clientName,
      date: taskDate(task.due_date),
      actionLabel: task.final_drive_link ? "Final submitted" : "Open task",
    }));

  const assignedIdeas = ideas
    .filter((idea) => context.role === "admin" || idea.assigned_to === context.userId || idea.created_by === context.userId)
    .filter((idea) => activeIdea(idea.status))
    .map((idea) => ({
      id: idea.id,
      title: idea.title,
      href: `${routes.ideas}/${idea.id}`,
      status: idea.status,
      label: idea.idea_type,
      clientName: idea.clientName,
      date: idea.publishing_at,
      actionLabel: "Open idea",
    }));

  const contentReviews = content
    .filter((item) => ["submitted_to_team_lead", "sent_to_supervisor", "changes_requested_by_team_lead", "changes_requested_by_supervisor"].includes(item.status))
    .map((item) => ({
      id: item.id,
      title: item.title,
      href: `${routes.content.home}/${item.id}`,
      status: item.status,
      label: item.averageRating ? `${item.averageRating}/5` : "Review",
      clientName: item.clientName,
      date: item.submitted_at ?? item.updated_at,
      actionLabel: item.final_drive_link ? "Review final" : "Review content",
    }));

  const reportItems = reports
    .filter((report) => context.role !== "client" || report.sent_to_client_at)
    .map((report) => ({
      id: report.id,
      title: report.title,
      href: `${routes.reports}/${report.id}`,
      status: report.sent_to_client_at ? "sent" : "draft",
      label: report.report_type,
      clientName: report.clientName,
      date: report.created_at,
      actionLabel: report.sent_to_client_at ? "Shared" : "Review report",
    }));

  if (context.role === "client") {
    return {
      clients: clientCards,
      workItems: itemLimit([
        ...content
          .filter((item) => item.status !== "archived")
          .map((item) => ({
            id: item.id,
            title: item.title,
            href: `${routes.content.home}/${item.id}`,
            status: item.status,
            label: "Content",
            clientName: item.clientName,
            date: item.scheduled_at ?? item.updated_at,
            actionLabel: "View",
          })),
        ...assignedIdeas,
      ]),
      reviewItems: itemLimit(contentReviews),
      reports: itemLimit(reportItems),
      notifications,
    };
  }

  if (context.role === "admin" || context.role === "supervisor") {
    return {
      clients: itemLimit(clientCards, context.role === "admin" ? 8 : 6),
      workItems: itemLimit(assignedTasks, 6),
      reviewItems: itemLimit(contentReviews, 6),
      reports: itemLimit(reportItems, 5),
      notifications,
    };
  }

  return {
    clients: itemLimit(clientCards, 6),
    workItems: itemLimit([...assignedTasks, ...assignedIdeas], 6),
    reviewItems: itemLimit(contentReviews.filter((item) => context.role !== "creator" || item.status !== "sent_to_supervisor"), 5),
    reports: itemLimit(reportItems, 4),
    notifications,
  };
}
