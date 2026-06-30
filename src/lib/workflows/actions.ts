"use server";

import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/auth/permissions";
import { createNotificationForUser } from "@/lib/notifications/service";
import { requireAuthContext, requirePermission } from "@/lib/auth/context";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  contentReviewSchema,
  contentFinalOutputSchema,
  contentRatingSchema,
  contentScheduleSchema,
  contentSchema,
  contentSubmitSchema,
  generatedReportSchema,
  ideaDeleteSchema,
  ideaSchema,
  ideaStatusSchema,
  reportSchema,
  reportSendToClientSchema,
  taskAssignmentSchema,
  taskCommentSchema,
  taskFinalOutputSchema,
  taskSchema,
  taskStatusSchema,
  teamArchiveSchema,
  teamMembersSchema,
  teamSchema,
  timeOffRequestSchema,
  timeOffReviewSchema,
} from "@/lib/workflows/schemas";
import { assertAssignmentScope, assertTeamScope, assertUserScope, creatorSubmissionStatuses } from "@/lib/workflows/scope";
import { getCairoDate, minutesLabel } from "@/lib/time";
import type { AuthContext } from "@/lib/auth/permissions";
import type { Database, Json } from "@/types/database";

type ContentActionRow = Pick<
  Database["public"]["Tables"]["content_items"]["Row"],
  "id" | "company_id" | "client_id" | "title" | "creator_id" | "team_id" | "status"
>;

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formStringArray(formData: FormData, key: string) {
  return formData.getAll(key).filter((value): value is string => typeof value === "string");
}

function safeRedirect(pathname: string | null | undefined, key: "notice" | "error", value: string): never {
  const fallback = "/tasks";
  const destination = pathname?.startsWith("/") && !pathname.startsWith("//") ? pathname : fallback;
  const separator = destination.includes("?") ? "&" : "?";

  redirect(`${destination}${separator}${key}=${encodeURIComponent(value)}`);
}

function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function reportRange(reportType: "daily" | "weekly") {
  const endDate = getCairoDate();
  const startDate = reportType === "weekly" ? addDaysToDateKey(endDate, -6) : endDate;

  return {
    startDate,
    endDate,
    startIso: `${startDate}T00:00:00.000Z`,
    endIso: `${endDate}T23:59:59.999Z`,
  };
}

async function assertUserInCompany(userId: string | null, companyId: string) {
  if (!userId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("User does not belong to this company.");
  }
}

async function assertTeamInCompany(teamId: string | null, companyId: string) {
  if (!teamId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Team does not belong to this company.");
  }
}

async function assertTaskInCompany(taskId: string | null, companyId: string) {
  if (!taskId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", taskId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Task does not belong to this company.");
  }
}

