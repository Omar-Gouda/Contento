import { createSupabaseServerClient } from "@/lib/supabase/server";
import { routes } from "@/constants/routes";
import type { AuthContext } from "@/lib/auth/permissions";
import { CONTENTO_TIME_ZONE, getCairoDate } from "@/lib/time";
import { activeReviewStatuses, canUseCompanyScope, getVisibleTeamIds, getVisibleUserIds } from "@/lib/workflows/scope";
import type { Database, Json } from "@/types/database";
import { getRoleDisplayName } from "@/types/roles";

type UserRow = Pick<
  Database["public"]["Tables"]["users"]["Row"],
  "id" | "email" | "first_name" | "last_name" | "role_id" | "status"
>;

type RoleRow = Pick<Database["public"]["Tables"]["roles"]["Row"], "id" | "name">;
type TeamMemberRow = Database["public"]["Tables"]["team_members"]["Row"];
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type TaskCommentRow = Database["public"]["Tables"]["task_comments"]["Row"];
type IdeaRow = Database["public"]["Tables"]["ideas"]["Row"];
type ContentRow = Database["public"]["Tables"]["content_items"]["Row"];
type ContentReviewRow = Database["public"]["Tables"]["content_reviews"]["Row"];
type ContentRatingRow = Database["public"]["Tables"]["content_ratings"]["Row"];
type CalendarEventRow = Database["public"]["Tables"]["calendar_events"]["Row"];
type DayOffRow = Database["public"]["Tables"]["day_off_requests"]["Row"];
type ReportRow = Database["public"]["Tables"]["reports"]["Row"];
type ClientRow = Pick<Database["public"]["Tables"]["clients"]["Row"], "id" | "name">;

export type WorkflowUser = UserRow & {
  displayName: string;
  roleName: string;
};

export type WorkflowTeam = Database["public"]["Tables"]["teams"]["Row"] & {
  leadName: string | null;
  members: WorkflowUser[];
  memberCount: number;
  openTaskCount: number;
  activeContentCount: number;
};

export type WorkflowTask = TaskRow & {
  clientName: string | null;
  assigneeName: string | null;
  assignedByName: string | null;
  creatorName: string | null;
  teamName: string | null;
  commentCount: number;
};

export type WorkflowTaskComment = TaskCommentRow & {
  userName: string | null;
};

export type WorkflowIdea = IdeaRow & {
  clientName: string | null;
  creatorName: string | null;
  assigneeName: string | null;
  teamName: string | null;
  commentCount: number;
};

export type WorkflowContent = ContentRow & {
  clientName: string | null;
  creatorName: string | null;
  taskTitle: string | null;
  ideaTitle: string | null;
  teamName: string | null;
  reviewCount: number;
  averageRating: number | null;
  ratingCount: number;
};

export type WorkflowContentReview = ContentReviewRow & {
  contentTitle: string | null;
  reviewerName: string | null;
};

export type WorkflowContentRating = ContentRatingRow & {
  contentTitle: string | null;
  reviewerName: string | null;
};

export type CalendarItem = {
  id: string;
  type: "task" | "content" | "day_off" | "sick_leave";
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  owner: string | null;
  clientName: string | null;
  href: string | null;
};

export type WorkflowReport = ReportRow & {
  clientName: string | null;
  userName: string | null;
  teamName: string | null;
  title: string;
  body: string;
};

function calendarEventType(type: CalendarEventRow["event_type"]): CalendarItem["type"] {
  if (type === "content") {
    return "content";
  }

  return "day_off";
}

function fullName(user: Pick<UserRow, "first_name" | "last_name" | "email"> | null | undefined) {
  if (!user) {
    return null;
  }

  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return name || user.email;
}

function reportText(content: Json, key: "title" | "body") {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return "";
  }

  const value = content[key];
  return typeof value === "string" ? value : "";
}

