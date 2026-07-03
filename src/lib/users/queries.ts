import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthContext } from "@/lib/auth/permissions";
import { canUseCompanyScope, getVisibleUserIds } from "@/lib/workflows/scope";
import type { Database } from "@/types/database";
import { getRoleDisplayName } from "@/types/roles";

type UserRow = Pick<
  Database["public"]["Tables"]["users"]["Row"],
  "id" | "company_id" | "email" | "first_name" | "last_name" | "avatar_url" | "role_id" | "status" | "created_at"
>;
type RoleRow = Pick<Database["public"]["Tables"]["roles"]["Row"], "id" | "name">;

export type OrgUserProfile = UserRow & {
  displayName: string;
  roleName: string;
  teamNames: string[];
  clientNames: string[];
  clientAssignments: Array<{
    clientId: string;
    clientName: string;
    assignmentRole: Database["public"]["Tables"]["client_assignments"]["Row"]["assignment_role"];
  }>;
  taskCount: number;
  ideaCount: number;
  contentCount: number;
  avatarSignedUrl: string | null;
};

function fullName(user: Pick<UserRow, "first_name" | "last_name" | "email">) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email;
}

export async function getOrgUserProfile(context: AuthContext, userId: string): Promise<OrgUserProfile | null> {
  if (context.role === "client") {
    return null;
  }

  const visibleUserIds = canUseCompanyScope(context) ? null : await getVisibleUserIds(context);

  if (visibleUserIds && !visibleUserIds.includes(userId)) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const [
    { data: user, error: userError },
    { data: roles, error: rolesError },
    { data: memberships },
    { data: assignments },
    taskCount,
    ideaCount,
    contentCount,
  ] = await Promise.all([
    supabase
      .from("users")
      .select("id, company_id, email, first_name, last_name, avatar_url, role_id, status, created_at")
      .eq("id", userId)
      .eq("company_id", context.companyId)
      .maybeSingle(),
    supabase.from("roles").select("id, name").eq("company_id", context.companyId),
    supabase.from("team_members").select("teams(name)").eq("user_id", userId),
    supabase.from("client_assignments").select("client_id, assignment_role, clients(name)").eq("user_id", userId),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).eq("assigned_to", userId),
    supabase.from("ideas").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).eq("assigned_to", userId),
    supabase.from("content_items").select("id", { count: "exact", head: true }).eq("company_id", context.companyId).eq("creator_id", userId),
  ]);

  if (userError || rolesError || !user) {
    return null;
  }

  const roleById = new Map(((roles as RoleRow[] | null) ?? []).map((role) => [role.id, role.name]));
  const profile = user as UserRow;
  let avatarSignedUrl: string | null = null;

  if (profile.avatar_url) {
    if (profile.avatar_url.startsWith("http://") || profile.avatar_url.startsWith("https://")) {
      avatarSignedUrl = profile.avatar_url;
    } else {
      const { data: signedAvatar } = await supabase.storage
        .from("contento-avatars")
        .createSignedUrl(profile.avatar_url, 60 * 60);

      avatarSignedUrl = signedAvatar?.signedUrl ?? null;
    }
  }

  return {
    ...profile,
    displayName: fullName(profile),
    roleName: profile.role_id ? getRoleDisplayName(roleById.get(profile.role_id)) : "Unassigned",
    teamNames: ((memberships as Array<{ teams: { name: string } | null }> | null) ?? [])
      .map((membership) => membership.teams?.name)
      .filter((name): name is string => Boolean(name)),
    clientNames: ((assignments as Array<{ clients: { name: string } | null }> | null) ?? [])
      .map((assignment) => assignment.clients?.name)
      .filter((name): name is string => Boolean(name)),
    clientAssignments: ((assignments as Array<{
      client_id: string;
      assignment_role: Database["public"]["Tables"]["client_assignments"]["Row"]["assignment_role"];
      clients: { name: string } | null;
    }> | null) ?? [])
      .map((assignment) => assignment.clients?.name ? {
        clientId: assignment.client_id,
        clientName: assignment.clients.name,
        assignmentRole: assignment.assignment_role,
      } : null)
      .filter((assignment): assignment is {
        clientId: string;
        clientName: string;
        assignmentRole: Database["public"]["Tables"]["client_assignments"]["Row"]["assignment_role"];
      } => Boolean(assignment)),
    taskCount: taskCount.count ?? 0,
    ideaCount: ideaCount.count ?? 0,
    contentCount: contentCount.count ?? 0,
    avatarSignedUrl,
  };
}
