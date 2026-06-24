import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth/permissions";
import { getCairoDate } from "@/lib/time";
import type { Database } from "@/types/database";

export type CompanyRole = Database["public"]["Tables"]["roles"]["Row"];
export type CompanyTeam = Database["public"]["Tables"]["teams"]["Row"];
export type CompanyUser = Database["public"]["Tables"]["users"]["Row"] & {
  roleName: string;
  teamId: string | null;
  teamName: string | null;
};
export type CompanyInvitation = Database["public"]["Tables"]["user_invitations"]["Row"] & {
  roleName: string;
  teamName: string | null;
  invitedByEmail: string | null;
};
export type CompanyWorkDay = Database["public"]["Tables"]["work_days"]["Row"] & {
  userName: string;
  userEmail: string;
  userStatus: Database["public"]["Enums"]["user_status"] | null;
};
export type CompanyBreakSession = Database["public"]["Tables"]["break_sessions"]["Row"] & {
  workDate: string;
  userName: string;
  userEmail: string;
};

function fullName(firstName: string, lastName: string) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

export async function getCompanyRoles(context: AuthContext) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("roles")
    .select("id, company_id, name, description")
    .eq("company_id", context.companyId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Unable to load company roles.");
  }

  return (data as CompanyRole[] | null) ?? [];
}

export async function getCompanyTeams(context: AuthContext) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id, company_id, name, description")
    .eq("company_id", context.companyId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Unable to load company teams.");
  }

  return (data as CompanyTeam[] | null) ?? [];
}

export async function getCompanyUsers(
  context: AuthContext,
  filters: { search?: string; status?: string } = {}
) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("users")
    .select("id, company_id, email, first_name, last_name, avatar_url, role_id, status, created_at, updated_at")
    .eq("company_id", context.companyId)
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status as Database["public"]["Enums"]["user_status"]);
  }

  if (filters.search) {
    const term = filters.search.trim();
    query = query.or(`email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`);
  }

  const [{ data: users, error: usersError }, roles, teams] = await Promise.all([
    query,
    getCompanyRoles(context),
    getCompanyTeams(context),
  ]);

  if (usersError) {
    throw new Error("Unable to load company users.");
  }

  const userRows = (users as Database["public"]["Tables"]["users"]["Row"][] | null) ?? [];
  const userIds = userRows.map((user) => user.id);
  const { data: teamMembers, error: teamMembersError } = userIds.length
    ? await supabase.from("team_members").select("team_id, user_id").in("user_id", userIds)
    : { data: [], error: null };

  if (teamMembersError) {
    throw new Error("Unable to load team memberships.");
  }

  const roleById = new Map(roles.map((role) => [role.id, role.name]));
  const teamById = new Map(teams.map((team) => [team.id, team.name]));
  const teamByUserId = new Map(
    ((teamMembers as Database["public"]["Tables"]["team_members"]["Row"][] | null) ?? [])
      .map((membership) => [membership.user_id, membership.team_id])
  );

  return userRows.map((user) => {
    const teamId = teamByUserId.get(user.id) ?? null;

    return {
      ...user,
      roleName: user.role_id ? roleById.get(user.role_id) ?? "Unassigned" : "Unassigned",
      teamId,
      teamName: teamId ? teamById.get(teamId) ?? null : null,
    };
  });
}

export async function getCompanyInvitations(context: AuthContext) {
  const supabase = await createSupabaseServerClient();
  const [{ data: invitations, error }, roles, teams] = await Promise.all([
    supabase
      .from("user_invitations")
      .select("id, company_id, email, role_id, team_id, token_hash, status, message, invited_by, expires_at, accepted_at, created_at, updated_at")
      .eq("company_id", context.companyId)
      .order("created_at", { ascending: false }),
    getCompanyRoles(context),
    getCompanyTeams(context),
  ]);

  if (error) {
    throw new Error("Unable to load invitations.");
  }

  const invitationRows =
    (invitations as Database["public"]["Tables"]["user_invitations"]["Row"][] | null) ?? [];
  const invitedByIds = Array.from(
    new Set(invitationRows.map((invitation) => invitation.invited_by).filter(Boolean) as string[])
  );
  const { data: inviters, error: invitersError } = invitedByIds.length
    ? await supabase.from("users").select("id, email").in("id", invitedByIds)
    : { data: [], error: null };

  if (invitersError) {
    throw new Error("Unable to load invitation owners.");
  }

  const roleById = new Map(roles.map((role) => [role.id, role.name]));
  const teamById = new Map(teams.map((team) => [team.id, team.name]));
  const inviterById = new Map(((inviters as Array<{ id: string; email: string }> | null) ?? []).map((user) => [user.id, user.email]));

  return invitationRows.map((invitation) => ({
    ...invitation,
    roleName: roleById.get(invitation.role_id) ?? "Unknown role",
    teamName: invitation.team_id ? teamById.get(invitation.team_id) ?? null : null,
    invitedByEmail: invitation.invited_by ? inviterById.get(invitation.invited_by) ?? null : null,
  }));
}

export async function getCompanyWorkDays(context: AuthContext, date?: string) {
  const supabase = await createSupabaseServerClient();
  const workDate = date || getCairoDate();
  const [{ data: workDays, error }, users] = await Promise.all([
    supabase
      .from("work_days")
      .select("id, company_id, user_id, work_date, first_sign_in_at, last_sign_out_at, total_worked_minutes, total_break_minutes, total_missing_minutes, status, created_at, updated_at")
      .eq("company_id", context.companyId)
      .eq("work_date", workDate)
      .order("first_sign_in_at", { ascending: false }),
    getCompanyUsers(context),
  ]);

  if (error) {
    throw new Error("Unable to load work-hour records.");
  }

  const userById = new Map(users.map((user) => [user.id, user]));

  return ((workDays as Database["public"]["Tables"]["work_days"]["Row"][] | null) ?? []).map((workDay) => {
    const user = userById.get(workDay.user_id);

    return {
      ...workDay,
      userName: user ? fullName(user.first_name, user.last_name) || user.email : "Unknown user",
      userEmail: user?.email ?? "",
      userStatus: user?.status ?? null,
    };
  });
}

export async function getCompanyBreakSessions(context: AuthContext, date?: string) {
  const supabase = await createSupabaseServerClient();
  const workDate = date || getCairoDate();
  const [workDays, users] = await Promise.all([
    getCompanyWorkDays(context, workDate),
    getCompanyUsers(context),
  ]);
  const workDayIds = workDays.map((workDay) => workDay.id);

  if (!workDayIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("break_sessions")
    .select("id, company_id, user_id, work_day_id, started_at, ended_at, duration_minutes, created_at")
    .in("work_day_id", workDayIds)
    .order("started_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load break history.");
  }

  const workDayById = new Map(workDays.map((workDay) => [workDay.id, workDay]));
  const userById = new Map(users.map((user) => [user.id, user]));

  return ((data as Database["public"]["Tables"]["break_sessions"]["Row"][] | null) ?? []).map((breakSession) => {
    const workDay = workDayById.get(breakSession.work_day_id);
    const user = userById.get(breakSession.user_id);

    return {
      ...breakSession,
      workDate: workDay?.work_date ?? workDate,
      userName: user ? fullName(user.first_name, user.last_name) || user.email : "Unknown user",
      userEmail: user?.email ?? "",
    };
  });
}