async function loadUsersAndRoles(context: AuthContext) {
  const supabase = await createSupabaseServerClient();
  const visibleUserIds = await getVisibleUserIds(context);
  const [{ data: users, error: usersError }, { data: roles, error: rolesError }] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, first_name, last_name, role_id, status")
      .eq("company_id", context.companyId)
      .order("first_name", { ascending: true }),
    supabase
      .from("roles")
      .select("id, name")
      .eq("company_id", context.companyId),
  ]);

  if (usersError || rolesError) {
    throw new Error("Unable to load company people.");
  }

  const roleById = new Map(((roles as RoleRow[] | null) ?? []).map((role) => [role.id, role.name]));

  return ((users as UserRow[] | null) ?? [])
    .filter((user) => !visibleUserIds || visibleUserIds.includes(user.id))
    .map((user) => ({
      ...user,
      displayName: fullName(user) ?? user.email,
      roleName: user.role_id ? getRoleDisplayName(roleById.get(user.role_id)) : "Unassigned",
    }));
}

export async function getWorkflowUsers(context: AuthContext) {
  return loadUsersAndRoles(context);
}

export async function getWorkflowTeams(context: AuthContext) {
  const supabase = await createSupabaseServerClient();
  const visibleTeamIds = await getVisibleTeamIds(context);

  if (visibleTeamIds && visibleTeamIds.length === 0) {
    return [];
  }

  const users = await loadUsersAndRoles(context);
  const userById = new Map(users.map((user) => [user.id, user]));

  let teamsQuery = supabase
    .from("teams")
    .select("id, company_id, name, description, status, team_lead_id, created_by, created_at, updated_at")
    .eq("company_id", context.companyId)
    .order("status", { ascending: true })
    .order("name", { ascending: true });
  let membershipsQuery = supabase.from("team_members").select("team_id, user_id");
  let taskCountQuery = supabase
    .from("tasks")
    .select("id, team_id, status")
    .eq("company_id", context.companyId)
    .neq("status", "closed");
  let contentCountQuery = supabase
    .from("content_items")
    .select("id, creator_id, team_id, status")
    .eq("company_id", context.companyId)
    .in("status", ["draft", ...activeReviewStatuses]);

  if (visibleTeamIds) {
    teamsQuery = teamsQuery.in("id", visibleTeamIds);
    membershipsQuery = membershipsQuery.in("team_id", visibleTeamIds);
    taskCountQuery = taskCountQuery.in("team_id", visibleTeamIds);
    contentCountQuery = contentCountQuery.in("team_id", visibleTeamIds);
  }

  const [{ data: teams, error: teamsError }, { data: memberships, error: membershipsError }, { data: tasks }, { data: content }] =
    await Promise.all([
      teamsQuery,
      membershipsQuery,
      taskCountQuery,
      contentCountQuery,
    ]);

  if (teamsError || membershipsError) {
    throw new Error("Unable to load company teams.");
  }

  const membershipRows = (memberships as TeamMemberRow[] | null) ?? [];
  const teamIdsByUser = new Map<string, string[]>();
  membershipRows.forEach((membership) => {
    const current = teamIdsByUser.get(membership.user_id) ?? [];
    current.push(membership.team_id);
    teamIdsByUser.set(membership.user_id, current);
  });

  const openTasksByTeam = new Map<string, number>();
  ((tasks as Array<Pick<TaskRow, "team_id" | "status">> | null) ?? []).forEach((task) => {
    if (!task.team_id) {
      return;
    }

    openTasksByTeam.set(task.team_id, (openTasksByTeam.get(task.team_id) ?? 0) + 1);
  });

  const activeContentByTeam = new Map<string, number>();
  ((content as Array<Pick<ContentRow, "creator_id" | "team_id" | "status">> | null) ?? []).forEach((item) => {
    if (item.team_id) {
      activeContentByTeam.set(item.team_id, (activeContentByTeam.get(item.team_id) ?? 0) + 1);
    } else if (item.creator_id) {
      (teamIdsByUser.get(item.creator_id) ?? []).forEach((teamId) => {
        activeContentByTeam.set(teamId, (activeContentByTeam.get(teamId) ?? 0) + 1);
      });
    }
  });

  return ((teams as Database["public"]["Tables"]["teams"]["Row"][] | null) ?? []).map((team) => {
    const members = membershipRows
      .filter((membership) => membership.team_id === team.id)
      .map((membership) => userById.get(membership.user_id))
      .filter((user): user is WorkflowUser => Boolean(user));

    return {
      ...team,
      leadName: team.team_lead_id ? userById.get(team.team_lead_id)?.displayName ?? null : null,
      members,
      memberCount: members.length,
      openTaskCount: openTasksByTeam.get(team.id) ?? 0,
      activeContentCount: activeContentByTeam.get(team.id) ?? 0,
    };
  });
}