async function assertIdeaInCompany(ideaId: string | null, companyId: string) {
  if (!ideaId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ideas")
    .select("id")
    .eq("id", ideaId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Idea does not belong to this company.");
  }
}

async function assertClientInCompany(clientId: string | null, companyId: string) {
  if (!clientId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Client does not belong to this company.");
  }
}

async function loadContentForAction(contentId: string, companyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("content_items")
    .select("id, company_id, client_id, title, creator_id, team_id, status")
    .eq("id", contentId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Content item does not belong to this company.");
  }

  return data as ContentActionRow;
}

function assertCanReviewContent(context: AuthContext, content: ContentActionRow, decision: string) {
  if (context.role === "admin") {
    if (content.status === "draft") {
      throw new Error("Draft content cannot be reviewed.");
    }

    return;
  }

  if (context.role === "team-lead") {
    if (!["submitted_to_team_lead", "changes_requested_by_supervisor"].includes(content.status)) {
      throw new Error("This content is not waiting for team lead review.");
    }

    if (!["send_to_supervisor", "changes_requested"].includes(decision)) {
      throw new Error("Team Leads can request changes or send content to Account Manager review.");
    }

    return;
  }

  if (context.role === "supervisor") {
    if (content.status !== "sent_to_supervisor") {
      throw new Error("This content is not waiting for Account Manager review.");
    }

    if (!["approved", "rejected", "changes_requested"].includes(decision)) {
      throw new Error("Account Managers can approve, reject, or request changes.");
    }

    return;
  }

  throw new Error("You cannot review this content.");
}

function nextReviewState(
  context: AuthContext,
  currentStatus: Database["public"]["Enums"]["content_status"],
  decision: string
): Database["public"]["Enums"]["content_status"] {
  if (decision === "approved") {
    return "approved";
  }

  if (decision === "rejected") {
    return "rejected";
  }

  if (decision === "send_to_supervisor") {
    return "sent_to_supervisor";
  }

  if (context.role === "supervisor" || currentStatus === "sent_to_supervisor") {
    return "changes_requested_by_supervisor";
  }

  return "changes_requested_by_team_lead";
}

function reviewDecisionValue(decision: string): Database["public"]["Enums"]["review_decision"] {
  return decision === "send_to_supervisor" ? "commented" : (decision as Database["public"]["Enums"]["review_decision"]);
}

async function logActivity(
  context: AuthContext,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Json = {}
) {
  const supabase = await createSupabaseServerClient();
  await supabase.from("activity_logs").insert({
    company_id: context.companyId,
    user_id: context.userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
}

async function notifyUser(
  context: AuthContext,
  userId: string | null | undefined,
  title: string,
  message: string,
  entityType: string,
  entityId: string,
  linkHref: string
) {
  await createNotificationForUser({
    context,
    userId,
    title,
    message,
    entityType,
    entityId,
    linkHref,
  });
}

export async function createTeamAction(formData: FormData) {
  const context = await requirePermission("teams.create", "limited");
  const parsed = teamSchema.safeParse({
    name: formString(formData, "name"),
    description: formString(formData, "description"),
    teamLeadId: formString(formData, "teamLeadId"),
  });

  if (!parsed.success) {
    safeRedirect("/admin/teams", "error", parsed.error.issues[0]?.message ?? "Invalid team.");
  }

  try {
    await assertUserInCompany(parsed.data.teamLeadId, context.companyId);
  } catch {
    safeRedirect("/admin/teams", "error", "Choose a valid company team lead.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teams")
    .insert({
      company_id: context.companyId,
      name: parsed.data.name,
      description: parsed.data.description,
      team_lead_id: parsed.data.teamLeadId,
      created_by: context.userId,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !data) {
    safeRedirect("/admin/teams", "error", "Team could not be created.");
  }

  await logActivity(context, "teams.created", "team", data.id, { name: parsed.data.name });
  safeRedirect("/admin/teams", "notice", "Team created.");
}

export async function updateTeamAction(formData: FormData) {
  const context = await requirePermission("teams.create", "limited");
  const parsed = teamSchema.safeParse({
    teamId: formString(formData, "teamId"),
    name: formString(formData, "name"),
    description: formString(formData, "description"),
    teamLeadId: formString(formData, "teamLeadId"),
  });

  if (!parsed.success || !parsed.data.teamId) {
    safeRedirect("/admin/teams", "error", parsed.error?.issues[0]?.message ?? "Invalid team update.");
  }

  try {
    await assertTeamInCompany(parsed.data.teamId, context.companyId);
    await assertUserInCompany(parsed.data.teamLeadId, context.companyId);
  } catch {
    safeRedirect("/admin/teams", "error", "Choose a valid company team and lead.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("teams")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      team_lead_id: parsed.data.teamLeadId,
    })
    .eq("id", parsed.data.teamId)
    .eq("company_id", context.companyId);

  if (error) {
    safeRedirect("/admin/teams", "error", "Team could not be updated.");
  }

  await logActivity(context, "teams.updated", "team", parsed.data.teamId, { name: parsed.data.name });
  safeRedirect("/admin/teams", "notice", "Team updated.");
}

export async function archiveTeamAction(formData: FormData) {
  const context = await requirePermission("teams.create", "limited");
  const parsed = teamArchiveSchema.safeParse({ teamId: formString(formData, "teamId") });

  if (!parsed.success) {
    safeRedirect("/admin/teams", "error", "Invalid team.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("teams")
    .update({ status: "archived" })
    .eq("id", parsed.data.teamId)
    .eq("company_id", context.companyId);

  if (error) {
    safeRedirect("/admin/teams", "error", "Team could not be archived.");
  }

  await logActivity(context, "teams.archived", "team", parsed.data.teamId);
  safeRedirect("/admin/teams", "notice", "Team archived.");
}

export async function updateTeamMembersAction(formData: FormData) {
  const context = await requirePermission("teams.assign_members", "limited");
  const parsed = teamMembersSchema.safeParse({
    teamId: formString(formData, "teamId"),
    memberIds: formStringArray(formData, "memberIds"),
    redirectTo: formString(formData, "redirectTo") || "/admin/teams",
  });

  if (!parsed.success) {
    safeRedirect(formString(formData, "redirectTo") || "/admin/teams", "error", "Invalid team members.");
  }

  try {
    await assertTeamInCompany(parsed.data.teamId, context.companyId);
    await assertTeamScope(context, parsed.data.teamId);
    await Promise.all(parsed.data.memberIds.map((userId) => assertUserInCompany(userId, context.companyId)));
    await Promise.all(parsed.data.memberIds.map((userId) => assertUserScope(context, userId)));
  } catch {
    safeRedirect(parsed.data.redirectTo, "error", "All team members must belong to your company and role scope.");
  }

  const supabase = await createSupabaseServerClient();
  const { error: deleteError } = await supabase
    .from("team_members")
    .delete()
    .eq("team_id", parsed.data.teamId);

  if (deleteError) {
    safeRedirect(parsed.data.redirectTo, "error", "Existing team members could not be cleared.");
  }

  if (parsed.data.memberIds.length) {
    const { error: insertError } = await supabase
      .from("team_members")
      .insert(parsed.data.memberIds.map((userId) => ({ team_id: parsed.data.teamId, user_id: userId })));

    if (insertError) {
      safeRedirect(parsed.data.redirectTo, "error", "Team members could not be assigned.");
    }
  }

  await logActivity(context, "teams.members_updated", "team", parsed.data.teamId, {
    member_count: parsed.data.memberIds.length,
  });
  await Promise.all(parsed.data.memberIds.map((userId) => notifyUser(
    context,
    userId,
    "Team membership updated",
    "You were added to a Contento team.",
    "team",
    parsed.data.teamId,
    "/team"
  )));
  safeRedirect(parsed.data.redirectTo, "notice", "Team members updated.");
}

export async function createTaskAction(formData: FormData) {
  const context = await requirePermission("tasks.create", "limited");
  const parsed = taskSchema.safeParse({
    clientId: formString(formData, "clientId"),
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    assignedTo: formString(formData, "assignedTo"),
    teamId: formString(formData, "teamId"),
    dueDate: formString(formData, "dueDate"),
    priority: formString(formData, "priority") || "normal",
    finalDriveLink: formString(formData, "finalDriveLink"),
    redirectTo: formString(formData, "redirectTo") || "/tasks",
  });

  if (!parsed.success) {
    safeRedirect(formString(formData, "redirectTo"), "error", parsed.error.issues[0]?.message ?? "Invalid task.");
  }

  try {
    await assertUserInCompany(parsed.data.assignedTo, context.companyId);
    await assertTeamInCompany(parsed.data.teamId, context.companyId);
    await assertClientInCompany(parsed.data.clientId, context.companyId);
    await assertAssignmentScope(context, parsed.data.teamId, parsed.data.assignedTo);
  } catch {
    safeRedirect(parsed.data.redirectTo, "error", "Choose valid assignee, team, and client values inside your role scope.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      company_id: context.companyId,
      client_id: parsed.data.clientId,
      title: parsed.data.title,
      description: parsed.data.description,
      assigned_to: parsed.data.assignedTo,
      assigned_by: parsed.data.assignedTo ? context.userId : null,
      team_id: parsed.data.teamId,
      due_date: parsed.data.dueDate,
      priority: parsed.data.priority,
      final_drive_link: parsed.data.finalDriveLink || null,
      final_output_submitted_at: parsed.data.finalDriveLink ? new Date().toISOString() : null,
      final_output_submitted_by: parsed.data.finalDriveLink ? context.userId : null,
      status: parsed.data.assignedTo ? "assigned" : "pending",
      created_by: context.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    safeRedirect(parsed.data.redirectTo, "error", "Task could not be created.");
  }

  await logActivity(context, "tasks.created", "task", data.id, { title: parsed.data.title });
  await notifyUser(
    context,
    parsed.data.assignedTo,
    "Task assigned",
    parsed.data.title,
    "task",
    data.id,
    `/tasks/${data.id}`
  );
  safeRedirect(parsed.data.redirectTo, "notice", "Task created.");
}

export async function assignTaskAction(formData: FormData) {
  const context = await requirePermission("tasks.assign", "limited");
  const parsed = taskAssignmentSchema.safeParse({
    taskId: formString(formData, "taskId"),
    clientId: formString(formData, "clientId"),
    assignedTo: formString(formData, "assignedTo"),
    teamId: formString(formData, "teamId"),
    redirectTo: formString(formData, "redirectTo") || "/tasks",
  });

  if (!parsed.success) {
    safeRedirect(formString(formData, "redirectTo"), "error", "Invalid task assignment.");
  }

  try {
    await assertTaskInCompany(parsed.data.taskId, context.companyId);
    await assertClientInCompany(parsed.data.clientId, context.companyId);
    await assertUserInCompany(parsed.data.assignedTo, context.companyId);
    await assertTeamInCompany(parsed.data.teamId, context.companyId);
    await assertAssignmentScope(context, parsed.data.teamId, parsed.data.assignedTo);
  } catch {
    safeRedirect(parsed.data.redirectTo, "error", "Choose a valid task, assignee, and team inside your role scope.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      client_id: parsed.data.clientId,
      assigned_to: parsed.data.assignedTo,
      assigned_by: parsed.data.assignedTo ? context.userId : null,
      team_id: parsed.data.teamId,
      status: parsed.data.assignedTo ? "assigned" : "pending",
    })
    .eq("id", parsed.data.taskId)
    .eq("company_id", context.companyId);

  if (error) {
    safeRedirect(parsed.data.redirectTo, "error", "Task assignment could not be saved.");
  }

  await logActivity(context, "tasks.assigned", "task", parsed.data.taskId, {
    assigned_to: parsed.data.assignedTo,
    team_id: parsed.data.teamId,
    client_id: parsed.data.clientId,
  });
  await notifyUser(
    context,
    parsed.data.assignedTo,
    "Task assigned",
    "A task was assigned or reassigned to you.",
    "task",
    parsed.data.taskId,
    `/tasks/${parsed.data.taskId}`
  );
  safeRedirect(parsed.data.redirectTo, "notice", "Task assignment updated.");
}

export async function updateTaskStatusAction(formData: FormData) {
  const parsed = taskStatusSchema.safeParse({
    taskId: formString(formData, "taskId"),
    status: formString(formData, "status"),
    redirectTo: formString(formData, "redirectTo") || "/tasks",
  });

  if (!parsed.success) {
    safeRedirect(formString(formData, "redirectTo"), "error", "Invalid task status.");
  }

  const context = parsed.data.status === "closed"
    ? await requirePermission("tasks.close", "limited")
    : await requirePermission("tasks.update_status", "limited");

  const supabase = await createSupabaseServerClient();
  const { data: taskBeforeUpdate } = await supabase
    .from("tasks")
    .select("assigned_to, title")
    .eq("id", parsed.data.taskId)
    .eq("company_id", context.companyId)
    .maybeSingle();
  const { error } = await supabase
    .from("tasks")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.taskId)
    .eq("company_id", context.companyId);

  if (error) {
    safeRedirect(parsed.data.redirectTo, "error", "Task status could not be updated.");
  }

  await logActivity(context, "tasks.status_updated", "task", parsed.data.taskId, { status: parsed.data.status });
  await notifyUser(
    context,
    taskBeforeUpdate?.assigned_to,
    "Task status changed",
    `${taskBeforeUpdate?.title ?? "Task"} is now ${parsed.data.status}.`,
    "task",
    parsed.data.taskId,
    `/tasks/${parsed.data.taskId}`
  );
  safeRedirect(parsed.data.redirectTo, "notice", "Task status updated.");
}

export async function addTaskCommentAction(formData: FormData) {
  const context = await requirePermission("tasks.view", "view");
  const parsed = taskCommentSchema.safeParse({
    taskId: formString(formData, "taskId"),
    body: formString(formData, "body"),
    redirectTo: formString(formData, "redirectTo") || "/tasks",
  });

  if (!parsed.success) {
    safeRedirect(formString(formData, "redirectTo"), "error", parsed.error.issues[0]?.message ?? "Invalid comment.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("task_comments").insert({
    company_id: context.companyId,
    task_id: parsed.data.taskId,
    user_id: context.userId,
    body: parsed.data.body,
  });

  if (error) {
    safeRedirect(parsed.data.redirectTo, "error", "Comment could not be added.");
  }

  await logActivity(context, "tasks.commented", "task", parsed.data.taskId);
  safeRedirect(parsed.data.redirectTo, "notice", "Comment added.");
}

export async function submitTaskFinalOutputAction(formData: FormData) {
  const context = await requirePermission("content.final_output", "limited");
  const parsed = taskFinalOutputSchema.safeParse({
    taskId: formString(formData, "taskId"),
    finalDriveLink: formString(formData, "finalDriveLink"),
    redirectTo: formString(formData, "redirectTo") || "/tasks",
  });

  if (!parsed.success) {
    safeRedirect(formString(formData, "redirectTo"), "error", parsed.error.issues[0]?.message ?? "Invalid final output.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      final_drive_link: parsed.data.finalDriveLink,
      final_output_submitted_at: new Date().toISOString(),
      final_output_submitted_by: context.userId,
    })
    .eq("id", parsed.data.taskId)
    .eq("company_id", context.companyId);

  if (error) {
    safeRedirect(parsed.data.redirectTo, "error", "Final output link could not be saved.");
  }

  await logActivity(context, "tasks.final_output_submitted", "task", parsed.data.taskId);
  safeRedirect(parsed.data.redirectTo, "notice", "Final output link saved.");
}

export async function createIdeaAction(formData: FormData) {
  const context = await requirePermission("ideas.create", "limited");
  const parsed = ideaSchema.safeParse({
    clientId: formString(formData, "clientId"),
    ideaType: formString(formData, "ideaType") || "post",
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    assignedTo: formString(formData, "assignedTo"),
    teamId: formString(formData, "teamId"),
    notes: formString(formData, "notes"),
    platforms: formStringArray(formData, "platforms"),
    headline: formString(formData, "headline"),
    subtext: formString(formData, "subtext"),
    visual: formString(formData, "visual"),
    cta: formString(formData, "cta"),
    script: formString(formData, "script"),
    urgency: formString(formData, "urgency") || "normal",
    publishingAt: formString(formData, "publishingAt"),
    finalDriveLink: formString(formData, "finalDriveLink"),
    redirectTo: formString(formData, "redirectTo") || "/ideas",
  });

  if (!parsed.success) {
    safeRedirect(formString(formData, "redirectTo"), "error", parsed.error.issues[0]?.message ?? "Invalid idea.");
  }

  try {
    await assertUserInCompany(parsed.data.assignedTo, context.companyId);
    await assertTeamInCompany(parsed.data.teamId, context.companyId);
    await assertClientInCompany(parsed.data.clientId, context.companyId);
    await assertAssignmentScope(context, parsed.data.teamId, parsed.data.assignedTo);
  } catch {
    safeRedirect(parsed.data.redirectTo, "error", "Choose valid company idea links.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ideas")
    .insert({
      company_id: context.companyId,
      client_id: parsed.data.clientId,
      title: parsed.data.title,
      description: parsed.data.description,
      created_by: context.userId,
      assigned_to: parsed.data.assignedTo,
      team_id: parsed.data.teamId,
      notes: parsed.data.notes,
      idea_type: parsed.data.ideaType,
      platforms: parsed.data.platforms,
      headline: parsed.data.headline,
      subtext: parsed.data.subtext,
      visual: parsed.data.visual,
      cta: parsed.data.cta,
      script: parsed.data.script,
      urgency: parsed.data.urgency,
      publishing_at: parsed.data.publishingAt,
      final_drive_link: parsed.data.finalDriveLink || null,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    safeRedirect(parsed.data.redirectTo, "error", "Idea could not be created.");
  }

  await logActivity(context, "ideas.created", "idea", data.id, { title: parsed.data.title });
  await notifyUser(
    context,
    parsed.data.assignedTo,
    "Idea assigned",
    parsed.data.title,
    "idea",
    data.id,
    `/ideas/${data.id}`
  );
  safeRedirect(parsed.data.redirectTo, "notice", "Idea created.");
}

export async function updateIdeaAction(formData: FormData) {
  const context = await requirePermission("ideas.update", "limited");
  const parsed = ideaSchema.safeParse({
    ideaId: formString(formData, "ideaId"),
    clientId: formString(formData, "clientId"),
    ideaType: formString(formData, "ideaType") || "post",
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    assignedTo: formString(formData, "assignedTo"),
    teamId: formString(formData, "teamId"),
    notes: formString(formData, "notes"),
    platforms: formStringArray(formData, "platforms"),
    headline: formString(formData, "headline"),
    subtext: formString(formData, "subtext"),
    visual: formString(formData, "visual"),
    cta: formString(formData, "cta"),
    script: formString(formData, "script"),
    urgency: formString(formData, "urgency") || "normal",
    publishingAt: formString(formData, "publishingAt"),
    finalDriveLink: formString(formData, "finalDriveLink"),
    redirectTo: formString(formData, "redirectTo") || "/ideas",
  });

  if (!parsed.success || !parsed.data.ideaId) {
    safeRedirect(formString(formData, "redirectTo"), "error", parsed.error?.issues[0]?.message ?? "Invalid idea.");
  }

  try {
    await assertUserInCompany(parsed.data.assignedTo, context.companyId);
    await assertTeamInCompany(parsed.data.teamId, context.companyId);
    await assertClientInCompany(parsed.data.clientId, context.companyId);
    await assertAssignmentScope(context, parsed.data.teamId, parsed.data.assignedTo);
  } catch {
    safeRedirect(parsed.data.redirectTo, "error", "Choose valid company idea links.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("ideas")
    .update({
      client_id: parsed.data.clientId,
      title: parsed.data.title,
      description: parsed.data.description,
      assigned_to: parsed.data.assignedTo,
      team_id: parsed.data.teamId,
      notes: parsed.data.notes,
      idea_type: parsed.data.ideaType,
      platforms: parsed.data.platforms,
      headline: parsed.data.headline,
      subtext: parsed.data.subtext,
      visual: parsed.data.visual,
      cta: parsed.data.cta,
      script: parsed.data.script,
      urgency: parsed.data.urgency,
      publishing_at: parsed.data.publishingAt,
      final_drive_link: parsed.data.finalDriveLink || null,
    })
    .eq("id", parsed.data.ideaId)
    .eq("company_id", context.companyId);

  if (error) {
    safeRedirect(parsed.data.redirectTo, "error", "Idea could not be updated.");
  }

  await logActivity(context, "ideas.updated", "idea", parsed.data.ideaId);
  safeRedirect(parsed.data.redirectTo, "notice", "Idea updated.");
}

export async function updateIdeaStatusAction(formData: FormData) {
  const context = await requirePermission("ideas.change_status", "limited");
  const parsed = ideaStatusSchema.safeParse({
    ideaId: formString(formData, "ideaId"),
    status: formString(formData, "status"),
    redirectTo: formString(formData, "redirectTo") || "/ideas",
  });

  if (!parsed.success) {
    safeRedirect(formString(formData, "redirectTo"), "error", "Invalid idea status.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: ideaBeforeUpdate } = await supabase
    .from("ideas")
    .select("title, created_by, assigned_to")
    .eq("id", parsed.data.ideaId)
    .eq("company_id", context.companyId)
    .maybeSingle();
  const { error } = await supabase
    .from("ideas")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.ideaId)
    .eq("company_id", context.companyId);

  if (error) {
    safeRedirect(parsed.data.redirectTo, "error", "Idea status could not be updated.");
  }

  await logActivity(context, "ideas.status_updated", "idea", parsed.data.ideaId, { status: parsed.data.status });
  await Promise.all([
    notifyUser(
      context,
      ideaBeforeUpdate?.created_by,
      "Idea status changed",
      `${ideaBeforeUpdate?.title ?? "Idea"} is now ${parsed.data.status}.`,
      "idea",
      parsed.data.ideaId,
      `/ideas/${parsed.data.ideaId}`
    ),
    notifyUser(
      context,
      ideaBeforeUpdate?.assigned_to,
      "Idea status changed",
      `${ideaBeforeUpdate?.title ?? "Idea"} is now ${parsed.data.status}.`,
      "idea",
      parsed.data.ideaId,
      `/ideas/${parsed.data.ideaId}`
    ),
  ]);
  safeRedirect(parsed.data.redirectTo, "notice", "Idea status updated.");
}

export async function deleteIdeaAction(formData: FormData) {
  const context = await requirePermission("ideas.update", "limited");
  const parsed = ideaDeleteSchema.safeParse({
    ideaId: formString(formData, "ideaId"),
    redirectTo: formString(formData, "redirectTo") || "/ideas",
  });

  if (!parsed.success) {
    safeRedirect(formString(formData, "redirectTo"), "error", "Invalid idea.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("ideas")
    .delete()
    .eq("id", parsed.data.ideaId)
    .eq("company_id", context.companyId);

  if (error) {
    safeRedirect(parsed.data.redirectTo, "error", "Idea could not be deleted.");
  }

  await logActivity(context, "ideas.deleted", "idea", parsed.data.ideaId);
  safeRedirect(parsed.data.redirectTo, "notice", "Idea deleted.");
}

export async function createContentAction(formData: FormData) {
  const context = await requirePermission("content.create", "limited");
  const parsed = contentSchema.safeParse({
    clientId: formString(formData, "clientId"),
    title: formString(formData, "title"),
    description: formString(formData, "description"),
    templateId: formString(formData, "templateId"),
    creatorId: formString(formData, "creatorId"),
    taskId: formString(formData, "taskId"),
    ideaId: formString(formData, "ideaId"),
    teamId: formString(formData, "teamId"),
    finalDriveLink: formString(formData, "finalDriveLink"),
    redirectTo: formString(formData, "redirectTo") || "/content",
  });

  if (!parsed.success) {
    safeRedirect(formString(formData, "redirectTo"), "error", parsed.error.issues[0]?.message ?? "Invalid content.");
  }

  const creatorId = parsed.data.creatorId ?? context.userId;

  try {
    await assertUserInCompany(creatorId, context.companyId);
    await assertTaskInCompany(parsed.data.taskId, context.companyId);
    await assertIdeaInCompany(parsed.data.ideaId, context.companyId);
    await assertTeamInCompany(parsed.data.teamId, context.companyId);
    await assertClientInCompany(parsed.data.clientId, context.companyId);
    await assertAssignmentScope(context, parsed.data.teamId, creatorId);
  } catch {
    safeRedirect(parsed.data.redirectTo, "error", "Choose valid content links inside your role scope.");
  }

  if (creatorId !== context.userId && !hasPermission(context, "content.create", "full")) {
    safeRedirect(parsed.data.redirectTo, "error", "You can only create content for yourself.");
  }

  const supabase = await createSupabaseServerClient();
  let description = parsed.data.description;

  if (parsed.data.templateId && !description) {
    const { data: template } = await supabase
      .from("content_templates")
      .select("description, body")
      .eq("id", parsed.data.templateId)
      .eq("company_id", context.companyId)
      .eq("status", "active")
      .maybeSingle();

    description = template?.body || template?.description || "";
  }

  const { data, error } = await supabase
    .from("content_items")
    .insert({
      company_id: context.companyId,
      client_id: parsed.data.clientId,
      title: parsed.data.title,
      description,
      creator_id: creatorId,
      task_id: parsed.data.taskId,
      idea_id: parsed.data.ideaId,
      team_id: parsed.data.teamId,
      final_drive_link: parsed.data.finalDriveLink || null,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    safeRedirect(parsed.data.redirectTo, "error", "Content item could not be created.");
  }

  await logActivity(context, "content.created", "content", data.id, { title: parsed.data.title });
  safeRedirect(parsed.data.redirectTo, "notice", "Content item created.");
}

export async function submitContentAction(formData: FormData) {
  const context = await requirePermission("content.submit", "limited");
  const parsed = contentSubmitSchema.safeParse({
    contentId: formString(formData, "contentId"),
    redirectTo: formString(formData, "redirectTo") || "/content",
  });

  if (!parsed.success) {
    safeRedirect(formString(formData, "redirectTo"), "error", "Invalid content submission.");
  }

  const supabase = await createSupabaseServerClient();
  let content: ContentActionRow;
  try {
    content = await loadContentForAction(parsed.data.contentId, context.companyId);
    await assertAssignmentScope(context, content.team_id, content.creator_id);
  } catch {
    safeRedirect(parsed.data.redirectTo, "error", "Content is outside your role scope.");
  }

  if (content.creator_id !== context.userId && !hasPermission(context, "content.submit", "full")) {
    safeRedirect(parsed.data.redirectTo, "error", "You can only submit your own content.");
  }

  if (!creatorSubmissionStatuses.includes(content.status as (typeof creatorSubmissionStatuses)[number])) {
    safeRedirect(parsed.data.redirectTo, "error", "Only drafts or requested changes can be submitted.");
  }

  const { error } = await supabase
    .from("content_items")
    .update({
      status: "submitted_to_team_lead",
      submitted_at: new Date().toISOString(),
      approved_at: null,
    })
    .eq("id", parsed.data.contentId)
    .eq("company_id", context.companyId);

  if (error) {
    safeRedirect(parsed.data.redirectTo, "error", "Content could not be submitted.");
  }

  await logActivity(context, "content.submitted", "content", parsed.data.contentId, { status: "submitted_to_team_lead" });
  if (content.team_id) {
    const { data: team } = await supabase
      .from("teams")
      .select("team_lead_id")
      .eq("id", content.team_id)
      .eq("company_id", context.companyId)
      .maybeSingle();

    await notifyUser(
      context,
      team?.team_lead_id,
      "Content submitted",
      content.title,
      "content",
      parsed.data.contentId,
      `/content/${parsed.data.contentId}`
    );
  }
  safeRedirect(parsed.data.redirectTo, "notice", "Content submitted.");
}

export async function reviewContentAction(formData: FormData) {
  const decision = formString(formData, "decision");
  const context = decision === "approved" || decision === "rejected"
    ? await requirePermission("reviews.approve", "full")
    : decision === "changes_requested"
      ? await requirePermission("reviews.request_changes", "limited")
      : await requirePermission("reviews.add_feedback", "limited");
  const parsed = contentReviewSchema.safeParse({
    contentId: formString(formData, "contentId"),
    decision,
    feedback: formString(formData, "feedback"),
    qualityScore: formString(formData, "qualityScore") || undefined,
    creativityScore: formString(formData, "creativityScore") || undefined,
    accuracyScore: formString(formData, "accuracyScore") || undefined,
    overallRating: formString(formData, "overallRating") || undefined,
    scoreComment: formString(formData, "scoreComment"),
    redirectTo: formString(formData, "redirectTo") || "/content/reviews",
  });

  if (!parsed.success) {
    safeRedirect(formString(formData, "redirectTo"), "error", parsed.error.issues[0]?.message ?? "Invalid review.");
  }

  try {
    const content = await loadContentForAction(parsed.data.contentId, context.companyId);
    await assertAssignmentScope(context, content.team_id, content.creator_id);
    assertCanReviewContent(context, content, parsed.data.decision);
  } catch {
    safeRedirect(parsed.data.redirectTo, "error", "This content is not available for your review scope.");
  }

  const content = await loadContentForAction(parsed.data.contentId, context.companyId);
  const nextStatus = nextReviewState(context, content.status, parsed.data.decision);
  const supabase = await createSupabaseServerClient();
  const { error: reviewError } = await supabase.from("content_reviews").insert({
    company_id: context.companyId,
    content_id: parsed.data.contentId,
    reviewer_id: context.userId,
    decision: reviewDecisionValue(parsed.data.decision),
    feedback: parsed.data.feedback,
    quality_score: parsed.data.qualityScore ?? null,
    creativity_score: parsed.data.creativityScore ?? null,
    accuracy_score: parsed.data.accuracyScore ?? null,
    overall_rating: parsed.data.overallRating ?? null,
    score_comment: parsed.data.scoreComment,
  });

  if (reviewError) {
    safeRedirect(parsed.data.redirectTo, "error", "Review could not be saved.");
  }

  const { error: contentError } = await supabase
    .from("content_items")
    .update({
      status: nextStatus,
      approved_at: parsed.data.decision === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.contentId)
    .eq("company_id", context.companyId);

  if (contentError) {
    safeRedirect(parsed.data.redirectTo, "error", "Content status could not be updated.");
  }

  await logActivity(context, `content.${parsed.data.decision}`, "content", parsed.data.contentId);
  await notifyUser(
    context,
    content.creator_id,
    "Content review updated",
    `${content.title} is now ${nextStatus}.`,
    "content",
    parsed.data.contentId,
    `/content/${parsed.data.contentId}`
  );
  safeRedirect(parsed.data.redirectTo, "notice", "Review saved.");
}

export async function rateContentAction(formData: FormData) {
  const context = await requirePermission("content.rate", "limited");
  const parsed = contentRatingSchema.safeParse({
    contentId: formString(formData, "contentId"),
    ratingValue: formString(formData, "ratingValue"),
    comment: formString(formData, "comment"),
    redirectTo: formString(formData, "redirectTo") || "/content/reviews",
  });

  if (!parsed.success) {
    safeRedirect(formString(formData, "redirectTo"), "error", parsed.error.issues[0]?.message ?? "Invalid rating.");
  }

  let content: ContentActionRow;
  try {
    content = await loadContentForAction(parsed.data.contentId, context.companyId);
    await assertAssignmentScope(context, content.team_id, content.creator_id);
    assertCanReviewContent(context, content, context.role === "team-lead" ? "send_to_supervisor" : "approved");
  } catch {
    safeRedirect(parsed.data.redirectTo, "error", "This content cannot be rated from your current scope.");
  }

  if (content.creator_id === context.userId && context.role !== "admin") {
    safeRedirect(parsed.data.redirectTo, "error", "You cannot rate your own content.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("content_ratings").upsert(
    {
      company_id: context.companyId,
      content_id: parsed.data.contentId,
      reviewer_id: context.userId,
      rating_value: parsed.data.ratingValue,
      comment: parsed.data.comment,
    },
    { onConflict: "content_id,reviewer_id" }
  );

  if (error) {
    safeRedirect(parsed.data.redirectTo, "error", "Content rating could not be saved.");
  }

  await logActivity(context, "content.rated", "content", parsed.data.contentId, {
    rating_value: parsed.data.ratingValue,
  });
  safeRedirect(parsed.data.redirectTo, "notice", "Rating saved.");
}

export async function scheduleContentAction(formData: FormData) {
  const context = await requirePermission("calendar.schedule_content", "limited");
  const parsed = contentScheduleSchema.safeParse({
    contentId: formString(formData, "contentId"),
    scheduledAt: formString(formData, "scheduledAt"),
    redirectTo: formString(formData, "redirectTo") || "/content",
  });

  if (!parsed.success || !parsed.data.scheduledAt) {
    safeRedirect(formString(formData, "redirectTo"), "error", "Choose a valid schedule time.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: content, error: loadError } = await supabase
    .from("content_items")
    .select("id, title, creator_id, client_id")
    .eq("id", parsed.data.contentId)
    .eq("company_id", context.companyId)
    .maybeSingle();

  if (loadError || !content) {
    safeRedirect(parsed.data.redirectTo, "error", "Content item could not be scheduled.");
  }

  const { error: updateError } = await supabase
    .from("content_items")
    .update({ status: "scheduled", scheduled_at: parsed.data.scheduledAt })
    .eq("id", parsed.data.contentId)
    .eq("company_id", context.companyId);

  if (updateError) {
    safeRedirect(parsed.data.redirectTo, "error", "Content item could not be scheduled.");
  }

  const endDate = new Date(parsed.data.scheduledAt);
  endDate.setMinutes(endDate.getMinutes() + 30);
  await supabase.from("calendar_events").insert({
    company_id: context.companyId,
    title: content.title,
    description: "Scheduled content item.",
    event_type: "content",
    content_id: content.id,
    client_id: content.client_id,
    user_id: content.creator_id,
    start_date: parsed.data.scheduledAt,
    end_date: endDate.toISOString(),
    created_by: context.userId,
  });

  await logActivity(context, "content.scheduled", "content", parsed.data.contentId, {
    scheduled_at: parsed.data.scheduledAt,
  });
  safeRedirect(parsed.data.redirectTo, "notice", "Content scheduled.");
}

export async function submitContentFinalOutputAction(formData: FormData) {
  const context = await requirePermission("content.final_output", "limited");
  const parsed = contentFinalOutputSchema.safeParse({
    contentId: formString(formData, "contentId"),
    finalDriveLink: formString(formData, "finalDriveLink"),
    redirectTo: formString(formData, "redirectTo") || "/content",
  });

  if (!parsed.success) {
    safeRedirect(formString(formData, "redirectTo"), "error", parsed.error.issues[0]?.message ?? "Invalid final output.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("content_items")
    .update({
      final_drive_link: parsed.data.finalDriveLink,
      final_output_submitted_at: new Date().toISOString(),
      final_output_submitted_by: context.userId,
    })
    .eq("id", parsed.data.contentId)
    .eq("company_id", context.companyId);

  if (error) {
    safeRedirect(parsed.data.redirectTo, "error", "Final output link could not be saved.");
  }

  await logActivity(context, "content.final_output_submitted", "content", parsed.data.contentId);
  safeRedirect(parsed.data.redirectTo, "notice", "Final output link saved.");
}

export async function createTimeOffRequestAction(formData: FormData) {
  const context = await requirePermission("day_off.submit", "limited");
  const parsed = timeOffRequestSchema.safeParse({
    requestType: formString(formData, "requestType"),
    startDate: formString(formData, "startDate"),
    endDate: formString(formData, "endDate"),
    reason: formString(formData, "reason"),
    redirectTo: formString(formData, "redirectTo") || "/calendar",
  });

  if (!parsed.success) {
    safeRedirect("/calendar", "error", parsed.error.issues[0]?.message ?? "Invalid time-off request.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("day_off_requests")
    .insert({
      company_id: context.companyId,
      user_id: context.userId,
      request_type: parsed.data.requestType,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      reason: parsed.data.reason,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    safeRedirect(parsed.data.redirectTo, "error", "Time-off request could not be submitted.");
  }

  await logActivity(context, "time_off.requested", "day_off_request", data.id, {
    request_type: parsed.data.requestType,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate,
  });
  safeRedirect(parsed.data.redirectTo, "notice", "Time-off request submitted.");
}

export async function reviewTimeOffRequestAction(formData: FormData) {
  const context = await requirePermission("day_off.approve", "limited");
  const parsed = timeOffReviewSchema.safeParse({
    requestId: formString(formData, "requestId"),
    decision: formString(formData, "decision"),
    redirectTo: formString(formData, "redirectTo") || "/calendar",
  });

  if (!parsed.success) {
    safeRedirect("/calendar", "error", parsed.error.issues[0]?.message ?? "Invalid request review.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: request, error: loadError } = await supabase
    .from("day_off_requests")
    .select("id, user_id, company_id, request_type")
    .eq("id", parsed.data.requestId)
    .eq("company_id", context.companyId)
    .maybeSingle();

  if (loadError || !request) {
    safeRedirect(parsed.data.redirectTo, "error", "Time-off request could not be found.");
  }

  try {
    await assertUserScope(context, request.user_id);
  } catch {
    safeRedirect(parsed.data.redirectTo, "error", "This request is outside your review scope.");
  }

  const { error } = await supabase
    .from("day_off_requests")
    .update({
      status: parsed.data.decision,
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.requestId)
    .eq("company_id", context.companyId);

  if (error) {
    safeRedirect(parsed.data.redirectTo, "error", "Time-off request could not be reviewed.");
  }

  await logActivity(context, "time_off.reviewed", "day_off_request", parsed.data.requestId, {
    decision: parsed.data.decision,
    request_type: request.request_type,
  });
  await notifyUser(
    context,
    request.user_id,
    `Time-off request ${parsed.data.decision}`,
    `Your ${String(request.request_type).replace("_", " ")} request was ${parsed.data.decision}.`,
    "calendar",
    parsed.data.requestId,
    "/calendar"
  );
  safeRedirect(parsed.data.redirectTo, "notice", `Time-off request ${parsed.data.decision}.`);
}

export async function generateReportAction(formData: FormData) {
  const context = await requirePermission("reports.submit", "limited");
  const parsed = generatedReportSchema.safeParse({
    clientId: formString(formData, "clientId"),
    reportType: formString(formData, "reportType"),
    userId: formString(formData, "userId"),
    teamId: formString(formData, "teamId"),
    note: formString(formData, "note"),
    postsPublished: formString(formData, "postsPublished"),
    storiesPublished: formString(formData, "storiesPublished"),
    reelsPublished: formString(formData, "reelsPublished"),
    reachGrowth: formString(formData, "reachGrowth"),
    engagementRate: formString(formData, "engagementRate"),
    followerGrowth: formString(formData, "followerGrowth"),
    keyAchievements: formString(formData, "keyAchievements"),
    mainChallenges: formString(formData, "mainChallenges"),
    nextMonthFocus: formString(formData, "nextMonthFocus"),
    totalAdSpend: formString(formData, "totalAdSpend"),
    reach: formString(formData, "reach"),
    impressions: formString(formData, "impressions"),
    clicks: formString(formData, "clicks"),
    ctr: formString(formData, "ctr"),
    cpc: formString(formData, "cpc"),
    cpm: formString(formData, "cpm"),
    leadsGenerated: formString(formData, "leadsGenerated"),
    conversions: formString(formData, "conversions"),
    roas: formString(formData, "roas"),
    customSection: formString(formData, "customSection"),
  });

  if (!parsed.success) {
    safeRedirect("/reports", "error", parsed.error.issues[0]?.message ?? "Invalid report request.");
  }

  const teamId = parsed.data.teamId;
  const clientId = parsed.data.clientId;
  const reportUserId = parsed.data.userId ?? (teamId ? null : context.userId);

  if (reportUserId && reportUserId !== context.userId && !hasPermission(context, "reports.view_team", "limited")) {
    safeRedirect("/reports", "error", "You can only generate your own report.");
  }

  if (teamId && !hasPermission(context, "reports.view_team", "limited")) {
    safeRedirect("/reports", "error", "You can only generate your own report.");
  }

  try {
    await assertUserInCompany(reportUserId, context.companyId);
    await assertTeamInCompany(teamId, context.companyId);
    await assertClientInCompany(clientId, context.companyId);
    await assertUserScope(context, reportUserId);
    await assertTeamScope(context, teamId);
  } catch {
    safeRedirect("/reports", "error", "Report scope must stay inside your company and role access.");
  }

  const range = reportRange(parsed.data.reportType);
  const supabase = await createSupabaseServerClient();

  let completedTasksQuery = supabase
    .from("tasks")
    .select("id, title, status, updated_at")
    .eq("company_id", context.companyId)
    .in("status", ["completed", "closed"])
    .gte("updated_at", range.startIso)
    .lte("updated_at", range.endIso);
  let updatedTasksQuery = supabase
    .from("tasks")
    .select("id, title, status, updated_at")
    .eq("company_id", context.companyId)
    .gte("updated_at", range.startIso)
    .lte("updated_at", range.endIso);
  let submittedContentQuery = supabase
    .from("content_items")
    .select("id, title, status, submitted_at, updated_at")
    .eq("company_id", context.companyId)
    .not("submitted_at", "is", null)
    .gte("submitted_at", range.startIso)
    .lte("submitted_at", range.endIso);
  let reviewedContentQuery = supabase
    .from("content_items")
    .select("id, title, status, approved_at, updated_at")
    .eq("company_id", context.companyId)
    .in("status", ["approved", "rejected", "changes_requested_by_team_lead", "changes_requested_by_supervisor"])
    .gte("updated_at", range.startIso)
    .lte("updated_at", range.endIso);
  let workDaysQuery = supabase
    .from("work_days")
    .select("total_worked_minutes, total_break_minutes, total_missing_minutes, status")
    .eq("company_id", context.companyId)
    .gte("work_date", range.startDate)
    .lte("work_date", range.endDate);
  let timeOffQuery = supabase
    .from("day_off_requests")
    .select("id, request_type, status, start_date, end_date")
    .eq("company_id", context.companyId)
    .lte("start_date", range.endDate)
    .gte("end_date", range.startDate);

  if (teamId) {
    completedTasksQuery = completedTasksQuery.eq("team_id", teamId);
    updatedTasksQuery = updatedTasksQuery.eq("team_id", teamId);
    submittedContentQuery = submittedContentQuery.eq("team_id", teamId);
    reviewedContentQuery = reviewedContentQuery.eq("team_id", teamId);
  }

  if (clientId) {
    completedTasksQuery = completedTasksQuery.eq("client_id", clientId);
    updatedTasksQuery = updatedTasksQuery.eq("client_id", clientId);
    submittedContentQuery = submittedContentQuery.eq("client_id", clientId);
    reviewedContentQuery = reviewedContentQuery.eq("client_id", clientId);
  }

  if (reportUserId) {
    completedTasksQuery = completedTasksQuery.eq("assigned_to", reportUserId);
    updatedTasksQuery = updatedTasksQuery.eq("assigned_to", reportUserId);
    submittedContentQuery = submittedContentQuery.eq("creator_id", reportUserId);
    reviewedContentQuery = reviewedContentQuery.eq("creator_id", reportUserId);
    workDaysQuery = workDaysQuery.eq("user_id", reportUserId);
    timeOffQuery = timeOffQuery.eq("user_id", reportUserId);
  }

  const [
    { data: completedTasks, error: completedTasksError },
    { data: updatedTasks, error: updatedTasksError },
    { data: submittedContent, error: submittedContentError },
    { data: reviewedContent, error: reviewedContentError },
    { data: workDays, error: workDaysError },
    { data: timeOff, error: timeOffError },
  ] = await Promise.all([
    completedTasksQuery,
    updatedTasksQuery,
    submittedContentQuery,
    reviewedContentQuery,
    workDaysQuery,
    timeOffQuery,
  ]);

  if (
    completedTasksError ||
    updatedTasksError ||
    submittedContentError ||
    reviewedContentError ||
    workDaysError ||
    timeOffError
  ) {
    safeRedirect("/reports", "error", "Report data could not be generated.");
  }

  const workSummary = ((workDays as Array<{
    total_worked_minutes: number;
    total_break_minutes: number;
    total_missing_minutes: number;
  }> | null) ?? []).reduce(
    (summary, day) => ({
      worked: summary.worked + day.total_worked_minutes,
      break: summary.break + day.total_break_minutes,
      missing: summary.missing + day.total_missing_minutes,
    }),
    { worked: 0, break: 0, missing: 0 }
  );
  const completedTaskRows = completedTasks ?? [];
  const updatedTaskRows = updatedTasks ?? [];
  const submittedContentRows = submittedContent ?? [];
  const reviewedContentRows = reviewedContent ?? [];
  const timeOffRows = timeOff ?? [];
  const note = parsed.data.note.trim();
  const builderMetrics = {
    postsPublished: parsed.data.postsPublished,
    storiesPublished: parsed.data.storiesPublished,
    reelsPublished: parsed.data.reelsPublished,
    reachGrowth: parsed.data.reachGrowth,
    engagementRate: parsed.data.engagementRate,
    followerGrowth: parsed.data.followerGrowth,
    totalAdSpend: parsed.data.totalAdSpend,
    reach: parsed.data.reach,
    impressions: parsed.data.impressions,
    clicks: parsed.data.clicks,
    ctr: parsed.data.ctr,
    cpc: parsed.data.cpc,
    cpm: parsed.data.cpm,
    leadsGenerated: parsed.data.leadsGenerated,
    conversions: parsed.data.conversions,
    roas: parsed.data.roas,
  };
  const builderLines = [
    ["Total posts published", parsed.data.postsPublished],
    ["Total stories published", parsed.data.storiesPublished],
    ["Total reels/videos published", parsed.data.reelsPublished],
    ["Reach growth", parsed.data.reachGrowth],
    ["Engagement rate", parsed.data.engagementRate],
    ["Follower growth", parsed.data.followerGrowth],
    ["Total ad spend", parsed.data.totalAdSpend],
    ["Reach", parsed.data.reach],
    ["Impressions", parsed.data.impressions],
    ["Clicks", parsed.data.clicks],
    ["CTR", parsed.data.ctr],
    ["CPC", parsed.data.cpc],
    ["CPM", parsed.data.cpm],
    ["Leads generated", parsed.data.leadsGenerated],
    ["Conversions", parsed.data.conversions],
    ["ROAS", parsed.data.roas],
  ].filter(([, value]) => value);
  const scopeLabel = teamId ? "team scope" : reportUserId === context.userId ? "my scope" : "selected user scope";
  const title = `${parsed.data.reportType === "daily" ? "Daily" : "Weekly"} generated report - ${range.startDate} to ${range.endDate}`;
  const bodyLines = [
    `${title}`,
    `Scope: ${scopeLabel}.`,
    `Completed tasks: ${completedTaskRows.length}.`,
    `Updated tasks: ${updatedTaskRows.length}.`,
    `Submitted content: ${submittedContentRows.length}.`,
    `Reviewed/decisioned content: ${reviewedContentRows.length}.`,
    `Worked time: ${minutesLabel(workSummary.worked)}.`,
    `Break time: ${minutesLabel(workSummary.break)}.`,
    `Missing time: ${minutesLabel(workSummary.missing)}.`,
    `Time-off and sick-leave records: ${timeOffRows.length}.`,
  ];

  if (completedTaskRows.length) {
    bodyLines.push(`Completed task titles: ${completedTaskRows.slice(0, 8).map((task) => task.title).join(", ")}.`);
  }

  if (submittedContentRows.length) {
    bodyLines.push(`Submitted content titles: ${submittedContentRows.slice(0, 8).map((item) => item.title).join(", ")}.`);
  }

  if (builderLines.length) {
    bodyLines.push("", "Client-ready metrics:");
    builderLines.forEach(([label, value]) => bodyLines.push(`${label}: ${value}`));
  }

  if (parsed.data.keyAchievements) {
    bodyLines.push("", `Key achievements: ${parsed.data.keyAchievements}`);
  }

  if (parsed.data.mainChallenges) {
    bodyLines.push(`Main challenges: ${parsed.data.mainChallenges}`);
  }

  if (parsed.data.nextMonthFocus) {
    bodyLines.push(`Next month's focus: ${parsed.data.nextMonthFocus}`);
  }

  if (parsed.data.customSection) {
    bodyLines.push(`Custom section: ${parsed.data.customSection}`);
  }

  if (note) {
    bodyLines.push(`Note: ${note}`);
  }

  const content: Json = {
    title,
    body: bodyLines.join("\n"),
    generated: true,
    note,
    metrics: {
      completedTasks: completedTaskRows.length,
      updatedTasks: updatedTaskRows.length,
      submittedContent: submittedContentRows.length,
      reviewedContent: reviewedContentRows.length,
      workedMinutes: workSummary.worked,
      breakMinutes: workSummary.break,
      missingMinutes: workSummary.missing,
      timeOffRecords: timeOffRows.length,
      ...builderMetrics,
    },
  };

  const { data, error } = await supabase
    .from("reports")
    .insert({
      company_id: context.companyId,
      client_id: clientId,
      user_id: reportUserId,
      team_id: teamId,
      report_type: parsed.data.reportType,
      title,
      content,
      metrics_json: content.metrics as Json,
      date_range_start: range.startDate,
      date_range_end: range.endDate,
    })
    .select("id")
    .single();

  if (error || !data) {
    safeRedirect("/reports", "error", "Generated report could not be saved.");
  }

  await logActivity(context, "reports.generated", "report", data.id, {
    report_type: parsed.data.reportType,
    date_range_start: range.startDate,
    date_range_end: range.endDate,
  });
  safeRedirect("/reports", "notice", "Generated report saved.");
}

export async function createReportAction(formData: FormData) {
  const context = await requirePermission("reports.submit", "limited");
  const parsed = reportSchema.safeParse({
    clientId: formString(formData, "clientId"),
    reportType: formString(formData, "reportType"),
    title: formString(formData, "title"),
    body: formString(formData, "body"),
    userId: formString(formData, "userId"),
    teamId: formString(formData, "teamId"),
    dateRangeStart: formString(formData, "dateRangeStart"),
    dateRangeEnd: formString(formData, "dateRangeEnd"),
  });

  if (!parsed.success) {
    safeRedirect("/reports", "error", parsed.error.issues[0]?.message ?? "Invalid report.");
  }

  const reportUserId = parsed.data.userId ?? context.userId;
  const clientId = parsed.data.clientId;

  if (reportUserId !== context.userId && !hasPermission(context, "reports.view_team", "limited")) {
    safeRedirect("/reports", "error", "You can only submit your own report.");
  }

  try {
    await assertUserInCompany(reportUserId, context.companyId);
    await assertTeamInCompany(parsed.data.teamId, context.companyId);
    await assertClientInCompany(clientId, context.companyId);
  } catch {
    safeRedirect("/reports", "error", "Report user and team must belong to your company.");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reports")
    .insert({
      company_id: context.companyId,
      client_id: clientId,
      user_id: reportUserId,
      team_id: parsed.data.teamId,
      report_type: parsed.data.reportType,
      title: parsed.data.title,
      content: {
        title: parsed.data.title,
        body: parsed.data.body,
      },
      metrics_json: {},
      date_range_start: parsed.data.dateRangeStart,
      date_range_end: parsed.data.dateRangeEnd,
    })
    .select("id")
    .single();

  if (error || !data) {
    safeRedirect("/reports", "error", "Report could not be created.");
  }

  await logActivity(context, "reports.created", "report", data.id, { report_type: parsed.data.reportType });
  safeRedirect("/reports", "notice", "Report saved.");
}

export async function sendReportToClientAction(formData: FormData) {
  const context = await requirePermission("reports.send_to_client", "limited");
  const parsed = reportSendToClientSchema.safeParse({
    reportId: formString(formData, "reportId"),
    redirectTo: formString(formData, "redirectTo") || "/reports",
  });

  if (!parsed.success) {
    safeRedirect(formString(formData, "redirectTo"), "error", "Invalid report.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: report, error: loadError } = await supabase
    .from("reports")
    .select("id, client_id")
    .eq("id", parsed.data.reportId)
    .eq("company_id", context.companyId)
    .maybeSingle();

  if (loadError || !report) {
    safeRedirect(parsed.data.redirectTo, "error", "Report could not be found.");
  }

  if (!report.client_id) {
    safeRedirect(parsed.data.redirectTo, "error", "Only client-scoped reports can be sent to a client.");
  }

  const { error } = await supabase
    .from("reports")
    .update({
      sent_to_client_at: new Date().toISOString(),
      sent_to_client_by: context.userId,
    })
    .eq("id", parsed.data.reportId)
    .eq("company_id", context.companyId);

  if (error) {
    safeRedirect(parsed.data.redirectTo, "error", "Report could not be marked as sent.");
  }

  await logActivity(context, "reports.sent_to_client", "report", parsed.data.reportId, {
    client_id: report.client_id,
  });
  safeRedirect(parsed.data.redirectTo, "notice", "Report sent to client.");
}

export async function ensureWorkflowAccess(permissionKey: string) {
  const context = await requireAuthContext();

  if (!hasPermission(context, permissionKey, "view")) {
    redirect("/account-inactive");
  }

  return context;
}
