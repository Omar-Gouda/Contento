import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth/permissions";

type IdRow = { id: string };
type TeamMemberIdRow = { team_id: string; user_id?: string };

export const activeReviewStatuses = [
  "submitted_to_team_lead",
  "changes_requested_by_team_lead",
  "sent_to_supervisor",
  "changes_requested_by_supervisor",
  "approved",
  "scheduled",
] as const;

export const creatorSubmissionStatuses = [
  "draft",
  "changes_requested_by_team_lead",
  "changes_requested_by_supervisor",
] as const;

export function canUseCompanyScope(context: AuthContext) {
  return context.role === "admin";
}

export async function getVisibleTeamIds(context: AuthContext) {
  if (canUseCompanyScope(context)) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: ledTeams }, { data: memberships }] = await Promise.all([
    supabase
      .from("teams")
      .select("id")
      .eq("company_id", context.companyId)
      .eq("team_lead_id", context.userId),
    supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", context.userId),
  ]);

  return Array.from(
    new Set([
      ...(((ledTeams as IdRow[] | null) ?? []).map((team) => team.id)),
      ...(((memberships as TeamMemberIdRow[] | null) ?? []).map((membership) => membership.team_id)),
    ])
  );
}

export async function getVisibleUserIds(context: AuthContext) {
  if (canUseCompanyScope(context)) {
    return null;
  }

  const teamIds = await getVisibleTeamIds(context);

  if (!teamIds || !teamIds.length) {
    return [context.userId];
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("team_members")
    .select("user_id")
    .in("team_id", teamIds);

  return Array.from(new Set([context.userId, ...(((data as TeamMemberIdRow[] | null) ?? []).map((row) => row.user_id).filter(Boolean) as string[])]));
}

export async function assertTeamScope(context: AuthContext, teamId: string | null) {
  if (!teamId || canUseCompanyScope(context)) {
    return;
  }

  const visibleTeamIds = await getVisibleTeamIds(context);
  if (!visibleTeamIds?.includes(teamId)) {
    throw new Error("Team is outside your role scope.");
  }
}

export async function assertUserScope(context: AuthContext, userId: string | null) {
  if (!userId || canUseCompanyScope(context)) {
    return;
  }

  const visibleUserIds = await getVisibleUserIds(context);
  if (!visibleUserIds?.includes(userId)) {
    throw new Error("User is outside your role scope.");
  }
}

export async function assertUserTeamPair(context: AuthContext, userId: string | null, teamId: string | null) {
  if (!userId || !teamId) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Selected user is not assigned to the selected team.");
  }

  await assertTeamScope(context, teamId);
  await assertUserScope(context, userId);
}

export async function assertAssignmentScope(context: AuthContext, teamId: string | null, userId: string | null) {
  await assertTeamScope(context, teamId);
  await assertUserScope(context, userId);
  await assertUserTeamPair(context, userId, teamId);
}