export async function getWorkflowTasks(
  context: AuthContext,
  filters: { status?: string; teamId?: string; clientId?: string; search?: string } = {}
) {
  const supabase = await createSupabaseServerClient();
  const visibleTeamIds = await getVisibleTeamIds(context);
  let query = supabase
    .from("tasks")
    .select("id, company_id, client_id, title, description, assigned_to, assigned_by, created_by, status, priority, team_id, due_date, final_drive_link, final_output_submitted_at, final_output_submitted_by, created_at, updated_at")
    .eq("company_id", context.companyId)
    .order("updated_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status as Database["public"]["Enums"]["task_status"]);
  }

  if (filters.teamId && filters.teamId !== "all") {
    query = query.eq("team_id", filters.teamId);
  }

  if (filters.clientId && filters.clientId !== "all") {
    query = query.eq("client_id", filters.clientId);
  }

  if (filters.search) {
    query = query.ilike("title", `%${filters.search.trim()}%`);
  }

  const [{ data: tasks, error }, users, teams, { data: clients }, { data: comments }] = await Promise.all([
    query,
    loadUsersAndRoles(context),
    getWorkflowTeams(context),
    supabase.from("clients").select("id, name").eq("company_id", context.companyId),
    supabase.from("task_comments").select("task_id").eq("company_id", context.companyId),
  ]);

  if (error) {
    throw new Error("Unable to load tasks.");
  }

  const userById = new Map(users.map((user) => [user.id, user.displayName]));
  const teamById = new Map(teams.map((team) => [team.id, team.name]));
  const clientById = new Map(((clients as ClientRow[] | null) ?? []).map((client) => [client.id, client.name]));
  const commentCounts = new Map<string, number>();
  ((comments as Array<Pick<TaskCommentRow, "task_id">> | null) ?? []).forEach((comment) => {
    commentCounts.set(comment.task_id, (commentCounts.get(comment.task_id) ?? 0) + 1);
  });

  const scopedTasks = ((tasks as TaskRow[] | null) ?? []).filter((task) => {
    if (canUseCompanyScope(context)) {
      return true;
    }

    if (task.assigned_to === context.userId || task.created_by === context.userId) {
      return true;
    }

    if (task.client_id && clientById.has(task.client_id)) {
      return true;
    }

    return Boolean(task.team_id && visibleTeamIds?.includes(task.team_id));
  });

  return scopedTasks.map((task) => ({
    ...task,
    clientName: task.client_id ? clientById.get(task.client_id) ?? null : null,
    assigneeName: task.assigned_to ? userById.get(task.assigned_to) ?? null : null,
    assignedByName: task.assigned_by ? userById.get(task.assigned_by) ?? null : null,
    creatorName: task.created_by ? userById.get(task.created_by) ?? null : null,
    teamName: task.team_id ? teamById.get(task.team_id) ?? null : null,
    commentCount: commentCounts.get(task.id) ?? 0,
  }));
}

export async function getWorkflowTaskComments(context: AuthContext, taskIds: string[]) {
  if (!taskIds.length) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const [{ data, error }, users] = await Promise.all([
    supabase
      .from("task_comments")
      .select("id, company_id, task_id, user_id, body, created_at")
      .eq("company_id", context.companyId)
      .in("task_id", taskIds)
      .order("created_at", { ascending: false }),
    loadUsersAndRoles(context),
  ]);

  if (error) {
    throw new Error("Unable to load task comments.");
  }

  const userById = new Map(users.map((user) => [user.id, user.displayName]));
  return ((data as TaskCommentRow[] | null) ?? []).map((comment) => ({
    ...comment,
    userName: comment.user_id ? userById.get(comment.user_id) ?? null : null,
  }));
}

export async function getWorkflowIdeas(
  context: AuthContext,
  filters: { status?: string; search?: string; teamId?: string; clientId?: string } = {}
) {
  const supabase = await createSupabaseServerClient();
  const visibleTeamIds = await getVisibleTeamIds(context);
  const visibleUserIds = await getVisibleUserIds(context);
  let query = supabase
    .from("ideas")
    .select("id, company_id, client_id, title, description, created_by, assigned_to, team_id, status, notes, idea_type, platforms, headline, subtext, visual, cta, script, urgency, publishing_at, final_drive_link, created_at, updated_at")
    .eq("company_id", context.companyId)
    .order("updated_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status as Database["public"]["Enums"]["idea_status"]);
  }

  if (filters.search) {
    query = query.ilike("title", `%${filters.search.trim()}%`);
  }

  if (filters.teamId && filters.teamId !== "all") {
    query = query.eq("team_id", filters.teamId);
  }

  if (filters.clientId && filters.clientId !== "all") {
    query = query.eq("client_id", filters.clientId);
  }

  const [{ data, error }, users, teams, { data: clients }, { data: comments }] = await Promise.all([
    query,
    loadUsersAndRoles(context),
    getWorkflowTeams(context),
    supabase.from("clients").select("id, name").eq("company_id", context.companyId),
    supabase.from("comments").select("entity_id").eq("company_id", context.companyId).eq("entity_type", "idea"),
  ]);

  if (error) {
    throw new Error("Unable to load ideas.");
  }

  const userById = new Map(users.map((user) => [user.id, user.displayName]));
  const teamById = new Map(teams.map((team) => [team.id, team.name]));
  const clientById = new Map(((clients as ClientRow[] | null) ?? []).map((client) => [client.id, client.name]));
  const commentCounts = new Map<string, number>();
  ((comments as Array<{ entity_id: string }> | null) ?? []).forEach((comment) => {
    commentCounts.set(comment.entity_id, (commentCounts.get(comment.entity_id) ?? 0) + 1);
  });
  const scopedIdeas = ((data as IdeaRow[] | null) ?? []).filter((idea) => {
    if (canUseCompanyScope(context)) {
      return true;
    }

    if (idea.created_by === context.userId || idea.assigned_to === context.userId) {
      return true;
    }

    if (idea.team_id && visibleTeamIds?.includes(idea.team_id)) {
      return true;
    }

    if (idea.client_id && clientById.has(idea.client_id)) {
      return true;
    }

    return Boolean(idea.assigned_to && visibleUserIds?.includes(idea.assigned_to));
  });

  return scopedIdeas.map((idea) => ({
    ...idea,
    clientName: idea.client_id ? clientById.get(idea.client_id) ?? null : null,
    creatorName: idea.created_by ? userById.get(idea.created_by) ?? null : null,
    assigneeName: idea.assigned_to ? userById.get(idea.assigned_to) ?? null : null,
    teamName: idea.team_id ? teamById.get(idea.team_id) ?? null : null,
    commentCount: commentCounts.get(idea.id) ?? 0,
  }));
}

export async function getWorkflowContent(
  context: AuthContext,
  filters: { status?: string; search?: string; teamId?: string; clientId?: string } = {}
) {
  const supabase = await createSupabaseServerClient();
  const visibleTeamIds = await getVisibleTeamIds(context);
  const visibleUserIds = await getVisibleUserIds(context);
  let query = supabase
    .from("content_items")
    .select("id, company_id, client_id, title, description, creator_id, task_id, idea_id, team_id, status, submitted_at, approved_at, scheduled_at, published_at, final_drive_link, final_output_submitted_at, final_output_submitted_by, created_at, updated_at")
    .eq("company_id", context.companyId)
    .order("updated_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status as Database["public"]["Enums"]["content_status"]);
  }

  if (filters.search) {
    query = query.ilike("title", `%${filters.search.trim()}%`);
  }

  if (filters.teamId && filters.teamId !== "all") {
    query = query.eq("team_id", filters.teamId);
  }

  if (filters.clientId && filters.clientId !== "all") {
    query = query.eq("client_id", filters.clientId);
  }

  const [{ data, error }, users, { data: tasks }, { data: ideas }, teams, { data: clients }, { data: reviews }, { data: ratings }] = await Promise.all([
    query,
    loadUsersAndRoles(context),
    supabase.from("tasks").select("id, title").eq("company_id", context.companyId),
    supabase.from("ideas").select("id, title").eq("company_id", context.companyId),
    getWorkflowTeams(context),
    supabase.from("clients").select("id, name").eq("company_id", context.companyId),
    supabase.from("content_reviews").select("content_id").eq("company_id", context.companyId),
    supabase.from("content_ratings").select("content_id, rating_value").eq("company_id", context.companyId),
  ]);

  if (error) {
    throw new Error("Unable to load content items.");
  }

  const userById = new Map(users.map((user) => [user.id, user.displayName]));
  const taskById = new Map(((tasks as Array<Pick<TaskRow, "id" | "title">> | null) ?? []).map((task) => [task.id, task.title]));
  const ideaById = new Map(((ideas as Array<Pick<IdeaRow, "id" | "title">> | null) ?? []).map((idea) => [idea.id, idea.title]));
  const teamById = new Map(teams.map((team) => [team.id, team.name]));
  const clientById = new Map(((clients as ClientRow[] | null) ?? []).map((client) => [client.id, client.name]));
  const reviewCounts = new Map<string, number>();
  ((reviews as Array<Pick<ContentReviewRow, "content_id">> | null) ?? []).forEach((review) => {
    reviewCounts.set(review.content_id, (reviewCounts.get(review.content_id) ?? 0) + 1);
  });
  const ratingTotals = new Map<string, { total: number; count: number }>();
  ((ratings as Array<Pick<ContentRatingRow, "content_id" | "rating_value">> | null) ?? []).forEach((rating) => {
    const current = ratingTotals.get(rating.content_id) ?? { total: 0, count: 0 };
    ratingTotals.set(rating.content_id, {
      total: current.total + rating.rating_value,
      count: current.count + 1,
    });
  });

  const scopedContent = ((data as ContentRow[] | null) ?? []).filter((item) => {
    if (canUseCompanyScope(context)) {
      return true;
    }

    if (item.creator_id === context.userId) {
      return true;
    }

    if (item.status === "draft") {
      return false;
    }

    if (item.team_id && visibleTeamIds?.includes(item.team_id)) {
      return true;
    }

    if (item.client_id && clientById.has(item.client_id)) {
      return true;
    }

    return Boolean(item.creator_id && visibleUserIds?.includes(item.creator_id));
  });

  return scopedContent.map((item) => {
    const rating = ratingTotals.get(item.id);

    return {
      ...item,
      clientName: item.client_id ? clientById.get(item.client_id) ?? null : null,
      creatorName: item.creator_id ? userById.get(item.creator_id) ?? null : null,
      taskTitle: item.task_id ? taskById.get(item.task_id) ?? null : null,
      ideaTitle: item.idea_id ? ideaById.get(item.idea_id) ?? null : null,
      teamName: item.team_id ? teamById.get(item.team_id) ?? null : null,
      reviewCount: reviewCounts.get(item.id) ?? 0,
      averageRating: rating ? Number((rating.total / rating.count).toFixed(1)) : null,
      ratingCount: rating?.count ?? 0,
    };
  });
}

export async function getWorkflowContentReviews(context: AuthContext, contentIds?: string[]) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("content_reviews")
    .select("id, company_id, content_id, reviewer_id, decision, feedback, quality_score, creativity_score, accuracy_score, overall_rating, score_comment, reviewed_at")
    .eq("company_id", context.companyId)
    .order("reviewed_at", { ascending: false });

  if (contentIds?.length) {
    query = query.in("content_id", contentIds);
  }

  const [{ data, error }, users, content] = await Promise.all([
    query,
    loadUsersAndRoles(context),
    getWorkflowContent(context),
  ]);

  if (error) {
    throw new Error("Unable to load content reviews.");
  }

  const userById = new Map(users.map((user) => [user.id, user.displayName]));
  const contentById = new Map(content.map((item) => [item.id, item.title]));
  return ((data as ContentReviewRow[] | null) ?? []).map((review) => ({
    ...review,
    contentTitle: contentById.get(review.content_id) ?? null,
    reviewerName: review.reviewer_id ? userById.get(review.reviewer_id) ?? null : null,
  }));
}

export async function getWorkflowContentRatings(context: AuthContext, contentIds?: string[]) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("content_ratings")
    .select("id, company_id, content_id, reviewer_id, rating_value, comment, created_at")
    .eq("company_id", context.companyId)
    .order("created_at", { ascending: false });

  if (contentIds?.length) {
    query = query.in("content_id", contentIds);
  }

  const [{ data, error }, users, content] = await Promise.all([
    query,
    loadUsersAndRoles(context),
    getWorkflowContent(context),
  ]);

  if (error) {
    throw new Error("Unable to load content ratings.");
  }

  const userById = new Map(users.map((user) => [user.id, user.displayName]));
  const contentById = new Map(content.map((item) => [item.id, item.title]));
  return ((data as ContentRatingRow[] | null) ?? []).map((rating) => ({
    ...rating,
    contentTitle: contentById.get(rating.content_id) ?? null,
    reviewerName: rating.reviewer_id ? userById.get(rating.reviewer_id) ?? null : null,
  }));
}

export function getCalendarRange(view: string | undefined, anchorDate: string | undefined) {
  const base = anchorDate ? new Date(`${anchorDate}T00:00:00`) : new Date(`${getCairoDate()}T00:00:00`);

  if (view === "day") {
    const start = new Date(base);
    const end = new Date(base);
    end.setHours(23, 59, 59, 999);

    return {
      view: "day" as const,
      start,
      end,
    };
  }

  if (view === "week") {
    const day = base.getDay();
    const start = new Date(base);
    start.setDate(base.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return {
      view: "week" as const,
      start,
      end,
    };
  }

  const start = new Date(base.getFullYear(), base.getMonth(), 1);
  const end = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);

  return {
    view: "month" as const,
    start,
    end,
  };
}

export async function getCalendarItems(
  context: AuthContext,
  options: { view?: string; date?: string } = {}
) {
  const supabase = await createSupabaseServerClient();
  const range = getCalendarRange(options.view, options.date);
  const startIso = range.start.toISOString();
  const endIso = range.end.toISOString();
  const startDate = range.start.toISOString().slice(0, 10);
  const endDate = range.end.toISOString().slice(0, 10);
  const [
    { data: events },
    { data: tasks },
    { data: content },
    { data: dayOff },
    users,
  ] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("id, company_id, client_id, title, description, event_type, content_id, user_id, team_id, start_date, end_date, created_by, updated_at")
      .eq("company_id", context.companyId)
      .in("event_type", ["content", "day_off"])
      .lte("start_date", endIso)
      .gte("end_date", startIso)
      .order("start_date", { ascending: true }),
    supabase
      .from("tasks")
      .select("id, title, assigned_to, status, due_date, client_id")
      .eq("company_id", context.companyId)
      .not("due_date", "is", null)
      .gte("due_date", startDate)
      .lte("due_date", endDate),
    supabase
      .from("content_items")
      .select("id, title, creator_id, status, scheduled_at, submitted_at, client_id")
      .eq("company_id", context.companyId)
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", startIso)
      .lte("scheduled_at", endIso),
    supabase
      .from("day_off_requests")
      .select("id, user_id, request_type, start_date, end_date, status")
      .eq("company_id", context.companyId)
      .lte("start_date", endDate)
      .gte("end_date", startDate),
    loadUsersAndRoles(context),
  ]);

  const userById = new Map(users.map((user) => [user.id, user.displayName]));
  const { data: clients } = await supabase.from("clients").select("id, name").eq("company_id", context.companyId);
  const clientById = new Map(((clients as ClientRow[] | null) ?? []).map((client) => [client.id, client.name]));
  const eventContentIds = new Set(
    ((events as CalendarEventRow[] | null) ?? [])
      .map((event) => event.content_id)
      .filter((contentId): contentId is string => Boolean(contentId))
  );
  const items: CalendarItem[] = [
    ...(((events as CalendarEventRow[] | null) ?? []).map((event) => ({
      id: event.id,
      type: calendarEventType(event.event_type),
      title: event.title,
      startsAt: event.start_date,
      endsAt: event.end_date,
      status: event.event_type,
      owner: event.user_id ? userById.get(event.user_id) ?? null : null,
      clientName: event.client_id ? clientById.get(event.client_id) ?? null : null,
      href: event.content_id ? `${routes.content.home}/${event.content_id}` : null,
    }))),
    ...(((tasks as Array<Pick<TaskRow, "id" | "title" | "assigned_to" | "status" | "due_date" | "client_id">> | null) ?? [])
      .filter((task) => task.due_date)
      .map((task) => ({
        id: task.id,
        type: "task" as const,
        title: task.title,
        startsAt: `${task.due_date}T09:00:00`,
        endsAt: `${task.due_date}T10:00:00`,
        status: task.status,
        owner: task.assigned_to ? userById.get(task.assigned_to) ?? null : null,
        clientName: task.client_id ? clientById.get(task.client_id) ?? null : null,
        href: `${routes.tasks}/${task.id}`,
      }))),
    ...(((content as Array<Pick<ContentRow, "id" | "title" | "creator_id" | "status" | "scheduled_at" | "submitted_at" | "client_id">> | null) ?? [])
      .filter((item) => {
        const eventDate = item.scheduled_at;
        return Boolean(eventDate && eventDate >= startIso && eventDate <= endIso && !eventContentIds.has(item.id));
      })
      .map((item) => ({
        id: item.id,
        type: "content" as const,
        title: item.title,
        startsAt: item.scheduled_at as string,
        endsAt: item.scheduled_at as string,
        status: item.status,
        owner: item.creator_id ? userById.get(item.creator_id) ?? null : null,
        clientName: item.client_id ? clientById.get(item.client_id) ?? null : null,
        href: `${routes.content.home}/${item.id}`,
      }))),
    ...(((dayOff as Array<Pick<DayOffRow, "id" | "user_id" | "request_type" | "start_date" | "end_date" | "status">> | null) ?? [])
      .filter((request) => request.user_id === context.userId || userById.has(request.user_id))
      .map((request) => ({
        id: request.id,
        type: request.request_type,
        title: `${userById.get(request.user_id) ?? "User"} ${request.request_type.replace("_", " ")}`,
        startsAt: `${request.start_date}T00:00:00`,
        endsAt: `${request.end_date}T23:59:00`,
        status: request.status,
        owner: userById.get(request.user_id) ?? null,
        clientName: null,
        href: `${routes.calendar}?view=day&date=${request.start_date}#time-off-${request.id}`,
      }))),
  ];

  return {
    range,
    timeZone: CONTENTO_TIME_ZONE,
    items: items.sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  };
}

export async function getWorkflowReports(
  context: AuthContext,
  filters: { type?: string; teamId?: string; clientId?: string } = {}
) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("reports")
    .select("id, company_id, client_id, user_id, team_id, report_type, title, content, metrics_json, sent_to_client_at, sent_to_client_by, date_range_start, date_range_end, created_at, updated_at")
    .eq("company_id", context.companyId)
    .order("created_at", { ascending: false });

  if (filters.type && filters.type !== "all") {
    query = query.eq("report_type", filters.type as Database["public"]["Enums"]["report_type"]);
  }

  if (filters.teamId && filters.teamId !== "all") {
    query = query.eq("team_id", filters.teamId);
  }

  if (filters.clientId && filters.clientId !== "all") {
    query = query.eq("client_id", filters.clientId);
  }

  const [{ data, error }, users, teams, { data: clients }] = await Promise.all([
    query,
    loadUsersAndRoles(context),
    getWorkflowTeams(context),
    supabase.from("clients").select("id, name").eq("company_id", context.companyId),
  ]);

  if (error) {
    throw new Error("Unable to load reports.");
  }

  const userById = new Map(users.map((user) => [user.id, user.displayName]));
  const teamById = new Map(teams.map((team) => [team.id, team.name]));
  const clientById = new Map(((clients as ClientRow[] | null) ?? []).map((client) => [client.id, client.name]));
  return ((data as ReportRow[] | null) ?? []).map((report) => ({
    ...report,
    clientName: report.client_id ? clientById.get(report.client_id) ?? null : null,
    userName: report.user_id ? userById.get(report.user_id) ?? null : null,
    teamName: report.team_id ? teamById.get(report.team_id) ?? null : null,
    title: report.title || reportText(report.content, "title"),
    body: reportText(report.content, "body"),
  }));
}

export async function getWorkflowTaskById(context: AuthContext, taskId: string) {
  const tasks = await getWorkflowTasks(context);
  return tasks.find((task) => task.id === taskId) ?? null;
}

export async function getWorkflowIdeaById(context: AuthContext, ideaId: string) {
  const ideas = await getWorkflowIdeas(context);
  return ideas.find((idea) => idea.id === ideaId) ?? null;
}

export async function getWorkflowContentById(context: AuthContext, contentId: string) {
  const content = await getWorkflowContent(context);
  return content.find((item) => item.id === contentId) ?? null;
}

export async function getWorkflowReportById(context: AuthContext, reportId: string) {
  const reports = await getWorkflowReports(context);
  return reports.find((report) => report.id === reportId) ?? null;
}
